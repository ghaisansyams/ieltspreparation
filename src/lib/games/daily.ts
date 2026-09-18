import type { LearningProgress, Vocabulary } from "@/lib/types";
import { priorityScore } from "@/lib/learning/priority";
import { isDue } from "@/lib/learning/srs";
import { dayKey, endOfDay, seededRandom, shuffle } from "@/lib/utils";
import {
  clozeChoice,
  clozeTyped,
  meaningMatch,
  meaningToWordTyped,
  oddOneOut,
  reverseTranslation,
  synonymChoice,
  wordToMeaning,
  writeSentence,
  type Question,
} from "./questions";

export interface DailyPlan {
  date: string;
  reviewWords: Vocabulary[];
  newWords: Vocabulary[];
  questions: Question[];
  /** Words for the AI mini story. */
  storyWords: Vocabulary[];
  estimatedMinutes: number;
  reward: number;
}

/**
 * The same plan all day (seeded by date): 5 review words + 3 new words turned
 * into 8 mixed questions, then 1 synonym challenge and 1 sentence challenge.
 */
export function dailyPlan(vocab: Record<string, Vocabulary>, progress: Record<string, LearningProgress>, now = new Date()): DailyPlan {
  const date = dayKey(now);
  const rand = seededRandom(`daily:${date}`);
  const all = Object.values(vocab).sort((a, b) => a.id.localeCompare(b.id));
  const eod = endOfDay(now);

  const seen = all.filter((v) => progress[v.id] && progress[v.id].status !== "new");
  const fresh = all
    .filter((v) => !progress[v.id] || progress[v.id].status === "new")
    .sort((a, b) => (a.sourceNumber ?? 1e9) - (b.sourceNumber ?? 1e9) || a.createdAt.localeCompare(b.createdAt));

  const reviewRanked = seen
    .map((v) => ({ v, score: priorityScore(progress[v.id], now) + (isDue(progress[v.id], now, eod) ? 25 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.v);
  let reviewWords = shuffle(reviewRanked, rand).slice(0, 5);
  let newWords = fresh.slice(0, 3);
  // Early on there is little to review: fill from new words (and vice versa).
  if (reviewWords.length < 5) newWords = fresh.slice(0, 8 - reviewWords.length);
  if (newWords.length < 3) reviewWords = shuffle(reviewRanked, rand).slice(0, 8 - newWords.length);

  const eight = shuffle([...reviewWords, ...newWords], rand);
  const makers = [
    (v: Vocabulary) => clozeChoice(v, all, rand, "daily-challenge"),
    (v: Vocabulary) => meaningToWordTyped(v, "daily-challenge"),
    (v: Vocabulary) => meaningMatch(v, all, rand, "daily-challenge"),
    (v: Vocabulary) => clozeTyped(v, rand, "daily-challenge"),
    (v: Vocabulary) => reverseTranslation(v, rand, "daily-challenge"),
    (v: Vocabulary) => wordToMeaning(v, all, rand, "daily-challenge"),
  ];
  const questions: Question[] = [];
  eight.forEach((v, i) => {
    for (let k = 0; k < makers.length; k++) {
      const q = makers[(i + k) % makers.length](v);
      if (q) {
        questions.push(q);
        break;
      }
    }
  });

  const synonymSource = shuffle(eight, rand).find((v) => oddOneOut(v, all, rand) || synonymChoice(v, all, rand));
  if (synonymSource) {
    const q = oddOneOut(synonymSource, all, rand) ?? synonymChoice(synonymSource, all, rand, "daily-challenge");
    if (q) questions.push({ ...q, quizType: "daily-challenge" });
  }
  const sentenceWord = newWords[0] ?? reviewWords[0];
  if (sentenceWord) {
    questions.push(writeSentence(sentenceWord, `Write one sentence that uses “${sentenceWord.word.toLowerCase()}” naturally.`, "daily-challenge"));
  }

  return {
    date,
    reviewWords,
    newWords,
    questions,
    storyWords: eight,
    estimatedMinutes: Math.max(2, Math.round(questions.length * 0.3)),
    reward: 100,
  };
}
