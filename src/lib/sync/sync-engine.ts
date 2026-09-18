"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { snapshotOf, useAppStore, type Snapshot } from "@/lib/store/app-store";
import type { LearningProgress, QuizAttempt, Vocabulary } from "@/lib/types";
import {
  attemptToRow,
  profileToRow,
  progressToRow,
  rowToAttempt,
  rowToProfile,
  rowToProgress,
  rowToVocab,
  vocabToRow,
  type Row,
} from "./mapping";
import { mergeSnapshots } from "./merge";
import { getSupabase } from "./supabase-client";

// Local-first sync. IndexedDB is always the working copy; when signed in:
//   1. pull everything, merge (newest entry wins, history is unioned)
//   2. push local changes debounced, diffed against the last known server state
//   3. deletions travel as tombstones

type SyncStatus = "off" | "signed-out" | "syncing" | "synced" | "error";

interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: string | null;
  error: string | null;
}

export const useSyncStore = create<SyncState>(() => ({ status: "off", email: null, lastSyncedAt: null, error: null }));

const PAGE = 1000;

let fullSync: (() => Promise<void>) | null = null;
const BATCH = 500;

async function fetchAll(supabase: SupabaseClient, table: string, userId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").eq("user_id", userId).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function upsert(supabase: SupabaseClient, table: string, rows: Row[], onConflict: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
    if (error) throw error;
  }
}

export function startSync(): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  useSyncStore.setState({ status: "signed-out" });

  let userId: string | null = null;
  // Server-side versions we know about: id → updatedAt.
  let vocabBase = new Map<string, string>();
  let progressBase = new Map<string, string>();
  let attemptBase = new Set<string>();
  let profileBase = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pushing = false;
  let unsubscribeStore: (() => void) | null = null;

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "Sync failed";
    useSyncStore.setState({ status: "error", error: message });
  };

  const push = async () => {
    if (!userId || pushing) return;
    pushing = true;
    try {
      const s = useAppStore.getState();
      const vocabRows = Object.values(s.vocab).filter((v) => vocabBase.get(v.id) !== v.updatedAt);
      const progressRows = Object.values(s.progress).filter((p) => s.vocab[p.vocabularyId] && progressBase.get(p.vocabularyId) !== p.updatedAt);
      const attemptRows = s.attempts.filter((a) => !attemptBase.has(a.id) && s.vocab[a.vocabularyId]);
      const tombstones = [...s.tombstones];
      const profileChanged = s.profile.updatedAt !== profileBase;
      if (!vocabRows.length && !progressRows.length && !attemptRows.length && !tombstones.length && !profileChanged) {
        pushing = false;
        return;
      }
      useSyncStore.setState({ status: "syncing" });

      if (tombstones.length) {
        const { error } = await supabase.from("vocabulary").delete().eq("user_id", userId).in("id", tombstones);
        if (error) throw error;
        useAppStore.getState().clearTombstones(tombstones);
      }
      await upsert(supabase, "vocabulary", vocabRows.map((v) => vocabToRow(userId!, v)), "user_id,id");
      await upsert(supabase, "learning_progress", progressRows.map((p) => progressToRow(userId!, p)), "user_id,vocabulary_id");
      await upsert(supabase, "quiz_attempts", attemptRows.map((a) => attemptToRow(userId!, a)), "user_id,id");
      if (profileChanged) await upsert(supabase, "profiles", [profileToRow(userId, s.profile)], "user_id");

      vocabRows.forEach((v: Vocabulary) => vocabBase.set(v.id, v.updatedAt));
      tombstones.forEach((id) => vocabBase.delete(id));
      progressRows.forEach((p: LearningProgress) => progressBase.set(p.vocabularyId, p.updatedAt));
      attemptRows.forEach((a: QuizAttempt) => attemptBase.add(a.id));
      profileBase = s.profile.updatedAt;
      useSyncStore.setState({ status: "synced", lastSyncedAt: new Date().toISOString(), error: null });
    } catch (error) {
      fail(error);
    } finally {
      pushing = false;
    }
  };

  const schedulePush = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, 2000);
  };

  const pullAndMerge = async (session: Session) => {
    userId = session.user.id;
    useSyncStore.setState({ status: "syncing", email: session.user.email ?? null, error: null });
    try {
      const [vRows, pRows, aRows, profRows] = await Promise.all([
        fetchAll(supabase, "vocabulary", userId),
        fetchAll(supabase, "learning_progress", userId),
        fetchAll(supabase, "quiz_attempts", userId),
        fetchAll(supabase, "profiles", userId),
      ]);
      const remoteVocab = Object.fromEntries(vRows.map((r) => [String(r.id), rowToVocab(r)]));
      const remoteProgress = Object.fromEntries(pRows.map((r) => [String(r.vocabulary_id), rowToProgress(r)]));
      const remoteAttempts = aRows.map(rowToAttempt);
      const local = snapshotOf(useAppStore.getState());
      const remoteProfile = profRows[0] ? rowToProfile(profRows[0]) : local.profile;

      vocabBase = new Map(Object.values(remoteVocab).map((v) => [v.id, v.updatedAt]));
      progressBase = new Map(Object.values(remoteProgress).map((p) => [p.vocabularyId, p.updatedAt]));
      attemptBase = new Set(remoteAttempts.map((a) => a.id));
      profileBase = profRows[0] ? remoteProfile.updatedAt : "";

      const merged: Snapshot = mergeSnapshots(local, { vocab: remoteVocab, progress: remoteProgress, attempts: remoteAttempts, profile: remoteProfile });
      useAppStore.getState().replaceSnapshot(merged);
      useSyncStore.setState({ status: "synced", lastSyncedAt: new Date().toISOString() });
      unsubscribeStore?.();
      unsubscribeStore = useAppStore.subscribe(schedulePush);
      await push();
    } catch (error) {
      fail(error);
    }
  };

  fullSync = async () => {
    const { data: current } = await supabase.auth.getSession();
    if (current.session) await pullAndMerge(current.session);
  };

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      // Wait for local data before merging so nothing is overwritten. Supabase
      // calls must not run inside this callback (they can deadlock), so defer.
      const run = () => void setTimeout(() => void pullAndMerge(session), 0);
      if (useAppStore.getState().hydrated) run();
      else {
        const off = useAppStore.subscribe((s) => {
          if (s.hydrated) {
            off();
            run();
          }
        });
      }
    } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
      userId = null;
      unsubscribeStore?.();
      unsubscribeStore = null;
      useSyncStore.setState({ status: "signed-out", email: null });
    }
  });

  return () => {
    fullSync = null;
    data.subscription.unsubscribe();
    unsubscribeStore?.();
    if (timer) clearTimeout(timer);
  };
}

/** Full pull + merge + push, e.g. from a "Sync now" button. */
export async function syncNow() {
  await fullSync?.();
}
