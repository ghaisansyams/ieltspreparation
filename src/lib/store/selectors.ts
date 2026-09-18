"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { CEFR_LEVELS, type CefrLevel, type LearningStatus } from "@/lib/types";
import { currentStreak, levelFromXp, levelTitle } from "@/lib/learning/gamification";
import { buildReviewQueue, wordsYouKeepForgetting } from "@/lib/learning/priority";
import { isDue } from "@/lib/learning/srs";
import { addDays, dayKey, endOfDay, DAY_MS } from "@/lib/utils";
import { useAppStore } from "./app-store";

export function useLibrary() {
  return useAppStore(useShallow((s) => ({ vocab: s.vocab, progress: s.progress, hydrated: s.hydrated })));
}

export function useVocabList() {
  const vocab = useAppStore((s) => s.vocab);
  return useMemo(() => Object.values(vocab), [vocab]);
}

export function useSettings() {
  return useAppStore((s) => s.profile.settings);
}

export interface CefrBucket {
  level: CefrLevel | "Unrated";
  total: number;
  byStatus: Record<LearningStatus, number>;
}

export function useStats() {
  const { vocab, progress, attempts, profile } = useAppStore(
    useShallow((s) => ({ vocab: s.vocab, progress: s.progress, attempts: s.attempts, profile: s.profile })),
  );

  return useMemo(() => {
    const now = new Date();
    const eod = endOfDay(now);
    const list = Object.values(vocab);
    const status: Record<LearningStatus, number> = { new: 0, learning: 0, review: 0, mastered: 0 };
    let due = 0;
    let needsReview = 0;
    for (const v of list) {
      const p = progress[v.id];
      status[p?.status ?? "new"]++;
      if (isDue(p, now, eod)) due++;
      if (v.needsReview) needsReview++;
    }
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const newlyAdded = list.filter((v) => new Date(v.createdAt).getTime() >= weekAgo).length;

    const recent = attempts.filter((a) => new Date(a.createdAt).getTime() >= now.getTime() - 30 * DAY_MS);
    const accuracy = recent.length ? recent.filter((a) => a.isCorrect).length / recent.length : null;

    const cefr: CefrBucket[] = [...CEFR_LEVELS, "Unrated" as const].map((level) => ({
      level,
      total: 0,
      byStatus: { new: 0, learning: 0, review: 0, mastered: 0 },
    }));
    for (const v of list) {
      const bucket = cefr[v.cefr ? CEFR_LEVELS.indexOf(v.cefr) : 6];
      bucket.total++;
      bucket.byStatus[progress[v.id]?.status ?? "new"]++;
    }

    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(now, i - 6);
      const a = profile.activity[dayKey(d)];
      return { date: d, key: dayKey(d), reviews: a?.reviews ?? 0, correct: a?.correct ?? 0, incorrect: a?.incorrect ?? 0, xp: a?.xp ?? 0 };
    });

    const queue = buildReviewQueue(vocab, progress, { newLimit: profile.settings.newWordsPerDay, now, endOfToday: eod });
    const level = levelFromXp(profile.xp);

    return {
      total: list.length,
      status,
      mastered: status.mastered,
      learning: status.learning + status.review,
      due,
      newlyAdded,
      needsReview,
      accuracy,
      streak: currentStreak(profile.activity, now),
      cefr: cefr.filter((b) => b.level !== "Unrated" || b.total > 0),
      week,
      queue,
      newInQueue: Math.max(0, queue.length - due),
      forgetting: wordsYouKeepForgetting(vocab, progress, now),
      xp: profile.xp,
      level: level.level,
      levelProgress: level.progress,
      levelCurrent: level.current,
      levelNext: level.next,
      levelTitle: levelTitle(level.level),
      reviewsToday: profile.activity[dayKey(now)]?.reviews ?? 0,
      sentencesToday: profile.activity[dayKey(now)]?.sentences ?? 0,
      dailyDone: !!profile.dailyChallenges[dayKey(now)],
      dailyGoal: profile.settings.dailyReviewGoal,
    };
  }, [vocab, progress, attempts, profile]);
}
