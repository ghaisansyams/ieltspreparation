// Parts of the band descriptors that are rules, not judgement. They are applied
// in code so a model can neither miss them nor be talked out of them.

import type { WritingEvaluation } from "@/lib/ai/schemas";
import { toHalfBand, type TaskType } from "./band";
import { HARD_RULES } from "./rubric";

const CRITERIA = ["task", "coherence", "lexical", "grammar"] as const;

/** "Responses of 20 words or fewer are rated at Band 1" — no marking needed. */
export function isBand1Length(words: number): boolean {
  return words > 0 && words <= HARD_RULES.band1MaxWords;
}

/** The band-1 verdict for a response of 20 words or fewer. */
export function band1Evaluation(taskType: TaskType, words: number): WritingEvaluation {
  const note = `Responses of ${HARD_RULES.band1MaxWords} words or fewer are rated at Band 1 in the official IELTS Writing band descriptors. This response is ${words} ${words === 1 ? "word" : "words"} long, so it is too short to rate: there is no evidence of task achievement, organisation, vocabulary or sentence control.`;
  const criterion = (summary: string) => ({ band: 1, summary, evidence: [], improve: [`Write a complete response: at least ${taskType === "task1" ? 150 : 250} words.`] });
  return {
    taskType,
    addressesTask: false,
    offTopic: false,
    memorisedLanguage: false,
    needsReview: false,
    visualReading: "",
    criteria: {
      task: criterion(note),
      coherence: criterion("Too short to communicate a message."),
      lexical: criterion("No resource is apparent beyond a few isolated words."),
      grammar: criterion("No rateable language is evident."),
    },
    overallComment: `${note} Write a full answer and mark it again — this is practice marking, not an official IELTS result.`,
    nextBandAdvice: [
      `Plan for 3–4 minutes, then write ${taskType === "task1" ? "an overview plus two body paragraphs of detail" : "an introduction, two body paragraphs and a conclusion"}.`,
      `Aim for ${taskType === "task1" ? "170–190" : "270–300"} words so every criterion has something to rate.`,
    ],
    corrections: [],
    vocabularyUsed: [],
  };
}

/**
 * Clamp whatever the model returned to legal bands (0–9, half steps). Marking
 * stays the model's; the arithmetic does not.
 */
export function normaliseBands(evaluation: WritingEvaluation): WritingEvaluation {
  const criteria = { ...evaluation.criteria };
  for (const key of CRITERIA) {
    const c = criteria[key];
    criteria[key] = { ...c, band: Math.min(9, Math.max(0, toHalfBand(c.band))) };
  }
  return { ...evaluation, criteria };
}
