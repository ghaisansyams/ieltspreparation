// Domain model. Mirrors supabase/migrations/0001_init.sql (camelCase here,
// snake_case in Postgres — see src/lib/sync/mapping.ts).
//
// The vocabulary shape deliberately stays FLAT (meaning1..3, synonym1..3,
// example1..3 + translations) because that is the structure of the source
// spreadsheet/PDF. Nothing is collapsed into "word + meaning".

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/**
 * Where the CEFR value came from.
 * - `source`    written in the user's own document (e.g. "Multitude (C1)")
 * - `estimated` estimated automatically (seed estimate, AI or heuristic) — never presented as fact
 * - `manual`    chosen/verified by the user
 */
export type CefrSource = "source" | "estimated" | "manual";

export const FREQUENCIES = ["very common", "common", "less common", "rare"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const IELTS_SKILLS = [
  "Academic",
  "Writing Task 1",
  "Writing Task 2",
  "Speaking",
  "Reading",
  "Listening",
] as const;
export type IeltsSkill = (typeof IELTS_SKILLS)[number];

export interface IeltsRelevance {
  level: "high" | "medium" | "low";
  skills: IeltsSkill[];
  note?: string;
}

export type VocabOrigin = "source-pdf" | "import" | "manual" | "ai-generated";

/** Fields whose current value was produced by AI and has not been verified. */
export const AI_FIELDS = [
  "pronunciation",
  "partOfSpeech",
  "meanings",
  "synonyms",
  "examples",
  "cefr",
  "definition",
  "difficulty",
  "frequency",
  "tags",
  "wordFamily",
  "collocations",
  "commonMistakes",
  "ieltsRelevance",
] as const;
export type AiField = (typeof AI_FIELDS)[number];

export interface ReviewNote {
  /** `incomplete` flags the entry as Needs Review; `suggestion` is informational. */
  kind: "incomplete" | "suggestion";
  text: string;
}

export interface UsageContext {
  register: "formal" | "casual" | "academic" | "work" | "ielts";
  sentence: string;
  translation: string;
  note: string;
}

export interface UsageContexts {
  contexts: UsageContext[];
  appropriateness: string;
  generatedAt: string;
}

export interface Vocabulary {
  id: string;
  /** Original row number from the source document, when imported from one. */
  sourceNumber: number | null;
  word: string;
  pronunciation: string;
  partOfSpeech: string;

  meaning1: string;
  meaning2: string;
  meaning3: string;

  synonym1: string;
  synonym2: string;
  synonym3: string;

  example1: string;
  example1Translation: string;
  example2: string;
  example2Translation: string;
  example3: string;
  example3Translation: string;

  cefr: CefrLevel | null;
  cefrSource: CefrSource;

  /** Short English definition (used by Meaning Match and the tutor). */
  definition: string;
  /** 1 (easy) – 5 (hard). */
  difficulty: number | null;
  frequency: Frequency | null;
  tags: string[];

  wordFamily: string[];
  collocations: string[];
  commonMistakes: string[];
  ieltsRelevance: IeltsRelevance | null;

  origin: VocabOrigin;
  aiFields: AiField[];
  needsReview: boolean;
  reviewNotes: ReviewNote[];
  /** Cached "Use This Word" output. */
  contexts: UsageContexts | null;

  createdAt: string;
  updatedAt: string;
}

/** A vocabulary entry that has not been saved yet (form state, import preview, AI draft). */
export type VocabDraft = Omit<Vocabulary, "id" | "createdAt" | "updatedAt"> & { id?: string };

export type LearningStatus = "new" | "learning" | "review" | "mastered";

export const EXERCISE_TYPES = [
  "flashcard",
  "multiple-choice",
  "sentence-completion",
  "reverse-translation",
  "synonym-match",
  "use-it",
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export interface LearningProgress {
  id: string;
  vocabularyId: string;
  status: LearningStatus;
  /** 0–100 */
  mastery: number;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  /** Consecutive correct answers. */
  streak: number;
  /** 0–1, exponential moving average of recall quality. */
  confidence: number;
  easeFactor: number;
  intervalDays: number;
  lapses: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  lastExerciseType: ExerciseType | null;
  updatedAt: string;
}

export const QUIZ_TYPES = [
  "review",
  "flashcard-rush",
  "multiple-choice",
  "synonym-match",
  "meaning-match",
  "sentence-completion",
  "reverse-translation",
  "cefr-challenge",
  "odd-one-out",
  "boss-battle",
  "daily-challenge",
  "ielts",
] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

export interface QuizAttempt {
  id: string;
  vocabularyId: string;
  quizType: QuizType;
  isCorrect: boolean;
  /** milliseconds */
  responseTime: number;
  createdAt: string;
}

export type Rating = "again" | "hard" | "good" | "easy";

export interface DayActivity {
  reviews: number;
  correct: number;
  incorrect: number;
  xp: number;
  wordsAdded: number;
  sentences: number;
}

export interface DailyChallengeResult {
  score: number;
  total: number;
  completedAt: string;
}

export interface Settings {
  dailyReviewGoal: number;
  newWordsPerDay: number;
  voice: "en-US" | "en-GB";
  /** Sent as x-app-token to /api/ai/* when the server sets APP_ACCESS_TOKEN. */
  accessToken: string;
}

export interface Profile {
  displayName: string;
  xp: number;
  /** achievement id → unlocked at (ISO) */
  achievements: Record<string, string>;
  /** yyyy-mm-dd → result */
  dailyChallenges: Record<string, DailyChallengeResult>;
  /** yyyy-mm-dd → activity */
  activity: Record<string, DayActivity>;
  settings: Settings;
  updatedAt: string;
}
