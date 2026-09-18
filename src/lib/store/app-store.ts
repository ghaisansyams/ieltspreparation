"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { del, get, set } from "idb-keyval";
import { emit } from "@/lib/events";
import { difficultyFromCefr } from "@/lib/cefr";
import { XP, levelFromXp, levelTitle, newlyUnlocked } from "@/lib/learning/gamification";
import * as srs from "@/lib/learning/srs";
import type {
  AiField,
  CefrLevel,
  DayActivity,
  ExerciseType,
  LearningProgress,
  Profile,
  QuizAttempt,
  QuizType,
  Rating,
  Settings,
  UsageContexts,
  VocabDraft,
  Vocabulary,
} from "@/lib/types";
import { autoReviewNotes, hasIncomplete, wordKey } from "@/lib/vocab/fields";
import { dayKey, uid } from "@/lib/utils";

const MAX_ATTEMPTS = 20_000;

export const DEFAULT_SETTINGS: Settings = {
  dailyReviewGoal: 20,
  newWordsPerDay: 5,
  voice: "en-US",
  accessToken: "",
};

export function defaultProfile(now = new Date()): Profile {
  return {
    displayName: "",
    xp: 0,
    achievements: {},
    dailyChallenges: {},
    activity: {},
    settings: DEFAULT_SETTINGS,
    updatedAt: now.toISOString(),
  };
}

const EMPTY_DAY: DayActivity = { reviews: 0, correct: 0, incorrect: 0, xp: 0, wordsAdded: 0, sentences: 0 };

/** Full, serialisable state — used for persistence, sync and JSON backups. */
export interface Snapshot {
  vocab: Record<string, Vocabulary>;
  progress: Record<string, LearningProgress>;
  attempts: QuizAttempt[];
  profile: Profile;
  /** Deleted vocabulary ids not yet propagated to the cloud. */
  tombstones: string[];
}

export interface AppState extends Snapshot {
  hydrated: boolean;

  importDrafts: (drafts: VocabDraft[]) => Vocabulary[];
  addVocabulary: (draft: VocabDraft) => Vocabulary;
  updateVocabulary: (id: string, patch: Partial<Vocabulary>) => void;
  deleteVocabulary: (id: string) => void;
  setCefr: (id: string, level: CefrLevel) => void;
  verifyAiFields: (id: string, fields: AiField[] | "all") => void;
  resolveReview: (id: string) => void;
  cacheContexts: (id: string, contexts: UsageContexts) => void;

  reviewWord: (id: string, rating: Rating, exercise: ExerciseType, responseTime: number) => void;
  answerQuestion: (id: string, quizType: QuizType, correct: boolean, responseTime: number) => void;
  markKnown: (id: string) => void;
  markStillLearning: (id: string) => void;
  addToReview: (id: string) => void;

  awardXp: (amount: number, reason: string) => void;
  logSentence: (vocabId?: string) => void;
  completeDailyChallenge: (date: string, score: number, total: number) => void;
  checkAchievements: (extra?: { perfectRun?: boolean }) => void;

