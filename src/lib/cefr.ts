import { CEFR_LEVELS, type CefrLevel, type CefrSource } from "./types";

export const CEFR_META: Record<CefrLevel, { name: string; description: string }> = {
  A1: { name: "Beginner", description: "Everyday basics" },
  A2: { name: "Elementary", description: "Routine, familiar topics" },
  B1: { name: "Intermediate", description: "Clear standard language" },
  B2: { name: "Upper-intermediate", description: "Complex texts, fluent interaction" },
  C1: { name: "Advanced", description: "Demanding, academic language" },
  C2: { name: "Proficient", description: "Precise, nuanced, rare language" },
};

export const CEFR_SOURCE_LABEL: Record<CefrSource, string> = {
  source: "From source",
  estimated: "Estimated",
  manual: "Verified",
};

export function isCefr(value: unknown): value is CefrLevel {
  return typeof value === "string" && (CEFR_LEVELS as readonly string[]).includes(value.toUpperCase());
}

export function toCefr(value: unknown): CefrLevel | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return isCefr(v) ? (v as CefrLevel) : null;
}

export function cefrIndex(level: CefrLevel | null): number {
  return level ? CEFR_LEVELS.indexOf(level) : -1;
}

export function difficultyFromCefr(level: CefrLevel | null): number | null {
  if (!level) return null;
  return { A1: 1, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 }[level];
}

const LEVEL_IN_PARENS = /\s*\((A1|A2|B1|B2|C1|C2)(?:\s*-\s*[1-2])?\)\s*$/i;

/** "Multitude (C1)" → { word: "Multitude", cefr: "C1" }. */
export function parseHeadword(raw: string): { word: string; cefr: CefrLevel | null } {
  const match = raw.match(LEVEL_IN_PARENS);
  if (!match) return { word: raw.trim(), cefr: null };
  return { word: raw.replace(LEVEL_IN_PARENS, "").trim(), cefr: toCefr(match[1]) };
}

/**
 * Offline fallback when no AI provider is configured. Deliberately rough —
 * the result is always stored as `estimated` and shown as such.
 */
export function estimateCefrHeuristic(word: string): CefrLevel {
  const w = word.toLowerCase().trim();
  const syllables = Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length - (w.endsWith("e") && !w.endsWith("le") ? 1 : 0));
  let score = 0;
  if (w.length >= 7) score++;
  if (w.length >= 10) score++;
  if (syllables >= 3) score++;
  if (syllables >= 4) score++;
  if (/(tion|sion|ment|ance|ence|ity|ous|ive|ize|ise|ate)$/.test(w)) score++;
  if (/^(un|in|im|ir|dis|mis|sub|inter|trans|circum|pre)/.test(w) && w.length > 7) score++;
  return (["A2", "B1", "B1", "B2", "C1", "C1", "C2"] as CefrLevel[])[Math.min(score, 6)];
}
