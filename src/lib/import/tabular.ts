import { parseHeadword, toCefr } from "@/lib/cefr";
import type { VocabDraft } from "@/lib/types";
import { autoReviewNotes, emptyDraft, hasIncomplete } from "@/lib/vocab/fields";
import { normalizeWhitespace } from "@/lib/utils";

// Maps spreadsheet-like rows (CSV, TSV, XLSX) onto the vocabulary structure.
// Recognises the original sheet's headers ("Vocab", "Pronounciation", "Means 2",
// "Sinonim", "Example 3", …) as well as English equivalents.

type Column =
  | { kind: "number" }
  | { kind: "word" }
  | { kind: "pronunciation" }
  | { kind: "pos" }
  | { kind: "meaning"; slot?: number }
  | { kind: "synonym"; slot?: number }
  | { kind: "example"; slot?: number }
  | { kind: "translation"; slot?: number }
  | { kind: "cefr" }
  | { kind: "tags" }
  | { kind: "definition" }
  | { kind: "ignore" };

function classifyHeader(raw: string): Column {
  const h = normalizeWhitespace(String(raw ?? "")).toLowerCase();
  const slotMatch = h.match(/(\d)\s*$/);
  const slot = slotMatch ? Number(slotMatch[1]) : undefined;
  if (/^(no\.?|#|number|nomor|e|id)$/.test(h)) return { kind: "number" };
  if (/^(vocab|vocabulary|word|kata|headword|term)$/.test(h)) return { kind: "word" };
  if (/^(pron|pronun|pronoun|ipa)/.test(h)) return { kind: "pronunciation" };
  if (/^(type|part of speech|pos|word class|jenis)$/.test(h)) return { kind: "pos" };
  if (/(translation|terjemah|arti contoh)/.test(h)) return { kind: "translation", slot };
  if (/^(means?|meaning|arti|definisi)\b/.test(h)) return { kind: "meaning", slot };
  if (/^(sinonim|synonyms?)\b/.test(h)) return { kind: "synonym", slot: undefined };
  if (/^(examples?|contoh)\b/.test(h)) return { kind: "example", slot };
  if (/^(cefr|level)/.test(h)) return { kind: "cefr" };
  if (/^tags?$/.test(h)) return { kind: "tags" };
  if (/^(definition|english definition)$/.test(h)) return { kind: "definition" };
  return { kind: "ignore" };
}

export function looksLikeHeader(row: unknown[]): boolean {
  const kinds = row.map((c) => classifyHeader(String(c ?? "")).kind);
  return kinds.includes("word") && kinds.filter((k) => k !== "ignore").length >= 2;
}

const EMPTY = /^\s*[-–—]?\s*$/;
const clean = (v: unknown) => {
  const s = normalizeWhitespace(String(v ?? ""));
  return EMPTY.test(s) ? "" : s;
};

/**
 * An example cell often carries its own translation:
 *   "The twins have distinct personalities.\n(Si kembar memiliki …)"
 *   "She is accustomed to waking up early. Dia sudah terbiasa bangun pagi."  ← can't split reliably
 */
export function splitExampleCell(raw: unknown): { en: string; id: string } {
  const text = String(raw ?? "").replace(/\r/g, "").trim();
  if (EMPTY.test(text)) return { en: "", id: "" };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const idx = lines.findIndex((l, i) => i > 0 && l.startsWith("("));
    const cut = idx > 0 ? idx : lines.length - 1;
    return {
      en: normalizeWhitespace(lines.slice(0, cut).join(" ")),
      id: stripParens(lines.slice(cut).join(" ")),
    };
  }
  const single = normalizeWhitespace(text);
  const m = single.match(/^(.*?[.!?"”])\s*\(([^()]{8,})\)?\s*$/);
  if (m) return { en: m[1].trim(), id: normalizeWhitespace(m[2]) };
  return { en: single, id: "" };
}

function stripParens(s: string): string {
  const t = normalizeWhitespace(s);
  return t.replace(/^\(/, "").replace(/\)\.?$/, "").trim();
}

export interface TabularResult {
  drafts: VocabDraft[];
  skipped: number;
  headerFound: boolean;
}

export function draftsFromRows(rows: unknown[][], origin: VocabDraft["origin"] = "import"): TabularResult {
  const headerIndex = rows.findIndex((r) => Array.isArray(r) && looksLikeHeader(r));
  if (headerIndex < 0) return { drafts: [], skipped: rows.length, headerFound: false };

  const columns = rows[headerIndex].map((h) => classifyHeader(String(h ?? "")));
  const drafts: VocabDraft[] = [];
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue;
    const draft = emptyDraft();
    draft.origin = origin;
    const meaningsList: string[] = [];
    const synonymsList: string[] = [];
    const exampleList: { en: string; id: string }[] = [];
    const translationList: string[] = [];

    columns.forEach((col, i) => {
      const cell = row[i];
      switch (col.kind) {
        case "number": {
          const n = Number(clean(cell));
          if (Number.isFinite(n) && n > 0) draft.sourceNumber = n;
          break;
        }
        case "word": {
          const { word, cefr } = parseHeadword(clean(cell));
          draft.word = word;
          if (cefr) {
            draft.cefr = cefr;
            draft.cefrSource = "source";
          }
          break;
        }
        case "pronunciation":
          draft.pronunciation = clean(cell);
          break;
        case "pos":
          draft.partOfSpeech = clean(cell);
          break;
        case "meaning":
          meaningsList.push(clean(cell));
          break;
        case "synonym":
          synonymsList.push(clean(cell));
          break;
        case "example":
          exampleList.push(splitExampleCell(cell));
          break;
        case "translation":
          translationList.push(clean(cell));
          break;
        case "cefr": {
          const level = toCefr(clean(cell));
          if (level) {
            draft.cefr = level;
            draft.cefrSource = "source";
          }
          break;
        }
        case "tags":
          draft.tags = clean(cell).split(/[,;]/).map((t) => t.trim()).filter(Boolean);
          break;
        case "definition":
          draft.definition = clean(cell);
          break;
      }
    });

    if (!draft.word) {
      if (row.some((c) => clean(c))) skipped++;
      continue;
    }
    const m = meaningsList.filter(Boolean);
    [draft.meaning1, draft.meaning2, draft.meaning3] = [m[0] ?? "", m[1] ?? "", m[2] ?? ""];
    const s = synonymsList.filter(Boolean);
    [draft.synonym1, draft.synonym2, draft.synonym3] = [s[0] ?? "", s[1] ?? "", s[2] ?? ""];
    const ex = exampleList.filter((e) => e.en).map((e, i) => ({ en: e.en, id: e.id || translationList[i] || "" }));
    [draft.example1, draft.example1Translation] = [ex[0]?.en ?? "", ex[0]?.id ?? ""];
    [draft.example2, draft.example2Translation] = [ex[1]?.en ?? "", ex[1]?.id ?? ""];
    [draft.example3, draft.example3Translation] = [ex[2]?.en ?? "", ex[2]?.id ?? ""];

    draft.reviewNotes = autoReviewNotes(draft);
    draft.needsReview = hasIncomplete(draft.reviewNotes);
    drafts.push(draft);
  }
  return { drafts, skipped, headerFound: true };
}

/**
 * Plain word lists, one entry per line:
 *   distinct
 *   distinct - berbeda, jelas
 *   distinct: berbeda
 */
export function draftsFromWordList(text: string): VocabDraft[] {
  const drafts: VocabDraft[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z][A-Za-z' -]{0,40}?)\s*(?:\s[-–—=:]\s*|\t|:\s*)(.+)$/);
    const draft = emptyDraft();
    draft.origin = "import";
    const { word, cefr } = parseHeadword(m ? m[1] : line);
    if (!/^[A-Za-z][A-Za-z' -]*$/.test(word) || word.length > 40) continue;
    draft.word = word;
    if (cefr) {
      draft.cefr = cefr;
      draft.cefrSource = "source";
    }
    if (m) {
      const parts = m[2].split(/\s*[,;/]\s*/).filter(Boolean);
      [draft.meaning1, draft.meaning2, draft.meaning3] = [parts[0] ?? "", parts[1] ?? "", parts.slice(2).join(", ")];
    }
    draft.reviewNotes = autoReviewNotes(draft);
    draft.needsReview = hasIncomplete(draft.reviewNotes);
    drafts.push(draft);
  }
  return drafts;
}
