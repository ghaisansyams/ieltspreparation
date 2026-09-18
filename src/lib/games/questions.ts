import { CEFR_LEVELS, type CefrLevel, type CefrSource, type ExerciseType, type LearningProgress, type QuizType, type Vocabulary } from "@/lib/types";
import { cefrIndex } from "@/lib/cefr";
import { priorityScore } from "@/lib/learning/priority";
import { allMeaningsText, examples, meanings, splitMeaning, synonymHead, synonymHeads, synonyms, wordKey } from "@/lib/vocab/fields";
import { makeCloze } from "@/lib/vocab/word-forms";
import { shuffle, uid } from "@/lib/utils";

export interface Prompt {
  eyebrow: string;
  /** Large headline (a word). */
  title?: string;
  /** Body text (a meaning, a definition). */
  text?: string;
  cloze?: { before: string; after: string };
  /** Secondary line: POS, translation, context. */
  sub?: string;
  /** Text to speak with the Listen button. */
  speak?: string;
}

interface Base {
  id: string;
  vocabId: string;
  quizType: QuizType;
  exercise: ExerciseType;
  prompt: Prompt;
  /** One-line explanation shown after answering. */
  explain: string;
}

export interface ChoiceQuestion extends Base {
  kind: "choice";
  options: { id: string; label: string; vocabId?: string }[];
  answerId: string;
}

export interface TypedQuestion extends Base {
  kind: "typed";
  word: string;
  /** Exact expected form (may be inflected, e.g. "outweighs"). */
  answer: string;
  hint: string;
}

export interface CefrQuestion extends Base {
  kind: "cefr";
  answer: CefrLevel;
  source: CefrSource;
}

export interface FlipQuestion extends Base {
  kind: "flip";
}

export interface WriteQuestion extends Base {
  kind: "write";
  word: string;
  task: string;
}

export type Question = ChoiceQuestion | TypedQuestion | CefrQuestion | FlipQuestion | WriteQuestion;

export type Rand = () => number;

const posGroup = (pos: string) => pos.toLowerCase().split(/[/ ]/)[0] || "other";

function unrelated(a: Vocabulary, b: Vocabulary): boolean {
  if (a.id === b.id || wordKey(a.word) === wordKey(b.word)) return false;
  const aSyn = new Set(synonymHeads(a).map(wordKey));
  if (synonymHeads(b).some((s) => aSyn.has(wordKey(s)))) return false;
  const aFam = new Set([wordKey(a.word), ...a.wordFamily.map(wordKey)]);
  if (b.wordFamily.some((f) => aFam.has(wordKey(f))) || aFam.has(wordKey(b.word))) return false;
  return true;
}

export function pickDistractors(target: Vocabulary, pool: Vocabulary[], n: number, rand: Rand, need?: (v: Vocabulary) => boolean): Vocabulary[] {
  const candidates = pool.filter((v) => unrelated(target, v) && (!need || need(v)));
  const samePos = shuffle(candidates.filter((v) => posGroup(v.partOfSpeech) === posGroup(target.partOfSpeech)), rand);
  const rest = shuffle(candidates.filter((v) => posGroup(v.partOfSpeech) !== posGroup(target.partOfSpeech)), rand);
  return [...samePos, ...rest].slice(0, n);
}

const hintFor = (word: string) => `${word[0]?.toUpperCase() ?? ""}${"·".repeat(Math.max(0, word.length - 1))} (${word.length} letters)`;
const meaningLine = (v: Vocabulary) => allMeaningsText(v) || v.definition;
const explainWord = (v: Vocabulary) => `${v.word}${v.partOfSpeech ? ` (${v.partOfSpeech.toLowerCase()})` : ""} — ${meaningLine(v)}`;

function base(v: Vocabulary, quizType: QuizType, exercise: ExerciseType, prompt: Prompt): Omit<Base, "explain"> {
  return { id: uid("q"), vocabId: v.id, quizType, exercise, prompt };
}

function pickCloze(v: Vocabulary, rand: Rand) {
  const withCloze = examples(v)
    .map((e) => ({ e, cloze: makeCloze(e.en, v.word) }))
    .filter((x) => x.cloze);
  if (!withCloze.length) return null;
  return withCloze[Math.floor(rand() * withCloze.length)];
}

