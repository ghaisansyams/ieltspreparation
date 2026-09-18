"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarCheck, Gamepad2, PartyPopper, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { Feedback, QuestionView, type AnswerResult } from "@/components/games/question-view";
import { EmptyLibrary } from "@/components/vocab/empty-library";
import { reviewQuestion, type Question } from "@/lib/games/questions";
import { buildReviewQueue, wordsYouKeepForgetting } from "@/lib/learning/priority";
import { exerciseFor, newProgress, nextInterval } from "@/lib/learning/srs";
import { useAppStore } from "@/lib/store/app-store";
import type { ExerciseType, Rating } from "@/lib/types";
import { cn, endOfDay, formatInterval } from "@/lib/utils";

const EXERCISE_LABEL: Record<ExerciseType, string> = {
  flashcard: "Flashcard",
  "multiple-choice": "Multiple choice",
  "sentence-completion": "Sentence completion",
  "reverse-translation": "Translation",
  "synonym-match": "Synonyms",
  "use-it": "Use it in a sentence",
};

const RATINGS: { rating: Rating; label: string; key: string; tone: string }[] = [
  { rating: "again", label: "Again", key: "1", tone: "hover:border-bad hover:bg-bad-soft" },
  { rating: "hard", label: "Hard", key: "2", tone: "hover:border-warn hover:bg-warn-soft" },
  { rating: "good", label: "Good", key: "3", tone: "hover:border-accent hover:bg-accent-soft" },
  { rating: "easy", label: "Easy", key: "4", tone: "hover:border-good hover:bg-good-soft" },
];

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewSession />
    </Suspense>
  );
}

interface Item {
  vocabId: string;
  question: Question;
  requeued: boolean;
}

