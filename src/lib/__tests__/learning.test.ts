import { describe, expect, it } from "vitest";
import { newProgress, schedule, recordGameAnswer, exerciseFor, computeMastery } from "@/lib/learning/srs";
import { priorityScore, priorityLevel } from "@/lib/learning/priority";
import { levelFromXp, currentStreak } from "@/lib/learning/gamification";

const now = new Date("2026-09-17T09:00:00");

describe("spaced repetition", () => {
  it("walks a word from new to mastered with Good ratings", () => {
    let p = newProgress("w1", now);
    expect(p.status).toBe("new");
    const intervals: number[] = [];
    let t = now;
    for (let i = 0; i < 5; i++) {
      p = schedule(p, "good", "flashcard", t);
      intervals.push(p.intervalDays);
      t = new Date(p.nextReviewAt!);
    }
    expect(intervals).toEqual([1, 3, 8, 20, 50]);
    expect(p.status).toBe("mastered");
    expect(p.mastery).toBeGreaterThan(80);
  });

  it("Again resets to a 10-minute relearn and counts a lapse for known words", () => {
    let p = newProgress("w1", now);
    for (let i = 0; i < 3; i++) p = schedule(p, "good", "flashcard", now);
    expect(p.status).toBe("review");
    p = schedule(p, "again", "flashcard", now);
    expect(p.intervalDays).toBe(0);
    expect(p.lapses).toBe(1);
    expect(p.status).toBe("learning");
    expect(new Date(p.nextReviewAt!).getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("a wrong game answer pulls the word back into today's queue", () => {
    let p = newProgress("w1", now);
    for (let i = 0; i < 4; i++) p = schedule(p, "good", "flashcard", now);
    const later = new Date(now.getTime() + 86_400_000);
    const after = recordGameAnswer(p, false, later);
    expect(new Date(after.nextReviewAt!).getTime()).toBeLessThanOrEqual(later.getTime());
    expect(after.intervalDays).toBeLessThan(p.intervalDays);
  });

  it("rotates exercise types as reviews accumulate", () => {
    const p = newProgress("w1", now);
    expect([0, 1, 2, 3].map((n) => exerciseFor({ ...p, reviewCount: n }))).toEqual([
      "flashcard",
      "multiple-choice",
      "sentence-completion",
      "reverse-translation",
    ]);
  });

  it("does not call a word mastered on accuracy alone", () => {
    const p = { ...newProgress("w1", now), correctCount: 5, confidence: 1, intervalDays: 1 };
    expect(computeMastery(p)).toBeLessThan(70);
  });
});

describe("priority", () => {
  it("ranks frequently-missed words above well-known ones", () => {
    const weak = { ...newProgress("a", now), status: "learning" as const, correctCount: 2, incorrectCount: 5, confidence: 0.2, lapses: 2 };
    const strong = { ...newProgress("b", now), status: "review" as const, correctCount: 10, incorrectCount: 1, confidence: 0.9, nextReviewAt: new Date(now.getTime() + 86_400_000 * 5).toISOString() };
    expect(priorityLevel(priorityScore(weak, now))).toBe("high");
    expect(priorityLevel(priorityScore(strong, now))).toBe("low");
  });
});

describe("gamification", () => {
  it("computes levels", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(60).level).toBe(2);
    expect(levelFromXp(3300).level).toBe(11);
  });

  it("counts a streak ending yesterday when today is still open", () => {
    const a = { reviews: 1, correct: 1, incorrect: 0, xp: 5, wordsAdded: 0, sentences: 0 };
    const activity = { "2026-09-14": a, "2026-09-15": a, "2026-09-16": a };
    expect(currentStreak(activity, now)).toBe(3);
  });
});
