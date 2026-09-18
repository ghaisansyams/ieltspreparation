import type { ReviewNote, VocabDraft, Vocabulary } from "@/lib/types";
import { normalizeWhitespace } from "@/lib/utils";

type VocabLike = VocabDraft | Vocabulary;

export interface Example {
  index: 1 | 2 | 3;
  en: string;
  id: string;
}

export function meanings(v: VocabLike): string[] {
  return [v.meaning1, v.meaning2, v.meaning3].filter((m) => m && m.trim());
}

export function synonyms(v: VocabLike): string[] {
  return [v.synonym1, v.synonym2, v.synonym3].filter((s) => s && s.trim());
}

export function examples(v: VocabLike): Example[] {
  const list: Example[] = [
    { index: 1, en: v.example1, id: v.example1Translation },
    { index: 2, en: v.example2, id: v.example2Translation },
    { index: 3, en: v.example3, id: v.example3Translation },
  ];
  return list.filter((e) => e.en && e.en.trim());
}

const CEFR_TAG = /\s*\((?:A1|A2|B1|B2|C1|C2)(?:\s*-\s*[12])?\)/gi;
const POS_TAG = /\s*\((Noun|Verb|Adj|Adjective|Adverb|Adv)\)\s*$/i;

/** "Different (Berbeda)" → "Different"; "Commit (to) (B2)" → "Commit"; "Emerge (muncul) [..]" → "Emerge". */
export function synonymHead(raw: string): string {
  return normalizeWhitespace(raw.replace(CEFR_TAG, "").replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)/g, ""));
}

/** Indonesian gloss inside the first non-CEFR parentheses, if any. */
export function synonymGloss(raw: string): string {
  const withoutLevel = raw.replace(CEFR_TAG, "");
  const m = withoutLevel.match(/\(([^)]*)\)/);
  return m ? normalizeWhitespace(m[1]) : "";
}

export function synonymLevel(raw: string): string | null {
  const m = raw.match(/\((A1|A2|B1|B2|C1|C2)(?:\s*-\s*[12])?\)/i);
  return m ? m[0].slice(1, -1).toUpperCase() : null;
}

/** "Diwajibkan (Verb)" → { text: "Diwajibkan", pos: "Verb" }. */
export function splitMeaning(raw: string): { text: string; pos: string | null } {
  const m = raw.match(POS_TAG);
  if (!m) return { text: raw.trim(), pos: null };
  return { text: raw.replace(POS_TAG, "").trim(), pos: m[1] };
}

export function shortMeaning(v: VocabLike, max = 2): string {
  const list = meanings(v).slice(0, max).map((m) => splitMeaning(m).text.replace(/\.$/, ""));
  return list.join(" / ");
}

export function allMeaningsText(v: VocabLike): string {
  return meanings(v)
    .map((m) => splitMeaning(m).text.replace(/\.$/, ""))
    .join(" / ");
}

export function synonymHeads(v: VocabLike): string[] {
  return synonyms(v).map(synonymHead).filter(Boolean);
}

/** Lower-case key used for duplicate detection and linking. */
export function wordKey(word: string): string {
  return normalizeWhitespace(word).toLowerCase();
}

/**
 * Generic completeness check. Missing data is flagged, never invented.
 */
export function autoReviewNotes(v: VocabLike): ReviewNote[] {
  const notes: ReviewNote[] = [];
  const missing: string[] = [];
  if (!v.pronunciation.trim()) missing.push("pronunciation");
  if (!v.partOfSpeech.trim()) missing.push("part of speech");
  if (meanings(v).length === 0) missing.push("meaning");
  if (examples(v).length === 0) missing.push("example sentences");
  if (missing.length) {
    notes.push({ kind: "incomplete", text: `Missing ${missing.join(", ")}.` });
  }
  const untranslated = examples(v).filter((e) => !e.id.trim()).length;
  if (untranslated) {
    notes.push({ kind: "suggestion", text: `${untranslated} example${untranslated > 1 ? "s have" : " has"} no Indonesian translation.` });
  }
  return notes;
}

export function hasIncomplete(notes: ReviewNote[]): boolean {
  return notes.some((n) => n.kind === "incomplete");
}

export function emptyDraft(word = ""): VocabDraft {
  return {
    sourceNumber: null,
    word,
    pronunciation: "",
    partOfSpeech: "",
    meaning1: "",
    meaning2: "",
    meaning3: "",
    synonym1: "",
    synonym2: "",
    synonym3: "",
    example1: "",
    example1Translation: "",
    example2: "",
    example2Translation: "",
    example3: "",
    example3Translation: "",
    cefr: null,
    cefrSource: "estimated",
    definition: "",
    difficulty: null,
    frequency: null,
    tags: [],
    wordFamily: [],
    collocations: [],
    commonMistakes: [],
    ieltsRelevance: null,
    origin: "manual",
    aiFields: [],
    needsReview: false,
    reviewNotes: [],
    contexts: null,
  };
}
