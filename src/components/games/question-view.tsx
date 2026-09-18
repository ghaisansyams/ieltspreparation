"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Lightbulb, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Kbd, Spinner } from "@/components/ui/misc";
import { ListenButton, cefrVar } from "@/components/vocab/bits";
import { VocabCard } from "@/components/vocab/vocab-card";
import { EvaluationView } from "@/components/games/evaluation-view";
import { useAiStatus } from "@/hooks/use-ai-status";
import { aiJson } from "@/lib/ai/client";
import type { Evaluation } from "@/lib/ai/schemas";
import { cefrIndex } from "@/lib/cefr";
import type { Question } from "@/lib/games/questions";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/types";
import { allMeaningsText } from "@/lib/vocab/fields";
import { findWordInSentence, isAcceptedAnswer } from "@/lib/vocab/word-forms";
import { cn, levenshtein } from "@/lib/utils";

export interface AnswerResult {
  correct: boolean;
  /** Partial credit for near misses (CEFR off by one). */
  partial?: boolean;
  responseTime: number;
  given: string;
  note?: string;
  timedOut?: boolean;
  evaluation?: Evaluation;
  /** Flip cards have no right/wrong: the learner self-rates afterwards. */
  selfRated?: boolean;
}

function Prompt({ q }: { q: Question }) {
  const p = q.prompt;
  return (
    <div className="text-center">
      <div className="eyebrow">{p.eyebrow}</div>
      {p.title ? <h2 className="headword mt-4 break-words text-[clamp(2.4rem,7vw,3.6rem)] text-ink">{p.title}</h2> : null}
      {p.text ? <p className={cn("mx-auto mt-4 max-w-xl text-ink", p.title ? "text-base text-ink-2" : "text-[clamp(1.25rem,3vw,1.6rem)] leading-snug")}>{p.text}</p> : null}
      {p.cloze ? (
        <p className="mx-auto mt-5 max-w-2xl text-[clamp(1.15rem,2.6vw,1.45rem)] leading-relaxed text-ink">
          {p.cloze.before}
          <span className="mx-1 inline-block min-w-24 border-b-2 border-ink/60 align-baseline">&nbsp;</span>
          {p.cloze.after}
        </p>
      ) : null}
      {p.sub ? <p className="mx-auto mt-3 max-w-xl text-sm text-ink-3">{p.sub}</p> : null}
      {p.speak ? (
        <div className="mt-3 flex justify-center">
          <ListenButton text={p.speak} />
        </div>
      ) : null}
    </div>
  );
}

