import { z } from "zod";
import { CEFR_LEVELS, FREQUENCIES, IELTS_SKILLS } from "@/lib/types";

// Schemas for every structured AI response. They are sent to the provider as
// JSON Schema (structured outputs) AND used to validate what comes back, so
// the UI never trusts unvalidated model output. Numeric ranges are clamped
// after parsing rather than encoded as schema constraints.

const Cefr = z.enum(CEFR_LEVELS);
const Confidence = z.enum(["high", "medium", "low"]);

export const IeltsRelevanceSchema = z.object({
  level: z.enum(["high", "medium", "low"]),
  skills: z.array(z.enum(IELTS_SKILLS)),
  note: z.string().describe("One sentence on how the word is useful for IELTS."),
});

export const ExampleSchema = z.object({
  sentence: z.string().describe("Natural English example sentence using the word."),
  translation: z.string().describe("Natural Indonesian translation of the sentence."),
});

export const GeneratedVocabSchema = z.object({
  word: z.string(),
  pronunciation: z.string().describe("IPA between slashes, e.g. /səˈfɪs.tɪ.keɪ.tɪd/"),
  partOfSpeech: z.string().describe("e.g. Adjective, Verb, Noun, Verb/Noun"),
  meanings: z.array(z.string()).describe("1–3 Indonesian meanings, most common first. Add (Verb)/(Noun) when senses differ by part of speech."),
  synonyms: z.array(z.object({ word: z.string(), translation: z.string() })).describe("Up to 3 English synonyms with an Indonesian gloss."),
  examples: z.array(ExampleSchema).describe("Exactly 3 examples showing different senses or contexts."),
  definition: z.string().describe("Short learner-friendly English definition."),
  cefr: Cefr,
  cefrConfidence: Confidence,
  difficulty: z.number().describe("1 (easy) to 5 (hard) for an Indonesian learner."),
  frequency: z.enum(FREQUENCIES),
  wordFamily: z.array(z.string()).describe("Related forms, e.g. distinction, distinctive, distinguish."),
  collocations: z.array(z.string()),
  commonMistakes: z.array(z.string()).describe("Typical mistakes Indonesian learners make with this word."),
  ieltsRelevance: IeltsRelevanceSchema,
  tags: z.array(z.string()).describe("1–3 short topical tags."),
  uncertainFields: z.array(z.string()).describe("Names of fields you are not confident about; empty if none."),
});
export type GeneratedVocab = z.infer<typeof GeneratedVocabSchema>;

export const EnhancementSchema = z.object({
  definition: z.string(),
  cefr: Cefr,
  cefrConfidence: Confidence,
  difficulty: z.number(),
  frequency: z.enum(FREQUENCIES),
  wordFamily: z.array(z.string()),
  collocations: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  ieltsRelevance: IeltsRelevanceSchema,
  tags: z.array(z.string()),
  uncertainFields: z.array(z.string()),
});
export type Enhancement = z.infer<typeof EnhancementSchema>;

export const CefrBatchSchema = z.object({
  items: z.array(z.object({ word: z.string(), cefr: Cefr, confidence: Confidence })),
});

export const ExtractedEntrySchema = z.object({
  number: z.number().nullable().describe("Row number printed in the document, or null."),
  word: z.string(),
  pronunciation: z.string().describe("Exactly as printed; empty string if absent."),
  partOfSpeech: z.string().describe("Exactly as printed; empty string if absent."),
  meanings: z.array(z.string()).describe("Meaning 1–3 exactly as printed, excluding '-' placeholders."),
  synonyms: z.array(z.string()).describe("Synonym 1–3 exactly as printed, including any (gloss)."),
  examples: z.array(ExampleSchema).describe("Examples exactly as printed; translation empty if none."),
  cefr: Cefr.nullable().describe("Only if the document itself states a level."),
  incomplete: z.boolean().describe("True when the row is missing meaning, examples, pronunciation or type."),
  note: z.string().describe("Short note on anything unclear in this row; empty if nothing."),
});
export const ExtractionSchema = z.object({ entries: z.array(ExtractedEntrySchema) });
export type ExtractedEntry = z.infer<typeof ExtractedEntrySchema>;

const Score = z.object({ score: z.number().describe("1–5"), comment: z.string() });
export const EvaluationSchema = z.object({
  usesTargetWord: z.boolean(),
  targetWordUsedCorrectly: z.boolean(),
  grammar: Score,
  vocabularyUsage: Score,
  naturalness: Score,
  context: Score,
  cefrAppropriateness: Score,
  overall: z.string().describe("Two sentences of encouraging, specific feedback."),
  suggestions: z.array(z.object({ issue: z.string(), suggestion: z.string(), why: z.string() })),
  improvedVersion: z.string().describe("A suggested improved sentence, offered — never imposed."),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

const WritingCriterionSchema = z.object({
  band: z.number().describe("Band 0–9 in half-band steps (e.g. 6, 6.5, 7)."),
  summary: z.string().describe("One or two sentences explaining that band against the descriptor for this criterion."),
  evidence: z.array(z.string()).describe("Short quotes taken from the candidate's own text that justify the band."),
  improve: z.array(z.string()).describe("Concrete changes that would move this criterion up half a band."),
});

export const WritingEvaluationSchema = z.object({
  taskType: z.enum(["task1", "task2"]),
  addressesTask: z.boolean().describe("Does the response actually answer the question set?"),
  offTopic: z.boolean(),
  memorisedLanguage: z.boolean().describe("True if large chunks look memorised or copied from the prompt."),
  needsReview: z.boolean().describe("True if anything (an unreadable image, an unclear task) made the marking uncertain."),
  visualReading: z.string().describe("Task 1 only: what the chart, table or diagram shows, as you read it — chart type, variables, units, period, main trends. Empty string for Task 2."),
  criteria: z.object({
    task: WritingCriterionSchema.describe("Task Achievement (Task 1) or Task Response (Task 2)."),
    coherence: WritingCriterionSchema.describe("Coherence and Cohesion."),
    lexical: WritingCriterionSchema.describe("Lexical Resource."),
    grammar: WritingCriterionSchema.describe("Grammatical Range and Accuracy."),
  }),
  overallComment: z.string().describe("Two or three sentences: what an examiner would notice first."),
  nextBandAdvice: z.array(z.string()).describe("The 2–4 highest-value changes for the next attempt."),
  corrections: z.array(
    z.object({ original: z.string().describe("Quote from the candidate."), suggestion: z.string(), why: z.string() }),
  ).describe("Up to 8 precise corrections. Never rewrite the whole response."),
  vocabularyUsed: z.array(
    z.object({ word: z.string(), usedWell: z.boolean(), comment: z.string() }),
  ).describe("Only words from the learner's saved list that appear in the response."),
});
export type WritingEvaluation = z.infer<typeof WritingEvaluationSchema>;

export const ContextsSchema = z.object({
  contexts: z.array(
    z.object({
      register: z.enum(["formal", "casual", "academic", "work", "ielts"]),
      sentence: z.string(),
      translation: z.string(),
      note: z.string().describe("When and why the word fits (or feels stiff) in this register."),
    }),
  ),
  appropriateness: z.string().describe("Overall guidance on where the word is natural and where to avoid it."),
});

export const StorySchema = z.object({
  title: z.string(),
  story: z.string().describe("The story. Wrap every target word (in whatever form it appears) in [[double brackets]]."),
  translation: z.string().describe("Natural Indonesian translation of the story."),
});
export type Story = z.infer<typeof StorySchema>;
