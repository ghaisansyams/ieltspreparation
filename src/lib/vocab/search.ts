import { CEFR_LEVELS, type LearningStatus, type Vocabulary } from "@/lib/types";
import { examples, meanings, splitMeaning, synonymHead, synonymHeads, synonyms } from "./fields";

export type MatchField =
  | "word"
  | "family"
  | "synonym"
  | "meaning"
  | "definition"
  | "tag"
  | "collocation"
  | "related"
  | "example";

export interface SearchHit {
  vocab: Vocabulary;
  field: MatchField;
  /** Text that matched, for display. */
  snippet: string;
  score: number;
}

export interface ParsedQuery {
  text: string;
  cefr: string[];
  pos: string[];
  tags: string[];
  status: LearningStatus[];
}

const FIELD_WEIGHT: Record<MatchField, number> = {
  word: 100,
  family: 60,
  synonym: 55,
  meaning: 50,
  definition: 35,
  tag: 30,
  collocation: 25,
  related: 22,
  example: 12,
};

export const MATCH_LABEL: Record<MatchField, string> = {
  word: "Word",
  family: "Word family",
  synonym: "Synonym",
  meaning: "Meaning",
  definition: "Definition",
  tag: "Tag",
  collocation: "Collocation",
  related: "Related meaning",
  example: "Example",
};

export function fold(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Supports inline filters: `cefr:c1 pos:verb tag:academic status:learning reduce`. */
export function parseQuery(raw: string): ParsedQuery {
  const q: ParsedQuery = { text: "", cefr: [], pos: [], tags: [], status: [] };
  const rest: string[] = [];
  for (const token of raw.trim().split(/\s+/)) {
    const m = token.match(/^(cefr|level|pos|type|tag|status):(.+)$/i);
    if (!m) {
      rest.push(token);
      continue;
    }
    const key = m[1].toLowerCase();
    const value = m[2].toLowerCase();
    if (key === "cefr" || key === "level") {
      const lv = value.toUpperCase();
      if ((CEFR_LEVELS as readonly string[]).includes(lv)) q.cefr.push(lv);
    } else if (key === "pos" || key === "type") q.pos.push(value);
    else if (key === "tag") q.tags.push(value);
    else if (key === "status") q.status.push(value as LearningStatus);
  }
  q.text = rest.join(" ");
  return q;
}

export function matchesFilters(v: Vocabulary, q: ParsedQuery, status?: LearningStatus): boolean {
  if (q.cefr.length && (!v.cefr || !q.cefr.includes(v.cefr))) return false;
  if (q.pos.length && !q.pos.some((p) => v.partOfSpeech.toLowerCase().includes(p))) return false;
  if (q.tags.length && !q.tags.some((t) => v.tags.some((vt) => vt.toLowerCase().includes(t)))) return false;
  if (q.status.length && (!status || !q.status.includes(status))) return false;
  return true;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 1 = exact, 0.8 = starts a word, 0.35 = buried inside a longer word ("enggan" in "menggantungkan"). */
function quality(value: string, needle: string, exactValue = value): number {
  const folded = fold(value);
  if (!folded.includes(needle)) return 0;
  if (fold(exactValue).trim() === needle) return 1;
  if (new RegExp(`(^|[^a-z0-9])${escape(needle)}`).test(folded)) return 0.8;
  return 0.35;
}

function scoreEntry(v: Vocabulary, needle: string): { field: MatchField; snippet: string; score: number } | null {
  const candidates: [MatchField, string, string?][] = [
    ["word", v.word],
    ...v.wordFamily.map((f): [MatchField, string] => ["family", f]),
    ...synonyms(v).map((s): [MatchField, string, string] => ["synonym", s, synonymHead(s)]),
    ...meanings(v).map((m): [MatchField, string] => ["meaning", splitMeaning(m).text]),
    ...(v.definition ? [["definition", v.definition] as [MatchField, string]] : []),
    ...v.tags.map((t): [MatchField, string] => ["tag", t]),
    ...v.collocations.map((c): [MatchField, string] => ["collocation", c]),
    ...examples(v).flatMap((e): [MatchField, string][] => [["example", e.en], ["example", e.id]]),
  ];
  let best: { field: MatchField; snippet: string; score: number } | null = null;
  for (const [field, value, exact] of candidates) {
    const q = quality(value, needle, exact);
    if (!q) continue;
    const score = Math.round(FIELD_WEIGHT[field] * q + (field === "word" && q === 1 ? 50 : 0));
    if (!best || score > best.score) best = { field, snippet: value, score };
  }
  return best;
}

export function searchVocabulary(
  all: Vocabulary[],
  raw: string,
  opts: { limit?: number; statusOf?: (id: string) => LearningStatus | undefined } = {},
): SearchHit[] {
  const q = parseQuery(raw);
  const needle = fold(q.text.trim());
  const pool = all.filter((v) => matchesFilters(v, q, opts.statusOf?.(v.id)));
  if (!needle) {
    return pool
      .map((v) => ({ vocab: v, field: "word" as const, snippet: v.word, score: 1 }))
      .slice(0, opts.limit ?? pool.length);
  }

  const hits = new Map<string, SearchHit>();
  for (const v of pool) {
    const m = scoreEntry(v, needle);
    if (m) hits.set(v.id, { vocab: v, ...m });
  }

  // Semantic neighbours: when the query IS a library word, entries sharing its
  // synonyms also surface ("reduce" → Dwindle via decrease / diminish).
  const exact = all.find((v) => fold(v.word) === needle);
  if (exact) {
    const expansion = new Set(synonymHeads(exact).map(fold));
    for (const v of pool) {
      if (hits.has(v.id) || v.id === exact.id) continue;
      const shared = synonymHeads(v).find((s) => expansion.has(fold(s)));
      if (shared) hits.set(v.id, { vocab: v, field: "related", snippet: `${shared} · like “${exact.word}”`, score: FIELD_WEIGHT.related });
    }
  }

  const sorted = [...hits.values()].sort((a, b) => b.score - a.score || a.vocab.word.localeCompare(b.vocab.word));
  return opts.limit ? sorted.slice(0, opts.limit) : sorted;
}

/** Synonyms across the library that match the query but are not entries themselves ("Diminish" under Reduce). */
export function synonymMatches(all: Vocabulary[], raw: string, limit = 6): { synonym: string; parent: Vocabulary }[] {
  const needle = fold(parseQuery(raw).text.trim());
  if (needle.length < 2) return [];
  const words = new Set(all.map((v) => fold(v.word)));
  const out: { synonym: string; parent: Vocabulary }[] = [];
  const seen = new Set<string>();
  const exact = all.find((v) => fold(v.word) === needle);
  const push = (synonym: string, parent: Vocabulary) => {
    const key = fold(synonym);
    if (seen.has(key) || words.has(key)) return;
    seen.add(key);
    out.push({ synonym, parent });
  };
  if (exact) synonymHeads(exact).forEach((s) => push(s, exact));
  for (const v of all) {
    for (const s of synonymHeads(v)) if (fold(s).startsWith(needle)) push(s, v);
  }
  return out.slice(0, limit);
}
