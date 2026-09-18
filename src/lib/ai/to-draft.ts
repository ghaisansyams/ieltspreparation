import { difficultyFromCefr, parseHeadword } from "@/lib/cefr";
import type { AiField, ReviewNote, VocabDraft, Vocabulary } from "@/lib/types";
import { autoReviewNotes, emptyDraft, hasIncomplete } from "@/lib/vocab/fields";
import { clamp } from "@/lib/utils";
import type { Enhancement, ExtractedEntry, GeneratedVocab } from "./schemas";

const FIELD_ALIASES: Record<string, AiField> = {
  pronunciation: "pronunciation",
  partofspeech: "partOfSpeech",
  meanings: "meanings",
  meaning: "meanings",
  synonyms: "synonyms",
  examples: "examples",
  cefr: "cefr",
  definition: "definition",
  difficulty: "difficulty",
  frequency: "frequency",
  tags: "tags",
  wordfamily: "wordFamily",
  collocations: "collocations",
  commonmistakes: "commonMistakes",
  ieltsrelevance: "ieltsRelevance",
};

export function uncertainToFields(list: string[]): AiField[] {
  return [...new Set(list.map((f) => FIELD_ALIASES[f.replace(/[^a-z]/gi, "").toLowerCase()]).filter(Boolean))];
}

/** A fully AI-generated entry: every field is marked AI; uncertainty → Needs Review. */
export function generatedToDraft(g: GeneratedVocab): VocabDraft {
  const d = emptyDraft(g.word.trim());
  d.origin = "ai-generated";
  d.pronunciation = g.pronunciation;
  d.partOfSpeech = g.partOfSpeech;
  [d.meaning1, d.meaning2, d.meaning3] = [g.meanings[0] ?? "", g.meanings[1] ?? "", g.meanings[2] ?? ""];
  const syn = g.synonyms.slice(0, 3).map((s) => (s.translation ? `${s.word} (${s.translation})` : s.word));
  [d.synonym1, d.synonym2, d.synonym3] = [syn[0] ?? "", syn[1] ?? "", syn[2] ?? ""];
  [d.example1, d.example1Translation] = [g.examples[0]?.sentence ?? "", g.examples[0]?.translation ?? ""];
  [d.example2, d.example2Translation] = [g.examples[1]?.sentence ?? "", g.examples[1]?.translation ?? ""];
  [d.example3, d.example3Translation] = [g.examples[2]?.sentence ?? "", g.examples[2]?.translation ?? ""];
  d.definition = g.definition;
  d.cefr = g.cefr;
  d.cefrSource = "estimated";
  d.difficulty = Math.round(clamp(g.difficulty, 1, 5));
  d.frequency = g.frequency;
  d.wordFamily = g.wordFamily.slice(0, 8);
  d.collocations = g.collocations.slice(0, 8);
  d.commonMistakes = g.commonMistakes.slice(0, 5);
  d.ieltsRelevance = g.ieltsRelevance;
  d.tags = g.tags.slice(0, 4);
  d.aiFields = ["pronunciation", "partOfSpeech", "meanings", "synonyms", "examples", "cefr", "definition", "difficulty", "frequency", "wordFamily", "collocations", "commonMistakes", "ieltsRelevance", "tags"];

  const uncertain = uncertainToFields(g.uncertainFields);
  const notes: ReviewNote[] = [];
  if (uncertain.length) notes.push({ kind: "incomplete", text: `The AI was unsure about: ${uncertain.join(", ")}.` });
  if (g.cefrConfidence === "low") notes.push({ kind: "suggestion", text: "CEFR estimate has low confidence." });
  notes.push(...autoReviewNotes(d));
  d.reviewNotes = notes;
  d.needsReview = hasIncomplete(notes);
  return d;
}

