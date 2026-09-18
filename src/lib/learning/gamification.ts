import type { LearningProgress, Profile, QuizAttempt, Vocabulary } from "@/lib/types";
import { addDays, dayKey } from "@/lib/utils";

export const XP = {
  reviewAgain: 2,
  reviewHard: 5,
  reviewGood: 8,
  reviewEasy: 8,
  gameCorrect: 10,
  gameWrong: 1,
  perfectRun: 50,
  addWord: 5,
  sentence: 15,
  dailyChallenge: 100,
} as const;

// Level n needs 60·n·(n+1)/2 total XP → L2 at 60, L5 at 600, L10 at 3,300, L20 at 12,600.
export function levelFromXp(xp: number): { level: number; current: number; next: number; progress: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, current: xp - floor, next: ceil - floor, progress: (xp - floor) / (ceil - floor) };
}

export function xpForLevel(level: number): number {
  const n = level - 1;
  return (60 * n * (n + 1)) / 2;
}

export function levelTitle(level: number): string {
  if (level >= 30) return "Lexicon Master";
  if (level >= 20) return "Semantic Architect";
  if (level >= 15) return "Lexical Strategist";
  if (level >= 10) return "Vocabulary Explorer";
  if (level >= 5) return "Word Apprentice";
  return "Word Collector";
}

/** A day counts toward the streak only with real practice (importing words alone doesn't). */
const practised = (a: Profile["activity"][string] | undefined) => !!a && a.reviews + a.correct + a.incorrect + a.sentences > 0;

/** Consecutive days with practice, ending today (or yesterday, if today is still open). */
export function currentStreak(activity: Profile["activity"], now = new Date()): number {
  const active = (d: Date) => practised(activity[dayKey(d)]);
  let cursor = active(now) ? now : addDays(now, -1);
  let streak = 0;
  while (active(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(activity: Profile["activity"]): number {
  const days = Object.keys(activity)
    .filter((k) => practised(activity[k]))
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export interface AchievementContext {
  vocab: Record<string, Vocabulary>;
  progress: Record<string, LearningProgress>;
  attempts: QuizAttempt[];
  profile: Profile;
  /** Set by game screens when a run finished with every answer correct. */
  perfectRun?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  test: (ctx: AchievementContext) => boolean;
}

const count = (ctx: AchievementContext) => Object.keys(ctx.vocab).length;
const mastered = (ctx: AchievementContext) => Object.values(ctx.progress).filter((p) => p.status === "mastered").length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-review", title: "First Recall", description: "Complete your first review", icon: "sparkles", test: (c) => Object.values(c.progress).some((p) => p.reviewCount > 0) },
  { id: "words-100", title: "First 100 Words", description: "Build a library of 100 words", icon: "library", test: (c) => count(c) >= 100 },
  { id: "words-500", title: "500 Words", description: "Build a library of 500 words", icon: "library", test: (c) => count(c) >= 500 },
  { id: "words-1000", title: "1,000 Words", description: "Build a library of 1,000 words", icon: "library", test: (c) => count(c) >= 1000 },
  { id: "streak-7", title: "7 Day Streak", description: "Learn seven days in a row", icon: "flame", test: (c) => longestStreak(c.profile.activity) >= 7 },
  { id: "streak-30", title: "30 Day Streak", description: "Learn thirty days in a row", icon: "flame", test: (c) => longestStreak(c.profile.activity) >= 30 },
  { id: "c1-explorer", title: "C1 Explorer", description: "Master 10 words at C1 or C2", icon: "compass", test: (c) => Object.values(c.progress).filter((p) => p.status === "mastered" && ["C1", "C2"].includes(c.vocab[p.vocabularyId]?.cefr ?? "")).length >= 10 },
  { id: "perfect-quiz", title: "Perfect Quiz", description: "Finish a game without a single mistake", icon: "target", test: (c) => !!c.perfectRun },
  { id: "mastered-10", title: "10 Words Mastered", description: "Master ten words", icon: "award", test: (c) => mastered(c) >= 10 },
  { id: "mastered-100", title: "100 Words Mastered", description: "Master one hundred words", icon: "award", test: (c) => mastered(c) >= 100 },
  { id: "answers-500", title: "500 Answers", description: "Answer 500 questions across games and reviews", icon: "zap", test: (c) => c.attempts.length >= 500 },
  { id: "daily-7", title: "Daily Devotion", description: "Complete 7 daily challenges", icon: "calendar", test: (c) => Object.keys(c.profile.dailyChallenges).length >= 7 },
];

export function newlyUnlocked(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !ctx.profile.achievements[a.id] && a.test(ctx));
}