// ── Question builders ─────────────────────────────────────────────────────

/** Meaning (Indonesian) → type the word. Flashcard Rush. */
export function meaningToWordTyped(v: Vocabulary, quizType: QuizType = "flashcard-rush"): TypedQuestion | null {
  if (!meanings(v).length && !v.definition) return null;
  return {
    ...base(v, quizType, "reverse-translation", {
      eyebrow: "Meaning",
      text: meaningLine(v),
      sub: v.partOfSpeech || undefined,
    }),
    kind: "typed",
    word: v.word,
    answer: v.word,
    hint: hintFor(v.word),
    explain: explainWord(v),
  };
}

/** Indonesian meaning + translated context → type the English word. */
export function reverseTranslation(v: Vocabulary, rand: Rand, quizType: QuizType = "reverse-translation"): TypedQuestion | null {
  if (!meanings(v).length) return null;
  const ctx = examples(v).filter((e) => e.id);
  const context = ctx.length ? ctx[Math.floor(rand() * ctx.length)].id : undefined;
  return {
    ...base(v, quizType, "reverse-translation", {
      eyebrow: "Translate into English",
      text: allMeaningsText(v),
      sub: context ? `Context: “${context}”` : v.partOfSpeech || undefined,
    }),
    kind: "typed",
    word: v.word,
    answer: v.word,
    hint: hintFor(v.word),
    explain: explainWord(v),
  };
}

/** Example sentence with a blank → choose the word. */
export function clozeChoice(v: Vocabulary, pool: Vocabulary[], rand: Rand, quizType: QuizType = "multiple-choice"): ChoiceQuestion | null {
  const pick = pickCloze(v, rand);
  if (!pick) return null;
  const distractors = pickDistractors(v, pool, 3, rand);
  if (distractors.length < 3) return null;
  const options = shuffle([v, ...distractors], rand).map((o) => ({ id: o.id, label: o.word.toLowerCase(), vocabId: o.id }));
  return {
    ...base(v, quizType, "multiple-choice", {
      eyebrow: "Complete the sentence",
      cloze: { before: pick.cloze!.before, after: pick.cloze!.after },
      sub: pick.e.id || undefined,
      speak: pick.e.en,
    }),
    kind: "choice",
    options,
    answerId: v.id,
    explain: `“${pick.e.en}” — ${explainWord(v)}`,
  };
}

/** Example sentence with a blank → type the exact form. */
export function clozeTyped(v: Vocabulary, rand: Rand, quizType: QuizType = "sentence-completion"): TypedQuestion | null {
  const pick = pickCloze(v, rand);
  if (!pick) return null;
  const answer = pick.cloze!.answer;
  return {
    ...base(v, quizType, "sentence-completion", {
      eyebrow: "Sentence completion",
      cloze: { before: pick.cloze!.before, after: pick.cloze!.after },
      sub: pick.e.id || undefined,
      speak: pick.e.en,
    }),
    kind: "typed",
    word: v.word,
    answer,
    hint: hintFor(answer),
    explain: `“${pick.e.en}” — ${explainWord(v)}`,
  };
}

/** Word → pick its synonym. */
export function synonymChoice(v: Vocabulary, pool: Vocabulary[], rand: Rand, quizType: QuizType = "synonym-match"): ChoiceQuestion | null {
  const own = synonyms(v).filter((s) => synonymHead(s));
  if (!own.length) return null;
  const correctRaw = own[Math.floor(rand() * own.length)];
  const correct = synonymHead(correctRaw);
  const ownKeys = new Set([wordKey(v.word), ...synonymHeads(v).map(wordKey)]);
  const others = pickDistractors(v, pool, 12, rand, (o) => synonyms(o).length > 0);
  const wrong: string[] = [];
  for (const o of others) {
    const s = synonymHeads(o).find((x) => !ownKeys.has(wordKey(x)) && !wrong.some((w) => wordKey(w) === wordKey(x)));
    if (s) wrong.push(s);
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong], rand).map((label) => ({ id: wordKey(label), label }));
  return {
    ...base(v, quizType, "synonym-match", { eyebrow: "Pick the synonym", title: v.word, sub: v.partOfSpeech || undefined, speak: v.word }),
    kind: "choice",
    options,
    answerId: wordKey(correct),
    explain: `${v.word} ≈ ${synonymHeads(v).join(", ")}`,
  };
}

