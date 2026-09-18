import { ROWS_001_048 } from "./rows-001-048";
import { ROWS_049_095 } from "./rows-049-095";
import { ROWS_096_148 } from "./rows-096-148";

export type { SourceRow } from "./types";
export { ENRICHMENT, SOURCE_NOTES } from "./enrichment";

export const SOURCE_DOCUMENT = {
  title: "Jay's Vocabulary",
  fileName: "Jay's Vocabulary - Vocabulary.pdf",
  pages: 4,
};

export const SOURCE_ROWS = [...ROWS_001_048, ...ROWS_049_095, ...ROWS_096_148];