export function QuestionView({
  question,
  onAnswer,
  result,
  timer,
  autoFocus = true,
}: {
  question: Question;
  onAnswer: (r: AnswerResult) => void;
  result: AnswerResult | null;
  /** Seconds; typed/choice questions auto-submit as wrong when it runs out. */
  timer?: number | null;
  autoFocus?: boolean;
}) {
  const startedAt = useRef(Date.now());
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [remaining, setRemaining] = useState(timer ?? 0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const answered = !!result;
  const vocab = useAppStore((s) => s.vocab[question.vocabId]);
  const progress = useAppStore((s) => s.progress[question.vocabId]);

  useEffect(() => {
    startedAt.current = Date.now();
    setTyped("");
    setPicked(null);
    setHint(false);
    setRemaining(timer ?? 0);
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 30);
  }, [question.id, timer, autoFocus]);

  const elapsed = () => Date.now() - startedAt.current;

  const submitTyped = (value: string, timedOut = false) => {
    if (answered || question.kind !== "typed") return;
    const verdict = isAcceptedAnswer(value, question.word, question.answer);
    const near = !verdict && value.trim().length > 4 && levenshtein(value.trim().toLowerCase(), question.answer.toLowerCase()) <= 1;
    const note =
      verdict === "form" && question.answer.toLowerCase() !== value.trim().toLowerCase() && question.answer.toLowerCase() !== question.word.toLowerCase()
        ? `Accepted. The sentence uses “${question.answer}”.`
        : near
          ? `So close — check the spelling: “${question.answer}”.`
          : undefined;
    if (!verdict) setShake(true);
    onAnswer({ correct: !!verdict, responseTime: elapsed(), given: value, note, timedOut });
  };

  const submitChoice = (id: string) => {
    if (answered || question.kind !== "choice") return;
    setPicked(id);
    const correct = id === question.answerId;
    if (!correct) setShake(true);
    onAnswer({ correct, responseTime: elapsed(), given: question.options.find((o) => o.id === id)?.label ?? id });
  };

  const submitCefr = (level: CefrLevel) => {
    if (answered || question.kind !== "cefr") return;
    setPicked(level);
    const diff = Math.abs(cefrIndex(level) - cefrIndex(question.answer));
    onAnswer({ correct: diff === 0, partial: diff === 1, responseTime: elapsed(), given: level });
  };

  // Timer
  useEffect(() => {
    if (!timer || answered) return;
    const t = setInterval(() => {
      const left = Math.max(0, timer - elapsed() / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        if (question.kind === "typed") submitTyped(inputRef.current?.value ?? "", true);
        else if (question.kind === "choice") onAnswer({ correct: false, responseTime: elapsed(), given: "", timedOut: true });
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, timer, answered]);

  // Number keys for choices / CEFR
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (answered || e.metaKey || e.ctrlKey || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (question.kind === "flip" && e.key === " " && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLElement && e.target.getAttribute("role") === "button")) {
        e.preventDefault();
        onAnswer({ correct: true, selfRated: true, responseTime: elapsed(), given: "" });
        return;
      }
      const n = Number(e.key);
      if (question.kind === "choice" && n >= 1 && n <= question.options.length) submitChoice(question.options[n - 1].id);
      if (question.kind === "cefr" && n >= 1 && n <= 6) submitCefr(CEFR_LEVELS[n - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, answered]);

  useEffect(() => {
    if (!shake) return;
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [shake]);

  return (
    <div className={cn(shake && "animate-shake")}>
      {timer ? (
        <div className="mx-auto mb-6 h-1 max-w-md overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div
            className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", remaining / timer < 0.3 ? "bg-bad" : "bg-ink")}
            style={{ width: `${answered ? 0 : (remaining / timer) * 100}%` }}
          />
        </div>
      ) : null}

      {question.kind !== "flip" ? <Prompt q={question} /> : null}

      <div className="mx-auto mt-8 max-w-2xl">
        {question.kind === "choice" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {question.options.map((o, i) => {
              const isAnswer = o.id === question.answerId;
              const isPicked = picked === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={answered}
                  onClick={() => submitChoice(o.id)}
                  className={cn(
                    "group flex min-h-14 items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition-all",
                    !answered && "border-line-strong bg-surface hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-card",
                    answered && isAnswer && "border-good bg-good-soft",
                    answered && isPicked && !isAnswer && "border-bad bg-bad-soft",
                    answered && !isAnswer && !isPicked && "border-line bg-surface opacity-60",
                  )}
                >
                  <Kbd className="shrink-0">{i + 1}</Kbd>
                  <span className="flex-1 text-[15px] font-medium text-ink">{o.label}</span>
                  {answered && isAnswer ? <Check className="size-4 text-good-ink" /> : null}
                  {answered && isPicked && !isAnswer ? <X className="size-4 text-bad-ink" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {question.kind === "typed" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitTyped(typed);
            }}
            className="mx-auto max-w-md"
          >
            <div className="relative">
              <Input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={answered}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Type the word"
                aria-label="Your answer"
                className={cn(
                  "h-14 text-center text-2xl headword",
                  answered && (result?.correct ? "border-good bg-good-soft" : "border-bad bg-bad-soft"),
                )}
                style={{ fontFamily: "var(--font-serif)" }}
              />
            </div>
            {!answered ? (
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setHint(true)} className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink" disabled={hint}>
                  <Lightbulb className="size-3.5" />
                  {hint ? <span className="font-mono text-ink-2">{question.hint}</span> : "Show hint"}
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => submitTyped("")}>
                    I don&rsquo;t know
                  </button>
                  <Button type="submit" size="sm" variant="primary" disabled={!typed.trim()}>
                    Check <Kbd className="border-transparent bg-white/15 text-inherit">↵</Kbd>
                  </Button>
                </div>
              </div>
            ) : null}
          </form>
        ) : null}

        {question.kind === "cefr" ? (
          <div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CEFR_LEVELS.map((l, i) => {
                const isAnswer = l === question.answer;
                const isPicked = picked === l;
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={answered}
                    onClick={() => submitCefr(l)}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 rounded-[10px] border font-mono text-lg font-semibold transition-all",
                      !answered && "border-line-strong bg-surface hover:-translate-y-0.5 hover:shadow-card",
                      answered && isAnswer && "border-good bg-good-soft",
                      answered && isPicked && !isAnswer && "border-bad bg-bad-soft",
                      answered && !isAnswer && !isPicked && "opacity-50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-ink">
                      <span className="size-2.5 rounded-[2px]" style={{ background: cefrVar(l) }} />
                      {l}
                    </span>
                    <Kbd className="h-4 text-[9px]">{i + 1}</Kbd>
                  </button>
                );
              })}
            </div>
            {answered ? (
              <p className="mt-4 text-center text-sm text-ink-2">
                {question.source === "estimated" ? "Estimated CEFR" : question.source === "source" ? "CEFR from your notes" : "CEFR you confirmed"}: <strong className="font-mono text-ink">{question.answer}</strong>
                {question.source === "estimated" ? <span className="block text-xs text-ink-3">Estimates aren&rsquo;t absolute — you can change it on the word page.</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {question.kind === "flip" && vocab ? (
          <div className="mx-auto max-w-md">
            <VocabCard
              vocab={vocab}
              progress={progress}
              hideAnswerOnFront
              showActions={false}
              flipped={answered}
              onFlip={(f) => {
                if (f && !answered) onAnswer({ correct: true, selfRated: true, responseTime: elapsed(), given: "" });
              }}
            />
            {!answered ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="primary"
                  onClick={() => onAnswer({ correct: true, selfRated: true, responseTime: elapsed(), given: "" })}
                >
                  <Eye /> Reveal meaning <Kbd className="border-transparent bg-white/15 text-inherit">space</Kbd>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {question.kind === "write" ? <WriteTask question={question} answered={answered} result={result} onAnswer={onAnswer} startedAt={startedAt.current} /> : null}
      </div>
    </div>
  );
}

function WriteTask({
  question,
  answered,
  result,
  onAnswer,
  startedAt,
}: {
  question: Extract<Question, { kind: "write" }>;
  answered: boolean;
  result: AnswerResult | null;
  onAnswer: (r: AnswerResult) => void;
  startedAt: number;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = useAiStatus();
  const vocab = useAppStore((s) => s.vocab[question.vocabId]);
  const logSentence = useAppStore((s) => s.logSentence);

  useEffect(() => {
    setText("");
    setError(null);
  }, [question.id]);

  const check = async () => {
    const used = !!findWordInSentence(text, question.word);
    if (!status?.configured) {
      logSentence(question.vocabId);
      onAnswer({
        correct: used,
        responseTime: Date.now() - startedAt,
        given: text,
        note: used ? "Nice — you used the word. Add an AI key for grammar and naturalness feedback." : `Your sentence doesn't seem to include “${question.word.toLowerCase()}”.`,
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { evaluation } = await aiJson<{ evaluation: Evaluation }>("/api/ai/evaluate", {
        word: question.word,
        meaning: vocab ? allMeaningsText(vocab) : undefined,
        task: question.task,
        category: "Sentence practice",
        sentence: text,
      });
      logSentence(question.vocabId);
      onAnswer({ correct: evaluation.targetWordUsedCorrectly, responseTime: Date.now() - startedAt, given: text, evaluation });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check the sentence");
    } finally {
      setBusy(false);
    }
  };

  if (answered && result) {
    return result.evaluation ? (
      <EvaluationView evaluation={result.evaluation} sentence={result.given} />
    ) : (
      <div className="rounded-[10px] border border-line bg-surface p-4 text-sm text-ink-2">
        <div className="eyebrow mb-1">Your sentence</div>
        <p className="text-[15px] text-ink">{result.given || "—"}</p>
      </div>
    );
  }

  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        placeholder={`Use “${question.word.toLowerCase()}” in a sentence…`}
        aria-label="Your sentence"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim().length > 3) void check();
        }}
        className="text-base"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <Sparkles className="size-3.5" />
          {status?.configured ? "AI checks grammar, usage and naturalness" : "Offline check — add an AI key for full feedback"}
        </span>
        <Button variant="primary" size="sm" onClick={check} disabled={busy || text.trim().length < 4}>
          {busy ? <Spinner className="text-bg" /> : <Send />}
          Check sentence
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-bad-ink">{error}</p> : null}
    </div>
  );
}

export function Feedback({ question, result, onNext, nextLabel = "Next" }: { question: Question; result: AnswerResult; onNext?: () => void; nextLabel?: string }) {
  const openQuickView = useUiStore((s) => s.openQuickView);
  const vocab = useAppStore((s) => s.vocab[question.vocabId]);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!onNext) return;
    const t = setTimeout(() => nextRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onNext]);

  if (result.selfRated) return null;
  const tone = result.correct ? "good" : result.partial ? "accent" : "bad";
  return (
    <div
      className={cn(
        "mx-auto mt-6 flex max-w-2xl flex-col gap-3 rounded-[10px] border p-4 animate-rise sm:flex-row sm:items-center",
        tone === "good" && "border-good/40 bg-good-soft",
        tone === "accent" && "border-accent/40 bg-accent-soft",
        tone === "bad" && "border-bad/30 bg-bad-soft",
      )}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", tone === "good" ? "text-good-ink" : tone === "accent" ? "text-accent-ink" : "text-bad-ink")}>
          {result.correct ? "Correct" : result.partial ? "Close — one level off" : result.timedOut ? "Time's up" : "Not quite"}
          {question.kind === "typed" && !result.correct ? <span className="ml-2 font-normal text-ink">Answer: <strong>{question.answer}</strong></span> : null}
        </div>
        {result.note ? <p className="mt-0.5 text-sm text-ink-2">{result.note}</p> : null}
        <p className="mt-1 text-sm text-ink-2">{question.explain}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {vocab ? (
          <Button size="sm" variant="ghost" onClick={() => openQuickView(vocab.id)}>
            Open card
          </Button>
        ) : null}
        {onNext ? (
          <Button ref={nextRef} size="sm" variant="primary" onClick={onNext}>
            {nextLabel} <ArrowRight />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