  setDisplayName: (name: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  replaceSnapshot: (snapshot: Snapshot) => void;
  clearTombstones: (ids: string[]) => void;
  resetProgress: () => void;
  clearEverything: () => void;
}

// IndexedDB first; some browsers block it (private windows, strict privacy
// settings), so fall back to localStorage, and finally to memory with a visible
// warning — the learner must never import 148 words that silently vanish.
export type StorageMode = "indexeddb" | "localstorage" | "memory";
let storageMode: StorageMode = "indexeddb";
const memoryStore = new Map<string, string>();

function degrade(to: StorageMode) {
  if (storageMode === to || (storageMode === "memory" && to === "localstorage")) return;
  storageMode = to;
  queueMicrotask(() => emit("storage", { mode: to }));
}

export const getStorageMode = () => storageMode;

const resilientStorage: StateStorage = {
  getItem: async (name) => {
    if (storageMode === "indexeddb") {
      try {
        if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
        const value = await get<string>(name);
        if (value != null) return value;
      } catch {
        degrade("localstorage");
      }
    }
    try {
      const value = localStorage.getItem(name);
      if (value != null) return value;
    } catch {
      degrade("memory");
    }
    return memoryStore.get(name) ?? null;
  },
  setItem: async (name, value) => {
    if (storageMode === "indexeddb") {
      try {
        if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
        await set(name, value);
        return;
      } catch {
        degrade("localstorage");
      }
    }
    if (storageMode === "localstorage") {
      try {
        localStorage.setItem(name, value);
        return;
      } catch {
        degrade("memory");
      }
    }
    memoryStore.set(name, value);
  },
  removeItem: async (name) => {
    memoryStore.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {}
    try {
      if (typeof indexedDB !== "undefined") await del(name);
    } catch {}
  },
};

function bumpActivity(profile: Profile, patch: Partial<DayActivity>, now = new Date()): Profile {
  const key = dayKey(now);
  const cur = profile.activity[key] ?? EMPTY_DAY;
  const next: DayActivity = { ...cur };
  (Object.keys(patch) as (keyof DayActivity)[]).forEach((k) => {
    next[k] = cur[k] + (patch[k] ?? 0);
  });
  return { ...profile, activity: { ...profile.activity, [key]: next }, updatedAt: now.toISOString() };
}

function withXp(profile: Profile, amount: number, reason: string, now = new Date()): Profile {
  if (amount <= 0) return profile;
  const before = levelFromXp(profile.xp).level;
  const next = bumpActivity({ ...profile, xp: profile.xp + amount }, { xp: amount }, now);
  const after = levelFromXp(next.xp).level;
  queueMicrotask(() => {
    emit("xp", { amount, reason });
    if (after > before) emit("levelUp", { level: after, title: levelTitle(after) });
  });
  return next;
}

function newId(draft: VocabDraft, taken: Record<string, Vocabulary>): string {
  if (draft.id && !taken[draft.id]) return draft.id;
  if (draft.origin === "source-pdf" && draft.sourceNumber) {
    const id = `src-${String(draft.sourceNumber).padStart(3, "0")}`;
    if (!taken[id]) return id;
  }
  return uid("v");
}

function trimAttempts(list: QuizAttempt[]): QuizAttempt[] {
  return list.length > MAX_ATTEMPTS ? list.slice(list.length - MAX_ATTEMPTS) : list;
}

export const useAppStore = create<AppState>()(
  persist(
    (setState, getState) => {
      const touchProgress = (id: string, fn: (p: LearningProgress) => LearningProgress) =>
        setState((s) => {
          const cur = s.progress[id] ?? srs.newProgress(id);
          return { progress: { ...s.progress, [id]: fn(cur) } };
        });

      const recordAttempt = (vocabularyId: string, quizType: QuizType, isCorrect: boolean, responseTime: number): QuizAttempt => ({
        id: uid("qa"),
        vocabularyId,
        quizType,
        isCorrect,
        responseTime: Math.max(0, Math.round(responseTime)),
        createdAt: new Date().toISOString(),
      });

      return {
        hydrated: false,
        vocab: {},
        progress: {},
        attempts: [],
        profile: defaultProfile(),
        tombstones: [],

        importDrafts: (drafts) => {
          const now = new Date();
          const created: Vocabulary[] = [];
          setState((s) => {
            const vocab = { ...s.vocab };
            const progress = { ...s.progress };
            for (const d of drafts) {
              const id = newId(d, vocab);
              const v: Vocabulary = { ...d, id, createdAt: now.toISOString(), updatedAt: now.toISOString() };
              vocab[id] = v;
              progress[id] = srs.newProgress(id, now);
              created.push(v);
            }
            return {
              vocab,
              progress,
              tombstones: s.tombstones.filter((t) => !vocab[t]),
              profile: bumpActivity(s.profile, { wordsAdded: created.length }, now),
            };
          });
          getState().checkAchievements();
          return created;
        },

        addVocabulary: (draft) => {
          const [v] = getState().importDrafts([draft]);
          setState((s) => ({ profile: withXp(s.profile, XP.addWord, "New word") }));
          return v;
        },

        updateVocabulary: (id, patch) =>
          setState((s) => {
            const cur = s.vocab[id];
            if (!cur) return {};
            const next: Vocabulary = { ...cur, ...patch, id, updatedAt: new Date().toISOString() };
            if (!next.needsReview && hasIncomplete(autoReviewNotes(next))) {
              next.needsReview = true;
              next.reviewNotes = [...next.reviewNotes, ...autoReviewNotes(next).filter((n) => n.kind === "incomplete")];
            }
            return { vocab: { ...s.vocab, [id]: next } };
          }),

        deleteVocabulary: (id) =>
          setState((s) => {
            const vocab = { ...s.vocab };
            const progress = { ...s.progress };
            delete vocab[id];
            delete progress[id];
            return {
              vocab,
              progress,
              attempts: s.attempts.filter((a) => a.vocabularyId !== id),
              tombstones: [...s.tombstones, id],
            };
          }),

        setCefr: (id, level) =>
          setState((s) => {
            const cur = s.vocab[id];
            if (!cur) return {};
            const difficultyWasAi = cur.aiFields.includes("difficulty") || cur.difficulty === null;
            return {
              vocab: {
                ...s.vocab,
                [id]: {
                  ...cur,
                  cefr: level,
                  cefrSource: "manual",
                  difficulty: difficultyWasAi ? difficultyFromCefr(level) : cur.difficulty,
                  aiFields: cur.aiFields.filter((f) => f !== "cefr"),
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          }),

        verifyAiFields: (id, fields) =>
          setState((s) => {
            const cur = s.vocab[id];
            if (!cur) return {};
            const aiFields = fields === "all" ? [] : cur.aiFields.filter((f) => !fields.includes(f));
            const cefrVerified = cur.aiFields.includes("cefr") && !aiFields.includes("cefr") && cur.cefrSource === "estimated";
            return {
              vocab: {
                ...s.vocab,
                [id]: { ...cur, aiFields, cefrSource: cefrVerified ? "manual" : cur.cefrSource, updatedAt: new Date().toISOString() },
              },
            };
          }),

        resolveReview: (id) =>
          setState((s) => {
            const cur = s.vocab[id];
            if (!cur) return {};
            return {
              vocab: {
                ...s.vocab,
                [id]: { ...cur, needsReview: false, reviewNotes: cur.reviewNotes.filter((n) => n.kind !== "incomplete"), updatedAt: new Date().toISOString() },
              },
            };
          }),

        cacheContexts: (id, contexts) =>
          setState((s) => (s.vocab[id] ? { vocab: { ...s.vocab, [id]: { ...s.vocab[id], contexts, updatedAt: new Date().toISOString() } } } : {})),

        reviewWord: (id, rating, exercise, responseTime) => {
          const now = new Date();
          const correct = rating !== "again";
          const xp = { again: XP.reviewAgain, hard: XP.reviewHard, good: XP.reviewGood, easy: XP.reviewEasy }[rating];
          setState((s) => {
            const cur = s.progress[id] ?? srs.newProgress(id, now);
            return {
              progress: { ...s.progress, [id]: srs.schedule(cur, rating, exercise, now) },
              attempts: trimAttempts([...s.attempts, recordAttempt(id, "review", correct, responseTime)]),
              profile: withXp(bumpActivity(s.profile, { reviews: 1, correct: correct ? 1 : 0, incorrect: correct ? 0 : 1 }, now), xp, "Review", now),
            };
          });
          getState().checkAchievements();
        },

        answerQuestion: (id, quizType, correct, responseTime) => {
          const now = new Date();
          setState((s) => {
            const cur = s.progress[id] ?? srs.newProgress(id, now);
            return {
              progress: { ...s.progress, [id]: srs.recordGameAnswer(cur, correct, now) },
              attempts: trimAttempts([...s.attempts, recordAttempt(id, quizType, correct, responseTime)]),
              profile: withXp(
                bumpActivity(s.profile, { correct: correct ? 1 : 0, incorrect: correct ? 0 : 1 }, now),
                correct ? XP.gameCorrect : XP.gameWrong,
                quizType,
                now,
              ),
            };
          });
        },

        markKnown: (id) => {
          touchProgress(id, (p) => srs.markKnown(p));
          getState().checkAchievements();
        },
        markStillLearning: (id) => touchProgress(id, (p) => srs.markStillLearning(p)),
        addToReview: (id) => touchProgress(id, (p) => srs.addToReview(p)),

        awardXp: (amount, reason) => setState((s) => ({ profile: withXp(s.profile, amount, reason) })),

        logSentence: () =>
          setState((s) => ({ profile: withXp(bumpActivity(s.profile, { sentences: 1 }), XP.sentence, "Sentence practice") })),

        completeDailyChallenge: (date, score, total) => {
          const already = !!getState().profile.dailyChallenges[date];
          setState((s) => {
            const profile = { ...s.profile, dailyChallenges: { ...s.profile.dailyChallenges, [date]: { score, total, completedAt: new Date().toISOString() } } };
            return { profile: already ? profile : withXp(profile, XP.dailyChallenge, "Daily challenge") };
          });
          getState().checkAchievements();
        },

        checkAchievements: (extra) => {
          const s = getState();
          const unlocked = newlyUnlocked({ vocab: s.vocab, progress: s.progress, attempts: s.attempts, profile: s.profile, perfectRun: extra?.perfectRun });
          if (!unlocked.length) return;
          const at = new Date().toISOString();
          setState((st) => ({
            profile: {
              ...st.profile,
              achievements: { ...st.profile.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, at])) },
              updatedAt: at,
            },
          }));
          queueMicrotask(() => unlocked.forEach((a) => emit("achievement", { id: a.id, title: a.title, description: a.description })));
        },

        setDisplayName: (displayName) => setState((s) => ({ profile: { ...s.profile, displayName, updatedAt: new Date().toISOString() } })),
        updateSettings: (patch) =>
          setState((s) => ({ profile: { ...s.profile, settings: { ...s.profile.settings, ...patch }, updatedAt: new Date().toISOString() } })),

        replaceSnapshot: (snap) =>
          setState({
            vocab: snap.vocab,
            progress: snap.progress,
            attempts: trimAttempts(snap.attempts),
            profile: { ...defaultProfile(), ...snap.profile, settings: { ...DEFAULT_SETTINGS, ...snap.profile.settings } },
            tombstones: snap.tombstones ?? [],
          }),

        clearTombstones: (ids) => setState((s) => ({ tombstones: s.tombstones.filter((t) => !ids.includes(t)) })),

        resetProgress: () =>
          setState((s) => ({
            progress: Object.fromEntries(Object.keys(s.vocab).map((id) => [id, srs.newProgress(id)])),
            attempts: [],
            profile: { ...defaultProfile(), displayName: s.profile.displayName, settings: s.profile.settings },
          })),

        clearEverything: () =>
          setState((s) => ({
            vocab: {},
            progress: {},
            attempts: [],
            tombstones: [...s.tombstones, ...Object.keys(s.vocab)],
            profile: { ...defaultProfile(), displayName: s.profile.displayName, settings: s.profile.settings },
          })),
      };
    },
    {
      name: "vocab-hub:v1",
      version: 1,
      storage: createJSONStorage(() => resilientStorage),
      skipHydration: true,
      partialize: (s): Snapshot => ({ vocab: s.vocab, progress: s.progress, attempts: s.attempts, profile: s.profile, tombstones: s.tombstones }),
      onRehydrateStorage: () => () => {
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

export function snapshotOf(s: Snapshot): Snapshot {
  return { vocab: s.vocab, progress: s.progress, attempts: s.attempts, profile: s.profile, tombstones: s.tombstones };
}

/** Existing entry with the same headword, for duplicate warnings. */
export function findByWord(vocab: Record<string, Vocabulary>, word: string): Vocabulary | undefined {
  const key = wordKey(word);
  return Object.values(vocab).find((v) => wordKey(v.word) === key);
}
