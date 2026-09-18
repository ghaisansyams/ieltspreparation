import type { LearningProgress, QuizType, Vocabulary } from "@/lib/types";
import {
  buildSet,
  cefrQuestion,
  clozeChoice,
  clozeTyped,
  meaningMatch,
  meaningToWordTyped,
  oddOneOut,
  pickWords,
  reverseTranslation,
  synonymChoice,
  type Question,
  type Rand,
} from "./questions";

export type GameId =
  | "flashcard-rush"
  | "multiple-choice"
  | "synonym-match"
  | "meaning-match"
  | "sentence-completion"
  | "reverse-translation"
  | "cefr-challenge"
  | "odd-one-out"
  | "boss-battle";

export interface GameDef {
  id: GameId;
  number: number;
  title: string;
  tagline: string;
  skill: "Recall" | "Recognition" | "Context" | "Nuance" | "Challenge";
  quizType: QuizType;
  rounds: number;
  /** Seconds per question; null = untimed. */
  timer: number | null;
  /** Minimum library size the game needs to produce good distractors. */
  minWords: number;
  build?: (pool: Vocabulary[], progress: Record<string, LearningProgress>, rand: Rand) => Question[];
}

const oversample = (pool: Vocabulary[], progress: Record<string, LearningProgress>, n: number, rand: Rand) =>
  pickWords(pool, progress, Math.min(pool.length, n * 4), rand);

export const GAMES: GameDef[] = [
  {
    id: "flashcard-rush",
    number: 1,
    title: "Flashcard Rush",
    tagline: "See the meaning, type the word. Ten seconds each.",
    skill: "Recall",
    quizType: "flashcard-rush",
    rounds: 12,
    timer: 10,
    minWords: 4,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 12, rand), 12, (v) => meaningToWordTyped(v)),
  },
  {
    id: "multiple-choice",
    number: 2,
    title: "Multiple Choice",
    tagline: "Fill the gap in a real sentence from your notes.",
    skill: "Context",
    quizType: "multiple-choice",
    rounds: 10,
    timer: null,
    minWords: 8,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => clozeChoice(v, pool, rand)),
  },
  {
    id: "synonym-match",
    number: 3,
    title: "Synonym Match",
    tagline: "Link each word to the synonym that fits.",
    skill: "Nuance",
    quizType: "synonym-match",
    rounds: 10,
    timer: null,
    minWords: 8,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => synonymChoice(v, pool, rand)),
  },
  {
    id: "meaning-match",
    number: 4,
    title: "Meaning Match",
    tagline: "Read a definition, find the word.",
    skill: "Recognition",
    quizType: "meaning-match",
    rounds: 10,
    timer: null,
    minWords: 8,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => meaningMatch(v, pool, rand)),
  },
  {
    id: "sentence-completion",
    number: 5,
    title: "Sentence Completion",
    tagline: "Type the missing word — in the right form.",
    skill: "Context",
    quizType: "sentence-completion",
    rounds: 10,
    timer: null,
    minWords: 4,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => clozeTyped(v, rand)),
  },
  {
    id: "reverse-translation",
    number: 6,
    title: "Reverse Translation",
    tagline: "From Indonesian back to English.",
    skill: "Recall",
    quizType: "reverse-translation",
    rounds: 10,
    timer: null,
    minWords: 4,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => reverseTranslation(v, rand)),
  },
  {
    id: "cefr-challenge",
    number: 7,
    title: "CEFR Challenge",
    tagline: "Guess how advanced each word is.",
    skill: "Nuance",
    quizType: "cefr-challenge",
    rounds: 10,
    timer: null,
    minWords: 4,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => cefrQuestion(v)),
  },
  {
    id: "odd-one-out",
    number: 8,
    title: "Odd One Out",
    tagline: "Three belong together. One doesn't.",
    skill: "Nuance",
    quizType: "odd-one-out",
    rounds: 10,
    timer: null,
    minWords: 8,
    build: (pool, progress, rand) => buildSet(oversample(pool, progress, 10, rand), 10, (v) => oddOneOut(v, pool, rand)),
  },
  {
    id: "boss-battle",
    number: 9,
    title: "Vocabulary Boss Battle",
    tagline: "Ten questions. Difficulty adapts to every answer.",
    skill: "Challenge",
    quizType: "boss-battle",
    rounds: 10,
    timer: null,
    minWords: 12,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);
