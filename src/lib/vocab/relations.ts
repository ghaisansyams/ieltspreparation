import type { Vocabulary } from "@/lib/types";
import { synonymHeads, wordKey } from "./fields";

export type RelationKind = "synonym" | "family" | "shared-synonym" | "library-synonym" | "same-family";

export interface Relation {
  kind: RelationKind;
  label: string;
  /** Set when the related word is itself in the library. */
  vocabId?: string;
}

export const RELATION_LABEL: Record<RelationKind, string> = {
  synonym: "Synonym",
  family: "Word family",
  "shared-synonym": "Shares a synonym",
  "library-synonym": "Synonym in your library",
  "same-family": "Same word family",
};

export function buildWordIndex(all: Vocabulary[]): Map<string, Vocabulary> {
  const index = new Map<string, Vocabulary>();
  for (const v of all) index.set(wordKey(v.word), v);
  return index;
}

/**
 * Everything a word connects to: its own synonyms and word family, plus other
 * library entries that share a synonym, appear as a synonym, or share a family.
 */
export function relationsFor(v: Vocabulary, all: Vocabulary[], index = buildWordIndex(all)): Relation[] {
  const out: Relation[] = [];
  const seen = new Set<string>([wordKey(v.word)]);
  const push = (r: Relation) => {
    const key = `${r.vocabId ?? ""}|${wordKey(r.label)}`;
    if (seen.has(wordKey(r.label)) && !r.vocabId) return;
    if (seen.has(key)) return;
    seen.add(key);
    seen.add(wordKey(r.label));
    out.push(r);
  };

  for (const f of v.wordFamily) {
    const hit = index.get(wordKey(f));
    push({ kind: "family", label: f, vocabId: hit?.id });
  }
  const mySyn = synonymHeads(v).map(wordKey);
  for (const head of synonymHeads(v)) {
    const hit = index.get(wordKey(head));
    push({ kind: hit ? "library-synonym" : "synonym", label: head, vocabId: hit?.id });
  }

  const myFamily = new Set([wordKey(v.word), ...v.wordFamily.map(wordKey)]);
  for (const other of all) {
    if (other.id === v.id) continue;
    const otherKey = wordKey(other.word);
    const otherSyn = synonymHeads(other).map(wordKey);
    if (otherSyn.includes(wordKey(v.word))) {
      push({ kind: "library-synonym", label: other.word, vocabId: other.id });
    } else if (other.wordFamily.some((f) => myFamily.has(wordKey(f))) || myFamily.has(otherKey)) {
      push({ kind: "same-family", label: other.word, vocabId: other.id });
    } else if (otherSyn.some((s) => mySyn.includes(s))) {
      push({ kind: "shared-synonym", label: other.word, vocabId: other.id });
    }
  }
  return out;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: "vocab" | "synonym" | "family";
  vocabId?: string;
  cefr?: string | null;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: RelationKind;
}

/** Ego network around one word (depth 1, library neighbours included). */
export function egoGraph(center: Vocabulary, all: Vocabulary[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const index = buildWordIndex(all);
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const centerId = `v:${center.id}`;
  nodes.set(centerId, { id: centerId, label: center.word, kind: "vocab", vocabId: center.id, cefr: center.cefr });
  for (const r of relationsFor(center, all, index)) {
    const id = r.vocabId ? `v:${r.vocabId}` : `${r.kind === "family" ? "f" : "s"}:${wordKey(r.label)}`;
    if (!nodes.has(id)) {
      const lib = r.vocabId ? all.find((x) => x.id === r.vocabId) : undefined;
      nodes.set(id, {
        id,
        label: lib?.word ?? r.label,
        kind: r.vocabId ? "vocab" : r.kind === "family" ? "family" : "synonym",
        vocabId: r.vocabId,
        cefr: lib?.cefr,
      });
    }
    links.push({ source: centerId, target: id, kind: r.kind });
  }
  return { nodes: [...nodes.values()], links };
}

/** Whole-library network: entries linked when they are connected by synonyms or word family. */
export function libraryGraph(all: Vocabulary[]): { nodes: GraphNode[]; links: GraphLink[] } {
  const index = buildWordIndex(all);
  const linkKeys = new Set<string>();
  const links: GraphLink[] = [];
  for (const v of all) {
    for (const r of relationsFor(v, all, index)) {
      if (!r.vocabId) continue;
      const [a, b] = [v.id, r.vocabId].sort();
      const key = `${a}|${b}`;
      if (linkKeys.has(key)) continue;
      linkKeys.add(key);
      links.push({ source: `v:${a}`, target: `v:${b}`, kind: r.kind });
    }
  }
  const connected = new Set(links.flatMap((l) => [l.source, l.target]));
  const nodes: GraphNode[] = all
    .filter((v) => connected.has(`v:${v.id}`))
    .map((v) => ({ id: `v:${v.id}`, label: v.word, kind: "vocab", vocabId: v.id, cefr: v.cefr }));
  return { nodes, links };
}
