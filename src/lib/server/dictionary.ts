import "server-only";
import { estimateCefrHeuristic } from "@/lib/cefr";
import type { VocabDraft } from "@/lib/types";
import { autoReviewNotes, emptyDraft } from "@/lib/vocab/fields";

// Offline-ish fallback for "Generate Vocabulary" when no AI key is configured:
// the free dictionaryapi.dev gives pronunciation, part of speech, English
// definitions, synonyms and sometimes examples. It has no Indonesian, so the
// entry is always marked Needs Review and nothing is invented to fill gaps.

interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: { partOfSpeech: string; synonyms?: string[]; definitions: { definition: string; example?: string; synonyms?: string[] }[] }[];
}

export async function dictionaryDraft(word: string): Promise<VocabDraft | null> {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim().toLowerCase())}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const entries = (await res.json()) as DictEntry[];
  const e = entries[0];
  if (!e) return null;

  const d = emptyDraft(e.word.charAt(0).toUpperCase() + e.word.slice(1));
  d.origin = "manual";
  d.pronunciation = e.phonetic || e.phonetics?.find((p) => p.text)?.text || "";
  const posList = [...new Set((e.meanings ?? []).map((m) => m.partOfSpeech.charAt(0).toUpperCase() + m.partOfSpeech.slice(1)))];
  d.partOfSpeech = posList.slice(0, 2).join("/");
  const defs = (e.meanings ?? []).flatMap((m) => m.definitions.map((x) => ({ ...x, pos: m.partOfSpeech })));
  d.definition = defs[0]?.definition ?? "";
  const synonyms = [...new Set((e.meanings ?? []).flatMap((m) => [...(m.synonyms ?? []), ...m.definitions.flatMap((x) => x.synonyms ?? [])]))];
  [d.synonym1, d.synonym2, d.synonym3] = [synonyms[0] ?? "", synonyms[1] ?? "", synonyms[2] ?? ""];
  const examples = defs.filter((x) => x.example).slice(0, 3);
  [d.example1, d.example2, d.example3] = [examples[0]?.example ?? "", examples[1]?.example ?? "", examples[2]?.example ?? ""];
  d.cefr = estimateCefrHeuristic(e.word);
  d.cefrSource = "estimated";
  d.aiFields = [];
  d.reviewNotes = [
    { kind: "incomplete", text: "Created from a public dictionary without AI: add Indonesian meanings and translations." },
    ...autoReviewNotes(d).filter((n) => n.kind === "suggestion"),
    { kind: "suggestion", text: "CEFR was estimated with a simple offline heuristic." },
  ];
  d.needsReview = true;
  return d;
}
