// IELTS Writing scoring rules.
//
// Public, factual rules of the test (not the copyrighted descriptor text):
//  • Each task is judged on FOUR criteria, each 0–9 in half-band steps.
//      Task 1: Task Achievement · Coherence and Cohesion · Lexical Resource ·
//              Grammatical Range and Accuracy
//      Task 2: Task Response (instead of Task Achievement) + the same three.
//  • The task band is the average of the four, rounded to the nearest half band
//    (an average ending in .25 or .75 rounds up).
//  • Minimum lengths: Task 1 ≥ 150 words, Task 2 ≥ 250 words. Writing under the
//    limit is penalised under Task Achievement / Task Response.
//  • In the real test both tasks are combined for one Writing score, with
//    Task 2 weighted twice as heavily as Task 1. This app scores one task at a
//    time, so it reports that task's band only.

export type TaskType = "task1" | "task2";

export type CriterionKey = "task" | "coherence" | "lexical" | "grammar";

export interface CriterionMeta {
  key: CriterionKey;
  /** Official name for the task type. */
  name: string;
  abbr: string;
  what: string;
}

export function criteria(task: TaskType): CriterionMeta[] {
  return [
    {
      key: "task",
      name: task === "task1" ? "Task Achievement" : "Task Response",
      abbr: task === "task1" ? "TA" : "TR",
      what:
        task === "task1"
          ? "Covering the requirements: a clear overview, accurate key features and correctly reported data."
          : "Answering every part of the question with a clear position, developed ideas and relevant support.",
    },
    { key: "coherence", name: "Coherence and Cohesion", abbr: "CC", what: "Logical progression, paragraphing and linking that never feels mechanical." },
    { key: "lexical", name: "Lexical Resource", abbr: "LR", what: "Range, precision and collocation of vocabulary, including spelling and word formation." },
    { key: "grammar", name: "Grammatical Range and Accuracy", abbr: "GRA", what: "Range of structures, plus accuracy of grammar and punctuation." },
  ];
}

export const MIN_WORDS: Record<TaskType, number> = { task1: 150, task2: 250 };
export const TIME_MINUTES: Record<TaskType, number> = { task1: 20, task2: 40 };

/** IELTS counts words, not characters; hyphenated words count as one. */
export function countWords(text: string): number {
  const cleaned = text.replace(/[^\p{L}\p{N}'’\-\s]/gu, " ").trim();
  return cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
}

export function isValidBand(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 9 && Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;
}

/** Clamp to the 0–9 scale in half-band steps. */
export function toHalfBand(n: number): number {
  return Math.min(9, Math.max(0, Math.round(n * 2) / 2));
}

/**
 * Overall band for one task: mean of the four criteria, rounded to the nearest
 * half band, with .25 and .75 rounding up (Math.round is half-up, which is
 * exactly that rule once the mean is doubled).
 */
export function overallBand(scores: Record<CriterionKey, number>): number {
  const values = (["task", "coherence", "lexical", "grammar"] as CriterionKey[]).map((k) => toHalfBand(scores[k]));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(mean * 2) / 2;
}

/** How far under the word limit, and the note the learner should see. */
export function lengthPenalty(task: TaskType, words: number): { under: boolean; missing: number; note: string } {
  const min = MIN_WORDS[task];
  const missing = Math.max(0, min - words);
  return {
    under: missing > 0,
    missing,
    note: missing
      ? `${words} words — ${missing} under the ${min}-word minimum. In the real test this is penalised under ${task === "task1" ? "Task Achievement" : "Task Response"}.`
      : `${words} words — over the ${min}-word minimum.`,
  };
}

export const BAND_SUMMARY: Record<number, string> = {
  9: "Expert — fully operational command",
  8: "Very good — fully operational with occasional lapses",
  7: "Good — operational command, occasional inaccuracies",
  6: "Competent — generally effective despite inaccuracies",
  5: "Modest — partial command, many mistakes",
  4: "Limited — basic competence in familiar situations",
  3: "Extremely limited — conveys only general meaning",
  2: "Intermittent — great difficulty understanding and expressing",
  1: "Non-user — no ability beyond isolated words",
  0: "Did not attempt",
};

export function bandLabel(band: number): string {
  return BAND_SUMMARY[Math.floor(band)] ?? "";
}
