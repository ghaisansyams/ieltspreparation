// Finding a vocabulary word inside a sentence, tolerant of inflection:
// "consist" matches "consists", "reduce" → "reduced", "dwindle" → "dwindled",
// "Slashing" → "slashed", "Culminated" → "culminate". Used to build cloze
// questions and to highlight words in AI output.

const IRREGULAR: Record<string, string[]> = {
  undergone: ["undergo", "undergoes", "underwent", "undergoing"],
  sunken: ["sink", "sank", "sunk", "sinking"],
  mightiest: ["mighty", "mightier"],
};

function stem(word: string): string {
  const w = word.toLowerCase();
  // Strip common inflectional endings so both base and derived headwords
  // ("commencing", "harvested", "linguists") collapse to a shared stem.
  // "-ly" is kept: "evenly" must not collapse to "even" (which matches "event").
  const stripped = w.replace(/(ied|ies)$/, "y").replace(/(ing|ed|es|s)$/, "");
  const base = stripped.length >= 4 ? stripped : w;
  return base.replace(/e$/, "");
}

export function wordPattern(word: string): RegExp {
  const w = word.toLowerCase().trim();
  const forms = new Set<string>([w]);
  (IRREGULAR[w] ?? []).forEach((f) => forms.add(f));
  const s = stem(w);
  // Short stems only take known endings, otherwise "cure" would match "current".
  if (s.length <= 4) forms.add(`${s}(?:e|es|ed|d|ing|s|er|ers)`);
  else forms.add(`${s}[a-z]{0,4}`);
  // y → i (e.g. "occupy" → "occupied")
  if (w.endsWith("y")) forms.add(`${w.slice(0, -1)}i[a-z]{1,3}`);
  // doubled consonant (e.g. "emit" → "emitting", "chop" → "chopped")
  if (/[bcdfgklmnprstvz]$/.test(w) && w.length <= 6) forms.add(`${w}${w.slice(-1)}(?:ed|ing|er)`);
  const alternation = [...forms]
    .sort((a, b) => b.length - a.length)
    .map((f) => (f.includes("[") || f.includes("(") ? f : f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("|");
  return new RegExp(`\\b(?:${alternation})\\b`, "i");
}

export interface WordMatch {
  start: number;
  end: number;
  text: string;
}

export function findWordInSentence(sentence: string, word: string): WordMatch | null {
  if (!sentence || !word) return null;
  // Multi-word headwords ("wearing glasses") are matched literally.
  if (/\s/.test(word.trim())) {
    const idx = sentence.toLowerCase().indexOf(word.toLowerCase().trim());
    return idx >= 0 ? { start: idx, end: idx + word.trim().length, text: sentence.slice(idx, idx + word.trim().length) } : null;
  }
  const m = sentence.match(wordPattern(word));
  if (!m || m.index === undefined) return null;
  return { start: m.index, end: m.index + m[0].length, text: m[0] };
}

/** Sentence with the word replaced by a blank, plus the exact form that was removed. */
export function makeCloze(sentence: string, word: string): { before: string; after: string; answer: string } | null {
  const match = findWordInSentence(sentence, word);
  if (!match) return null;
  return {
    before: sentence.slice(0, match.start),
    after: sentence.slice(match.end),
    answer: match.text,
  };
}

/** Strict inflections used to grade typed answers (no open-ended suffixes). */
export function strictInflections(word: string): Set<string> {
  const w = word.toLowerCase().trim();
  const out = new Set<string>([w, ...(IRREGULAR[w] ?? [])]);
  const base = w.replace(/(ing|ed)$/, "").replace(/ies$/, "y").replace(/s$/, "");
  const bases = new Set([w, base, `${base}e`]);
  for (const b of bases) {
    if (b.length < 2) continue;
    out.add(b);
    const noE = b.replace(/e$/, "");
    for (const suffix of ["s", "es", "d", "ed", "ing", "er", "ers"]) out.add(`${b}${suffix}`);
    out.add(`${noE}ing`);
    out.add(`${noE}ed`);
    if (b.endsWith("y")) ["ied", "ies", "ier", "iest"].forEach((x) => out.add(`${b.slice(0, -1)}${x}`));
    if (/[bcdfgklmnprstvz]$/.test(b)) ["ed", "ing", "er"].forEach((x) => out.add(`${b}${b.slice(-1)}${x}`));
  }
  return out;
}

/** Accepts the exact form, the headword, or a standard inflection of it. */
export function isAcceptedAnswer(input: string, word: string, exactForm?: string): "exact" | "form" | false {
  const a = input.trim().toLowerCase();
  if (!a) return false;
  if (exactForm && a === exactForm.toLowerCase()) return "exact";
  if (a === word.toLowerCase()) return exactForm ? "form" : "exact";
  return strictInflections(word).has(a) ? "form" : false;
}
