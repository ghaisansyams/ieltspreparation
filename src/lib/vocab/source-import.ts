import { ENRICHMENT, SOURCE_NOTES, SOURCE_ROWS, type SourceRow } from "@/data/source";
import { difficultyFromCefr, parseHeadword } from "@/lib/cefr";
import type { AiField, ReviewNote, VocabDraft } from "@/lib/types";
import { autoReviewNotes, emptyDraft, hasIncomplete } from "./fields";

/**
 * Turns one transcribed source row into a vocabulary draft.
 * Source text goes in untouched; AI enrichment only fills fields the source
 * doesn't have, and every such field is listed in `aiFields`.
 */
export function draftFromSourceRow(row: SourceRow): VocabDraft {
  const { word, cefr: sourceCefr } = parseHeadword(row.word);
  const enrichment = ENRICHMENT[row.n];
  const draft = emptyDraft(word);

  draft.sourceNumber = row.n;
  draft.origin = "source-pdf";
  draft.pronunciation = row.pron;
  draft.partOfSpeech = row.pos;
  [draft.meaning1, draft.meaning2, draft.meaning3] = [row.m[0] ?? "", row.m[1] ?? "", row.m[2] ?? ""];
  [draft.synonym1, draft.synonym2, draft.synonym3] = [row.s[0] ?? "", row.s[1] ?? "", row.s[2] ?? ""];
  [draft.example1, draft.example1Translation] = row.ex[0] ?? ["", ""];
  [draft.example2, draft.example2Translation] = row.ex[1] ?? ["", ""];
  [draft.example3, draft.example3Translation] = row.ex[2] ?? ["", ""];

  const aiFields: AiField[] = [];
  if (sourceCefr) {
    draft.cefr = sourceCefr;
    draft.cefrSource = "source";
  } else if (enrichment) {
    draft.cefr = enrichment.cefr;
    draft.cefrSource = "estimated";
    aiFields.push("cefr");
  }

  if (enrichment) {
    draft.definition = enrichment.definition;
    draft.frequency = enrichment.frequency;
    draft.tags = enrichment.tags;
    draft.wordFamily = enrichment.wordFamily;
    draft.collocations = enrichment.collocations;
    draft.ieltsRelevance = enrichment.ielts;
    aiFields.push("definition", "frequency", "tags", "wordFamily", "collocations", "ieltsRelevance");
  }
  draft.difficulty = difficultyFromCefr(draft.cefr);
  if (draft.difficulty !== null) aiFields.push("difficulty");
  draft.aiFields = aiFields;

  const explicit = SOURCE_NOTES[row.n] ?? [];
  const notes: ReviewNote[] = hasIncomplete(explicit) ? explicit : [...explicit, ...autoReviewNotes(draft)];
  draft.reviewNotes = notes;
  draft.needsReview = hasIncomplete(notes);
  return draft;
}

export function sourceDrafts(): VocabDraft[] {
  return SOURCE_ROWS.map(draftFromSourceRow);
}
