import type { LearningProgress, Vocabulary } from "@/lib/types";
import { DAY_MS, clamp } from "@/lib/utils";
import { accuracy, isDue } from "./srs";

export type PriorityLevel = "high" | "medium" | "low";

/**
 * How urgently a word needs attention. Favours words that are:
 * frequently wrong · overdue / not seen recently · low confidence · newly added.
 */
export function priorityScore(p: LearningProgress | undefined, now = new Date()): number {
  if (!p) return 30;
  let score = 0;
  const attempts = p.correctCount + p.incorrectCount;
  const acc = accuracy(p);
  if (acc !== null && attempts >= 2) score += (1 - acc) * 45;
  score += (1 - p.confidence) * 20;
  if (p.status === "new") score += 15;
  if (p.nextReviewAt) {
    const overdueDays = (now.getTime() - new Date(p.nextReviewAt).getTime()) / DAY_MS;
    if (overdueDays > 0) score += clamp(overdueDays * 3, 0, 25);
  }
  if (p.lastReviewedAt) {
    const idle = (now.getTime() - new Date(p.lastReviewedAt).getTime()) / DAY_MS;
    score += clamp((idle / 7) * 4, 0, 15);
  }
  score += Math.min(p.lapses * 6, 18);
  return Math.round(score);
}

export function priorityLevel(score: number): PriorityLevel {
  if (score >= 50) return "high";
  if (score >= 28) return "medium";
  return "low";
}

export interface StruggleEntry {
  vocab: Vocabulary;
  progress: LearningProgress;
  accuracy: number;
  attempts: number;
  priority: PriorityLevel;
}

/** "Words You Keep Forgetting": enough attempts to be meaningful, and a weak record. */
export function wordsYouKeepForgetting(
  vocab: Record<string, Vocabulary>,
  progress: Record<string, LearningProgress>,
  now = new Date(),
  limit = 8,
): StruggleEntry[] {
  const list: StruggleEntry[] = [];
  for (const p of Object.values(progress)) {
    const v = vocab[p.vocabularyId];
    if (!v) continue;
    const attempts = p.correctCount + p.incorrectCount;
    const acc = accuracy(p);
    if (acc === null || attempts < 2) continue;
    if (acc >= 0.75 && p.lapses < 2) continue;
    list.push({ vocab: v, progress: p, accuracy: acc, attempts, priority: priorityLevel(priorityScore(p, now)) });
  }
  return list.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, limit);
}

export interface ReviewQueueOptions {
  newLimit: number;
  now?: Date;
  endOfToday?: Date;
}

/** Due words by priority, followed by a capped number of new words (oldest first). */
export function buildReviewQueue(
  vocab: Record<string, Vocabulary>,
  progress: Record<string, LearningProgress>,
  { newLimit, now = new Date(), endOfToday }: ReviewQueueOptions,
): string[] {
  const due: { id: string; score: number }[] = [];
  const fresh: Vocabulary[] = [];
  for (const v of Object.values(vocab)) {
    const p = progress[v.id];
    if (!p || p.status === "new") {
      if (!p?.nextReviewAt) {
        fresh.push(v);
        continue;
      }
    }
    if (isDue(p, now, endOfToday)) due.push({ id: v.id, score: priorityScore(p, now) });
  }
  due.sort((a, b) => b.score - a.score);
  fresh.sort((a, b) => (a.sourceNumber ?? 1e9) - (b.sourceNumber ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
  return [...due.map((d) => d.id), ...fresh.slice(0, newLimit).map((v) => v.id)];
}
