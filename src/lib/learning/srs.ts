import type { ExerciseType, LearningProgress, LearningStatus, Rating } from "@/lib/types";
import { DAY_MS, clamp } from "@/lib/utils";

// SM-2 style scheduler with four states (New → Learning → Review → Mastered).
//
//   Again  → relearn in 10 minutes, ease −0.20, lapse counted if it was known
//   Hard   → interval × 1.2, ease −0.15
//   Good   → 1d → 3d → interval × ease
//   Easy   → 4d first time, then interval × ease × 1.3, ease +0.15
//
// Mastery is a 0–100 blend of how long the word survives between reviews,
// lifetime accuracy and recent confidence — so a word you guessed right once
// is not "mastered".

export const MIN_EASE = 1.3;
export const DEFAULT_EASE = 2.5;
export const MASTERED_INTERVAL = 21;
const RELEARN_MS = 10 * 60 * 1000;

const RATING_SCORE: Record<Rating, number> = { again: 0, hard: 0.45, good: 0.8, easy: 1 };

export function newProgress(vocabularyId: string, now = new Date()): LearningProgress {
  return {
    id: `lp-${vocabularyId}`,
    vocabularyId,
    status: "new",
    mastery: 0,
    reviewCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    streak: 0,
    confidence: 0,
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    lapses: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    lastExerciseType: null,
    updatedAt: now.toISOString(),
  };
}

export function accuracy(p: Pick<LearningProgress, "correctCount" | "incorrectCount">): number | null {
  const total = p.correctCount + p.incorrectCount;
  return total > 0 ? p.correctCount / total : null;
}

export function computeMastery(p: LearningProgress): number {
  const intervalScore = clamp(Math.log(1 + p.intervalDays) / Math.log(1 + 30), 0, 1);
  const acc = accuracy(p) ?? 0;
  return Math.round(100 * (0.5 * intervalScore + 0.3 * acc + 0.2 * p.confidence));
}

function statusFor(p: LearningProgress): LearningStatus {
  if (p.reviewCount === 0 && p.correctCount + p.incorrectCount === 0) return "new";
  const acc = accuracy(p) ?? 0;
  if (p.intervalDays >= MASTERED_INTERVAL && acc >= 0.8) return "mastered";
  if (p.intervalDays >= 3) return "review";
  return "learning";
}

export function nextInterval(p: LearningProgress, rating: Rating): { interval: number; ease: number } {
  const ease = p.easeFactor || DEFAULT_EASE;
  const cur = p.intervalDays;
  switch (rating) {
    case "again":
      return { interval: 0, ease: Math.max(MIN_EASE, ease - 0.2) };
    case "hard":
      return { interval: cur < 1 ? 1 : Math.max(cur + 1, Math.round(cur * 1.2)), ease: Math.max(MIN_EASE, ease - 0.15) };
    case "good":
      return { interval: cur < 1 ? 1 : cur < 3 ? 3 : Math.round(cur * ease), ease };
    case "easy": {
      const next = ease + 0.15;
      return { interval: cur < 1 ? 4 : Math.round(cur * next * 1.3), ease: next };
    }
  }
}

/** Apply a self-graded review (Again / Hard / Good / Easy). */
export function schedule(p: LearningProgress, rating: Rating, exercise: ExerciseType, now = new Date()): LearningProgress {
  const { interval, ease } = nextInterval(p, rating);
  const wasKnown = p.status === "review" || p.status === "mastered";
  const correct = rating !== "again";
  const next: LearningProgress = {
    ...p,
    reviewCount: p.reviewCount + 1,
    correctCount: p.correctCount + (correct ? 1 : 0),
    incorrectCount: p.incorrectCount + (correct ? 0 : 1),
    streak: correct ? p.streak + 1 : 0,
    lapses: p.lapses + (!correct && wasKnown ? 1 : 0),
    confidence: round2(0.6 * p.confidence + 0.4 * RATING_SCORE[rating]),
    easeFactor: round2(ease),
    intervalDays: interval,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + (interval === 0 ? RELEARN_MS : interval * DAY_MS)).toISOString(),
    lastExerciseType: exercise,
    updatedAt: now.toISOString(),
  };
  next.status = statusFor(next);
  next.mastery = computeMastery(next);
  return next;
}

