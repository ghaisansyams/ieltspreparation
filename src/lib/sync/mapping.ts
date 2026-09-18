import type { LearningProgress, Profile, QuizAttempt, Vocabulary } from "@/lib/types";

// camelCase (app) ↔ snake_case (Postgres). Mirrors supabase/migrations/0001_init.sql.

export type Row = Record<string, unknown>;

const VOCAB_COLUMNS: [keyof Vocabulary, string][] = [
  ["id", "id"],
  ["sourceNumber", "source_number"],
  ["word", "word"],
  ["pronunciation", "pronunciation"],
  ["partOfSpeech", "part_of_speech"],
  ["meaning1", "meaning1"],
  ["meaning2", "meaning2"],
  ["meaning3", "meaning3"],
  ["synonym1", "synonym1"],
  ["synonym2", "synonym2"],
  ["synonym3", "synonym3"],
  ["example1", "example1"],
  ["example1Translation", "example1_translation"],
  ["example2", "example2"],
  ["example2Translation", "example2_translation"],
  ["example3", "example3"],
  ["example3Translation", "example3_translation"],
  ["cefr", "cefr"],
  ["cefrSource", "cefr_source"],
  ["definition", "definition"],
  ["difficulty", "difficulty"],
  ["frequency", "frequency"],
  ["tags", "tags"],
  ["wordFamily", "word_family"],
  ["collocations", "collocations"],
  ["commonMistakes", "common_mistakes"],
  ["ieltsRelevance", "ielts_relevance"],
  ["origin", "origin"],
  ["aiFields", "ai_fields"],
  ["needsReview", "needs_review"],
  ["reviewNotes", "review_notes"],
  ["contexts", "contexts"],
  ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
];

const PROGRESS_COLUMNS: [keyof LearningProgress, string][] = [
  ["id", "id"],
  ["vocabularyId", "vocabulary_id"],
  ["status", "status"],
  ["mastery", "mastery"],
  ["reviewCount", "review_count"],
  ["correctCount", "correct_count"],
  ["incorrectCount", "incorrect_count"],
  ["streak", "streak"],
  ["confidence", "confidence"],
  ["easeFactor", "ease_factor"],
  ["intervalDays", "interval_days"],
  ["lapses", "lapses"],
  ["lastReviewedAt", "last_reviewed_at"],
  ["nextReviewAt", "next_review_at"],
  ["lastExerciseType", "last_exercise_type"],
  ["updatedAt", "updated_at"],
];

function toRow<T>(userId: string, obj: T, cols: [keyof T, string][]): Row {
  const row: Row = { user_id: userId };
  for (const [key, col] of cols) row[col] = obj[key];
  return row;
}

function fromRow<T>(row: Row, cols: [keyof T, string][]): T {
  const obj: Record<string, unknown> = {};
  for (const [key, col] of cols) obj[key as string] = row[col];
  return obj as T;
}

export const vocabToRow = (userId: string, v: Vocabulary) => toRow(userId, v, VOCAB_COLUMNS);
export const rowToVocab = (row: Row): Vocabulary => {
  const v = fromRow<Vocabulary>(row, VOCAB_COLUMNS);
  return { ...v, tags: v.tags ?? [], wordFamily: v.wordFamily ?? [], collocations: v.collocations ?? [], commonMistakes: v.commonMistakes ?? [], aiFields: v.aiFields ?? [], reviewNotes: v.reviewNotes ?? [] };
};
export const progressToRow = (userId: string, p: LearningProgress) => toRow(userId, p, PROGRESS_COLUMNS);
export const rowToProgress = (row: Row): LearningProgress => ({ ...fromRow<LearningProgress>(row, PROGRESS_COLUMNS), confidence: Number(row.confidence), easeFactor: Number(row.ease_factor) });

export const attemptToRow = (userId: string, a: QuizAttempt): Row => ({
  user_id: userId,
  id: a.id,
  vocabulary_id: a.vocabularyId,
  quiz_type: a.quizType,
  is_correct: a.isCorrect,
  response_time: a.responseTime,
  created_at: a.createdAt,
});
export const rowToAttempt = (row: Row): QuizAttempt => ({
  id: String(row.id),
  vocabularyId: String(row.vocabulary_id),
  quizType: row.quiz_type as QuizAttempt["quizType"],
  isCorrect: !!row.is_correct,
  responseTime: Number(row.response_time),
  createdAt: String(row.created_at),
});

export const profileToRow = (userId: string, p: Profile): Row => ({
  user_id: userId,
  display_name: p.displayName,
  xp: p.xp,
  achievements: p.achievements,
  daily_challenges: p.dailyChallenges,
  activity: p.activity,
  settings: { ...p.settings, accessToken: "" },
  updated_at: p.updatedAt,
});
export const rowToProfile = (row: Row): Profile => ({
  displayName: String(row.display_name ?? ""),
  xp: Number(row.xp ?? 0),
  achievements: (row.achievements as Profile["achievements"]) ?? {},
  dailyChallenges: (row.daily_challenges as Profile["dailyChallenges"]) ?? {},
  activity: (row.activity as Profile["activity"]) ?? {},
  settings: row.settings as Profile["settings"],
  updatedAt: String(row.updated_at),
});
