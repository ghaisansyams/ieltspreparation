/** One row of the source vocabulary document, as transcribed. */
export interface SourceRow {
  /** Original row number. */
  n: number;
  /** Headword exactly as written (may carry a level, e.g. "Multitude (C1)"). */
  word: string;
  pron: string;
  pos: string;
  /** Meaning 1–3 (Indonesian). */
  m: string[];
  /** Synonym 1–3. */
  s: string[];
  /** Up to three [English example, Indonesian translation] pairs. */
  ex: [string, string][];
}