/**
 * A game answer is a lighter signal than a deliberate review: it never pushes
 * a word further out, but a wrong answer pulls the word back into today's queue.
 */
export function recordGameAnswer(p: LearningProgress, correct: boolean, now = new Date()): LearningProgress {
  const next: LearningProgress = {
    ...p,
    correctCount: p.correctCount + (correct ? 1 : 0),
    incorrectCount: p.incorrectCount + (correct ? 0 : 1),
    streak: correct ? p.streak + 1 : 0,
    confidence: round2(0.8 * p.confidence + 0.2 * (correct ? 0.85 : 0)),
    updatedAt: now.toISOString(),
  };
  if (!correct) {
    const due = p.nextReviewAt ? Math.min(new Date(p.nextReviewAt).getTime(), now.getTime()) : now.getTime();
    next.nextReviewAt = new Date(due).toISOString();
    if (p.intervalDays >= 3) next.intervalDays = Math.max(1, Math.round(p.intervalDays / 2));
  } else if (!p.nextReviewAt) {
    next.nextReviewAt = new Date(now.getTime() + DAY_MS).toISOString();
  }
  next.status = statusFor(next);
  next.mastery = computeMastery(next);
  return next;
}

/** "Known" on a card: trust the learner and push the word far out. */
export function markKnown(p: LearningProgress, now = new Date()): LearningProgress {
  const next: LearningProgress = {
    ...p,
    reviewCount: p.reviewCount + 1,
    correctCount: p.correctCount + 1,
    streak: p.streak + 1,
    confidence: Math.max(p.confidence, 0.9),
    intervalDays: Math.max(p.intervalDays, MASTERED_INTERVAL),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: new Date(now.getTime() + Math.max(p.intervalDays, MASTERED_INTERVAL) * DAY_MS).toISOString(),
    lastExerciseType: "flashcard",
    updatedAt: now.toISOString(),
  };
  next.status = statusFor(next);
  next.mastery = computeMastery(next);
  return next;
}

/** "Still learning": back to short intervals, due tomorrow. */
export function markStillLearning(p: LearningProgress, now = new Date()): LearningProgress {
  const next: LearningProgress = {
    ...p,
    intervalDays: Math.min(p.intervalDays, 1),
    confidence: Math.min(p.confidence, 0.4),
    nextReviewAt: new Date(now.getTime() + DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
  };
  next.status = p.reviewCount + p.correctCount + p.incorrectCount === 0 ? "learning" : statusFor(next);
  if (next.status === "new") next.status = "learning";
  next.mastery = computeMastery(next);
  return next;
}

/** "Add to Review": due right now. */
export function addToReview(p: LearningProgress, now = new Date()): LearningProgress {
  return { ...p, nextReviewAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function isDue(p: LearningProgress | undefined, now = new Date(), endOfToday?: Date): boolean {
  if (!p || !p.nextReviewAt) return false;
  const limit = endOfToday ?? now;
  return new Date(p.nextReviewAt).getTime() <= limit.getTime();
}

/**
 * The exercise a word gets next, so the same word is met in different ways
 * over time: flashcard → multiple choice → sentence completion → translation
 * → synonyms / using it in a sentence.
 */
export function exerciseFor(p: LearningProgress): ExerciseType {
  const n = p.reviewCount;
  if (n === 0) return "flashcard";
  if (n === 1) return "multiple-choice";
  if (n === 2) return "sentence-completion";
  if (n === 3) return "reverse-translation";
  const rotation: ExerciseType[] = ["synonym-match", "sentence-completion", "use-it", "reverse-translation", "multiple-choice"];
  return rotation[n % rotation.length];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