/** English definition (or Indonesian meaning) → choose the word. */
export function meaningMatch(v: Vocabulary, pool: Vocabulary[], rand: Rand, quizType: QuizType = "meaning-match"): ChoiceQuestion | null {
  const text = v.definition || allMeaningsText(v);
  if (!text) return null;
  const distractors = pickDistractors(v, pool, 3, rand);
  if (distractors.length < 3) return null;
  return {
    ...base(v, quizType, "multiple-choice", {
      eyebrow: v.definition ? "Which word means…" : "Which word means (Indonesian)…",
      text,
      sub: v.definition ? allMeaningsText(v) || undefined : undefined,
    }),
    kind: "choice",
    options: shuffle([v, ...distractors], rand).map((o) => ({ id: o.id, label: o.word.toLowerCase(), vocabId: o.id })),
    answerId: v.id,
    explain: explainWord(v),
  };
}

/** Word → choose its Indonesian meaning. The gentlest recognition exercise. */
export function wordToMeaning(v: Vocabulary, pool: Vocabulary[], rand: Rand, quizType: QuizType = "multiple-choice"): ChoiceQuestion | null {
  if (!meanings(v).length) return null;
  const distractors = pickDistractors(v, pool, 3, rand, (o) => meanings(o).length > 0);
  if (distractors.length < 3) return null;
  return {
    ...base(v, quizType, "multiple-choice", { eyebrow: "What does it mean?", title: v.word, sub: v.pronunciation || undefined, speak: v.word }),
    kind: "choice",
    options: shuffle([v, ...distractors], rand).map((o) => ({ id: o.id, label: meanings(o).map((m) => splitMeaning(m).text).slice(0, 2).join(" / "), vocabId: o.id })),
    answerId: v.id,
    explain: explainWord(v),
  };
}

export function cefrQuestion(v: Vocabulary): CefrQuestion | null {
  if (!v.cefr) return null;
  return {
    ...base(v, "cefr-challenge", "multiple-choice", { eyebrow: "Guess the level", title: v.word, text: meaningLine(v), sub: v.partOfSpeech || undefined, speak: v.word }),
    kind: "cefr",
    answer: v.cefr,
    source: v.cefrSource,
    explain: explainWord(v),
  };
}

/** Three words that belong together + one that doesn't. */
export function oddOneOut(v: Vocabulary, pool: Vocabulary[], rand: Rand): ChoiceQuestion | null {
  const heads = synonymHeads(v).filter((h) => h.split(" ").length <= 2);
  if (heads.length < 2) return null;
  const [outlier] = pickDistractors(v, pool, 1, rand, (o) => meanings(o).length > 0);
  if (!outlier) return null;
  const group = [v.word, ...shuffle(heads, rand).slice(0, 2)];
  const options = shuffle([...group.map((label) => ({ id: `in:${wordKey(label)}`, label })), { id: `out:${outlier.id}`, label: outlier.word }], rand);
  return {
    ...base(v, "odd-one-out", "synonym-match", { eyebrow: "Find the odd one out", text: "Three of these share a meaning." }),
    kind: "choice",
    options: options.map((o) => ({ ...o, label: o.label.toUpperCase() })),
    answerId: `out:${outlier.id}`,
    explain: `${group.join(", ")} all mean “${meaningLine(v)}”. ${outlier.word} means “${meaningLine(outlier)}”.`,
  };
}

export function flip(v: Vocabulary): FlipQuestion {
  return { ...base(v, "review", "flashcard", { eyebrow: "Do you remember?", title: v.word, speak: v.word }), kind: "flip", explain: explainWord(v) };
}