/** An entry transcribed by AI from the learner's document: the text is theirs, not AI-authored. */
export function extractedToDraft(e: ExtractedEntry): VocabDraft {
  const { word, cefr } = parseHeadword(e.word);
  const d = emptyDraft(word);
  d.origin = "import";
  d.sourceNumber = e.number ?? null;
  d.pronunciation = e.pronunciation;
  d.partOfSpeech = e.partOfSpeech;
  const m = e.meanings.filter((x) => x && x.trim() !== "-");
  [d.meaning1, d.meaning2, d.meaning3] = [m[0] ?? "", m[1] ?? "", m[2] ?? ""];
  const s = e.synonyms.filter((x) => x && x.trim() !== "-");
  [d.synonym1, d.synonym2, d.synonym3] = [s[0] ?? "", s[1] ?? "", s[2] ?? ""];
  const ex = e.examples.filter((x) => x.sentence && x.sentence.trim() !== "-");
  [d.example1, d.example1Translation] = [ex[0]?.sentence ?? "", ex[0]?.translation ?? ""];
  [d.example2, d.example2Translation] = [ex[1]?.sentence ?? "", ex[1]?.translation ?? ""];
  [d.example3, d.example3Translation] = [ex[2]?.sentence ?? "", ex[2]?.translation ?? ""];
  const level = cefr ?? e.cefr;
  if (level) {
    d.cefr = level;
    d.cefrSource = "source";
    d.difficulty = difficultyFromCefr(level);
  }
  const notes: ReviewNote[] = autoReviewNotes(d);
  if (e.incomplete && !hasIncomplete(notes)) notes.push({ kind: "incomplete", text: "This row looked incomplete in the document." });
  if (e.note.trim()) notes.push({ kind: "suggestion", text: e.note.trim() });
  d.reviewNotes = notes;
  d.needsReview = hasIncomplete(notes);
  return d;
}

export interface ProposedChange {
  field: AiField;
  label: string;
  current: string;
  proposed: string;
  patch: Partial<Vocabulary>;
}

const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));

/**
 * AI enhancement never silently overwrites: it only proposes values for
 * fields that are empty or still AI-owned, and the learner accepts each one.
 */
export function proposeEnhancement(v: Vocabulary, e: Enhancement): ProposedChange[] {
  const editable = (field: AiField, empty: boolean) => empty || v.aiFields.includes(field);
  const out: ProposedChange[] = [];
  const add = (field: AiField, label: string, empty: boolean, current: unknown, proposed: unknown, patch: Partial<Vocabulary>) => {
    if (!editable(field, empty)) return;
    if (show(current) === show(proposed) || !show(proposed)) return;
    out.push({ field, label, current: show(current), proposed: show(proposed), patch });
  };
  add("definition", "Definition", !v.definition, v.definition, e.definition, { definition: e.definition });
  if (v.cefrSource === "estimated") add("cefr", "Estimated CEFR", !v.cefr, v.cefr, e.cefr, { cefr: e.cefr, cefrSource: "estimated" });
  const difficulty = Math.round(clamp(e.difficulty, 1, 5));
  add("difficulty", "Difficulty", v.difficulty === null, v.difficulty, difficulty, { difficulty });
  add("frequency", "Frequency", !v.frequency, v.frequency, e.frequency, { frequency: e.frequency });
  add("wordFamily", "Word family", !v.wordFamily.length, v.wordFamily, e.wordFamily, { wordFamily: e.wordFamily.slice(0, 8) });
  add("collocations", "Collocations", !v.collocations.length, v.collocations, e.collocations, { collocations: e.collocations.slice(0, 8) });
  add("commonMistakes", "Common mistakes", !v.commonMistakes.length, v.commonMistakes, e.commonMistakes, { commonMistakes: e.commonMistakes.slice(0, 5) });
  add("ieltsRelevance", "IELTS relevance", !v.ieltsRelevance, v.ieltsRelevance ? `${v.ieltsRelevance.level} · ${v.ieltsRelevance.skills.join(", ")}` : "", `${e.ieltsRelevance.level} · ${e.ieltsRelevance.skills.join(", ")}`, { ieltsRelevance: e.ieltsRelevance });
  add("tags", "Tags", !v.tags.length, v.tags, e.tags, { tags: e.tags.slice(0, 4) });
  return out;
}