function ReviewSession() {
  const params = useSearchParams();
  const focus = params.get("focus");
  const reviewWord = useAppStore((s) => s.reviewWord);

  const [items, setItems] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [tally, setTally] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const startedAt = useRef(Date.now());

  const build = useCallback(
    (ahead = false) => {
      const { vocab, progress, profile } = useAppStore.getState();
      const pool = Object.values(vocab);
      let ids: string[];
      if (focus === "struggling") {
        ids = wordsYouKeepForgetting(vocab, progress, new Date(), 20).map((w) => w.vocab.id);
      } else if (ahead) {
        ids = Object.values(progress)
          .filter((p) => p.nextReviewAt && vocab[p.vocabularyId])
          .sort((a, b) => a.nextReviewAt!.localeCompare(b.nextReviewAt!))
          .slice(0, 10)
          .map((p) => p.vocabularyId);
      } else {
        ids = buildReviewQueue(vocab, progress, { newLimit: profile.settings.newWordsPerDay, endOfToday: endOfDay() });
      }
      const next = ids
        .filter((id) => vocab[id])
        .map((id) => {
          const p = progress[id] ?? newProgress(id);
          return { vocabId: id, question: reviewQuestion(vocab[id], exerciseFor(p), pool, Math.random), requeued: false };
        });
      setItems(next);
      setIndex(0);
      setResult(null);
      setTally({ again: 0, hard: 0, good: 0, easy: 0 });
      startedAt.current = Date.now();
    },
    [focus],
  );

  useEffect(() => build(), [build]);

  const current = items?.[index];
  const vocab = useAppStore((s) => (current ? s.vocab[current.vocabId] : undefined));
  const progress = useAppStore((s) => (current ? s.progress[current.vocabId] : undefined));

  const previews = useMemo(() => {
    const p = progress ?? (current ? newProgress(current.vocabId) : null);
    if (!p) return null;
    return Object.fromEntries(RATINGS.map((r) => [r.rating, formatInterval(nextInterval(p, r.rating).interval)])) as Record<Rating, string>;
  }, [progress, current]);

  const allowed = (r: Rating) => !result || result.selfRated || result.correct || r === "again" || r === "hard";
  const suggested: Rating | null = !result ? null : result.selfRated ? null : !result.correct ? "again" : result.responseTime < 5000 ? "easy" : "good";

  const rate = useCallback(
    (rating: Rating) => {
      if (!current || !result || !allowed(rating)) return;
      reviewWord(current.vocabId, rating, current.question.exercise, result.responseTime);
      setTally((t) => ({ ...t, [rating]: t[rating] + 1 }));
      setItems((list) => {
        if (!list) return list;
        // Missed words come back once at the end of the session.
        if (rating === "again" && !current.requeued) {
          const { vocab: v, progress: pr } = useAppStore.getState();
          const again = v[current.vocabId]
            ? { vocabId: current.vocabId, question: reviewQuestion(v[current.vocabId], "flashcard", Object.values(v), Math.random), requeued: true }
            : null;
          void pr;
          return again ? [...list, again] : list;
        }
        return list;
      });
      setResult(null);
      setIndex((i) => i + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, result, reviewWord],
  );

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const r = RATINGS.find((x) => x.key === e.key);
      if (r) {
        e.preventDefault();
        rate(r.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, rate]);

  if (!items) return null;

  if (items.length === 0 && Object.keys(useAppStore.getState().vocab).length === 0) {
    return (
      <div className="mx-auto mt-6 max-w-3xl">
        <EmptyLibrary feature="Reviews" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Panel className="mx-auto mt-6 max-w-xl p-10 text-center animate-rise">
        <CalendarCheck className="mx-auto size-10 text-good" />
        <h1 className="headword mt-4 text-4xl text-ink">All caught up.</h1>
        <p className="mt-2 text-sm text-ink-2">{focus === "struggling" ? "No struggling words right now." : "Nothing is due. Keep momentum with a game or today's challenge — or review ahead."}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="primary">
            <Link href="/challenge">Daily challenge <ArrowRight /></Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/games"><Gamepad2 /> Games</Link>
          </Button>
          <Button variant="ghost" onClick={() => build(true)}>
            <Repeat /> Review ahead
          </Button>
        </div>
      </Panel>
    );
  }

  if (index >= items.length) {
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const recalled = total - tally.again;
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <Panel className="mx-auto mt-6 max-w-xl overflow-hidden animate-rise">
        <div className="dot-grid px-8 py-10 text-center">
          <PartyPopper className="mx-auto size-9 text-series-2" />
          <h1 className="headword mt-4 text-4xl text-ink">Session complete</h1>
          <p className="mt-2 text-sm text-ink-2">
            {total} reviews · {total ? Math.round((recalled / total) * 100) : 0}% recalled · about {mins} min
          </p>
        </div>
        <div className="grid grid-cols-4 border-t border-line">
          {RATINGS.map((r) => (
            <div key={r.rating} className="border-r border-line px-3 py-4 text-center last:border-r-0">
              <div className="eyebrow">{r.label}</div>
              <div className="mt-1 text-xl font-semibold text-ink">{tally[r.rating]}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 border-t border-line p-5">
          <Button asChild variant="primary">
            <Link href="/">Dashboard</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/games/boss-battle">Boss battle</Link>
          </Button>
          <Button variant="ghost" onClick={() => build()}>
            Check for more
          </Button>
        </div>
      </Panel>
    );
  }

  if (!current || !vocab) {
    setTimeout(() => setIndex((i) => i + 1), 0);
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="End session">
          <Link href="/">
            <X />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">
              {focus === "struggling" ? "Struggling words" : "Review"} · <span className="text-ink-3">{EXERCISE_LABEL[current.question.exercise]}</span>
              {current.requeued ? <span className="ml-2 text-warn-ink">again</span> : null}
            </span>
            <span className="font-mono text-ink-3">
              {index + 1}/{items.length}
            </span>
          </div>
          <ProgressBar value={index / items.length} tone="ink" />
        </div>
      </div>

      <Panel className="px-5 py-8 sm:px-10 sm:py-12">
        <QuestionView key={`${current.question.id}-${index}`} question={current.question} onAnswer={setResult} result={result} />
      </Panel>

      {result ? (
        <>
          <Feedback question={current.question} result={result} />
          <div className="mx-auto mt-5 max-w-2xl animate-rise">
            <p className="mb-2.5 text-center text-sm text-ink-2">How well did you remember?</p>
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map((r) => {
                const disabled = !allowed(r.rating);
                return (
                  <button
                    key={r.rating}
                    type="button"
                    disabled={disabled}
                    onClick={() => rate(r.rating)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-[10px] border bg-surface px-2 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                      suggested === r.rating ? "border-ink shadow-card" : "border-line-strong",
                      !disabled && r.tone,
                    )}
                  >
                    <span className="text-sm font-semibold text-ink">{r.label}</span>
                    <span className="font-mono text-[11px] text-ink-3">{previews?.[r.rating]}</span>
                    <Kbd className="mt-0.5 hidden sm:inline-flex">{r.key}</Kbd>
                  </button>
                );
              })}
            </div>
            {!result.selfRated && !result.correct ? <p className="mt-2 text-center text-xs text-ink-3">Missed answers can only be rated Again or Hard.</p> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