export function writeSentence(v: Vocabulary, task: string, quizType: QuizType = "review"): WriteQuestion {
  return {
    ...base(v, quizType, "use-it", { eyebrow: "Use it", title: v.word, text: task, sub: meaningLine(v), speak: v.word }),
    kind: "write",
    word: v.word,
    task,
    explain: explainWord(v),
  };
}

// ── Selection ─────────────────────────────────────────────────────────────

/** Weighted sample: words that need attention are more likely to be picked. */
export function pickWords(
  pool: Vocabulary[],
  progress: Record<string, LearningProgress>,
  n: number,
  rand: Rand,
  now = new Date(),
): Vocabulary[] {
  const weighted = pool.map((v) => ({ v, key: Math.pow(rand(), 1 / (priorityScore(progress[v.id], now) + 10)) }));
  return weighted
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.v);
}

/** Build up to `n` questions with a builder, skipping words it can't handle. */
export function buildSet<Q extends Question>(
  words: Vocabulary[],
  n: number,
  build: (v: Vocabulary) => Q | null,
): Q[] {
  const out: Q[] = [];
  for (const v of words) {
    const q = build(v);
    if (q) out.push(q);
    if (out.length >= n) break;
  }
  return out;
}

/** Exercise for spaced-repetition review, with graceful fallbacks when data is missing. */
export function reviewQuestion(v: Vocabulary, exercise: ExerciseType, pool: Vocabulary[], rand: Rand): Question {
  const attempts: (() => Question | null)[] = {
    flashcard: [() => flip(v)],
    "multiple-choice": [() => clozeChoice(v, pool, rand, "review"), () => wordToMeaning(v, pool, rand, "review"), () => flip(v)],
    "sentence-completion": [() => clozeTyped(v, rand, "review"), () => meaningToWordTyped(v, "review"), () => flip(v)],
    "reverse-translation": [() => reverseTranslation(v, rand, "review"), () => flip(v)],
    "synonym-match": [() => synonymChoice(v, pool, rand, "review"), () => clozeChoice(v, pool, rand, "review"), () => flip(v)],
    "use-it": [() => writeSentence(v, `Write your own sentence using “${v.word.toLowerCase()}”.`), () => flip(v)],
  }[exercise];
  for (const make of attempts) {
    const q = make();
    if (q) return q;
  }
  return flip(v);
}

// ── Boss battle: adaptive difficulty 1–5 ─────────────────────────────────

export function bossQuestion(level: number, pool: Vocabulary[], used: Set<string>, progress: Record<string, LearningProgress>, rand: Rand): Question | null {
  const band = pool.filter((v) => !used.has(v.id));
  // Harder levels lean on higher-CEFR / weaker words.
  const target = Math.min(5, Math.max(0, level - 1 + 1));
  const scored = shuffle(band, rand).sort((a, b) => {
    const da = Math.abs(cefrIndex(a.cefr) - target) - (progress[a.id] ? 0 : 0.5);
    const db = Math.abs(cefrIndex(b.cefr) - target) - (progress[b.id] ? 0 : 0.5);
    return da - db;
  });
  const builders: ((v: Vocabulary) => Question | null)[] = {
    1: [(v: Vocabulary) => wordToMeaning(v, pool, rand, "boss-battle")],
    2: [(v: Vocabulary) => clozeChoice(v, pool, rand, "boss-battle"), (v: Vocabulary) => meaningMatch(v, pool, rand, "boss-battle")],
    3: [(v: Vocabulary) => synonymChoice(v, pool, rand, "boss-battle"), (v: Vocabulary) => meaningMatch(v, pool, rand, "boss-battle")],
    4: [(v: Vocabulary) => clozeTyped(v, rand, "boss-battle")],
    5: [(v: Vocabulary) => reverseTranslation(v, rand, "boss-battle"), (v: Vocabulary) => meaningToWordTyped(v, "boss-battle")],
  }[Math.min(5, Math.max(1, level)) as 1 | 2 | 3 | 4 | 5];
  for (const v of scored.slice(0, 40)) {
    for (const b of shuffle(builders, rand)) {
      const q = b(v);
      if (q) return q;
    }
  }
  return null;
}

export const CEFR_OPTIONS = CEFR_LEVELS;
