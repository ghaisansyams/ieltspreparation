"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Award, Clock, Flame, RotateCcw, Target, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { CefrBadge } from "@/components/vocab/bits";
import { EmptyLibrary } from "@/components/vocab/empty-library";
import { XP } from "@/lib/learning/gamification";
import type { Question } from "@/lib/games/questions";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { shortMeaning } from "@/lib/vocab/fields";
import { cn } from "@/lib/utils";
import { Feedback, QuestionView, type AnswerResult } from "./question-view";

export interface RunSummary {
  total: number;
  correct: number;
  accuracy: number;
  durationMs: number;
  xp: number;
  missed: string[];
  strong: string[];
  perfect: boolean;
}

interface Props {
  title: string;
  /** Static question list … */
  questions?: Question[];
  /** … or a generator for adaptive runs (boss battle). Return null to end early. */
  next?: (history: { question: Question; result: AnswerResult }[]) => Question | null;
  rounds: number;
  timer?: number | null;
  /** Advance automatically after a correct answer (fast games). */
  autoAdvance?: boolean;
  exitHref?: string;
  /** Rendered above the question (e.g. boss HP). */
  header?: (state: { index: number; history: { question: Question; result: AnswerResult }[] }) => React.ReactNode;
  onFinish?: (summary: RunSummary) => void;
  renderFinish?: (summary: RunSummary, restart: () => void) => React.ReactNode;
  /** Don't count toward spaced repetition (e.g. CEFR guessing). */
  scoreOnly?: boolean;
}

export function RunSession({ title, questions, next, rounds, timer, autoAdvance, exitHref = "/games", header, onFinish, renderFinish, scoreOnly }: Props) {
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const awardXp = useAppStore((s) => s.awardXp);
  const checkAchievements = useAppStore((s) => s.checkAchievements);

  const [runKey, setRunKey] = useState(0);
  const [history, setHistory] = useState<{ question: Question; result: AnswerResult }[]>([]);
  const [current, setCurrent] = useState<Question | null>(() => (questions ? questions[0] ?? null : next ? next([]) : null));
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const startedAt = useRef(Date.now());
  const total = questions ? Math.min(rounds, questions.length) : rounds;

  const restart = useCallback(() => {
    setRunKey((k) => k + 1);
    setHistory([]);
    setResult(null);
    setSummary(null);
    setXp(0);
    setCombo(0);
    startedAt.current = Date.now();
    setCurrent(questions ? questions[0] ?? null : next ? next([]) : null);
  }, [questions, next]);

  const finish = useCallback(
    (h: { question: Question; result: AnswerResult }[], earned: number) => {
      const graded = h.filter((x) => !x.result.selfRated);
      const correct = graded.filter((x) => x.result.correct).length;
      const perfect = graded.length >= 5 && correct === graded.length;
      let bonus = 0;
      if (perfect) {
        bonus = XP.perfectRun;
        awardXp(bonus, "Perfect run");
      }
      const missed = [...new Set(graded.filter((x) => !x.result.correct).map((x) => x.question.vocabId))];
      const strong = [...new Set(graded.filter((x) => x.result.correct).map((x) => x.question.vocabId))].filter((id) => !missed.includes(id));
      const s: RunSummary = {
        total: graded.length,
        correct,
        accuracy: graded.length ? correct / graded.length : 0,
        durationMs: Date.now() - startedAt.current,
        xp: earned + bonus,
        missed,
        strong,
        perfect,
      };
      checkAchievements({ perfectRun: perfect });
      setSummary(s);
      onFinish?.(s);
    },
    [awardXp, checkAchievements, onFinish],
  );

  const advance = useCallback(() => {
    if (!current || !result) return;
    const h = [...history, { question: current, result }];
    setHistory(h);
    setResult(null);
    const nextQ = h.length >= total ? null : questions ? questions[h.length] ?? null : next ? next(h) : null;
    if (!nextQ) finish(h, xp);
    else setCurrent(nextQ);
  }, [current, result, history, total, questions, next, finish, xp]);

  const onAnswer = (r: AnswerResult) => {
    if (!current || result) return;
    setResult(r);
    if (r.selfRated) return;
    let earned: number;
    if (scoreOnly || current.kind === "cefr") {
      earned = r.correct ? XP.gameCorrect : r.partial ? 5 : 0;
      if (earned) awardXp(earned, title);
    } else {
      earned = r.correct ? XP.gameCorrect : XP.gameWrong;
      answerQuestion(current.vocabId, current.quizType, r.correct, r.responseTime);
    }
    setXp((x) => x + earned);
    setCombo((c) => (r.correct ? c + 1 : 0));
  };

  useEffect(() => {
    if (!autoAdvance || !result?.correct || result.selfRated || current?.kind === "write") return;
    const t = setTimeout(advance, 850);
    return () => clearTimeout(t);
  }, [autoAdvance, result, advance, current]);

  if (summary) {
    return renderFinish ? <>{renderFinish(summary, restart)}</> : <Results title={title} summary={summary} onRestart={restart} exitHref={exitHref} />;
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyLibrary feature="Games" needed={8} />
        <div className="mt-3 text-center">
          <Button asChild size="sm" variant="ghost">
            <Link href={exitHref}>Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  const done = history.length + (result ? 1 : 0);
  const correctSoFar = history.filter((h) => h.result.correct).length + (result?.correct ? 1 : 0);

  return (
    <div key={runKey} className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Exit">
          <Link href={exitHref}>
            <X />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="truncate font-medium text-ink">{title}</span>
            <span className="font-mono text-ink-3">
              {Math.min(done, total)}/{total}
            </span>
          </div>
          <ProgressBar value={done / total} tone="ink" />
        </div>
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="flex items-center gap-1 text-ink-2" title="Correct">
            <Target className="size-3.5" />
            {correctSoFar}
          </span>
          <span className={cn("flex items-center gap-1", combo >= 3 ? "text-series-2" : "text-ink-3")} title="Combo">
            <Flame className="size-3.5" />
            {combo}
          </span>
          <span className="flex items-center gap-1 text-ink-2" title="XP this run">
            <Zap className="size-3.5" />
            {xp}
          </span>
        </div>
      </div>

      {header ? header({ index: history.length, history }) : null}

      <Panel className="px-5 py-8 sm:px-10 sm:py-12">
        <QuestionView key={current.id} question={current} onAnswer={onAnswer} result={result} timer={timer} />
      </Panel>

      {result && !result.selfRated ? (
        <Feedback question={current} result={result} onNext={advance} nextLabel={history.length + 1 >= total ? "See results" : "Next"} />
      ) : null}
    </div>
  );
}

export function Results({ title, summary, onRestart, exitHref, extra }: { title: string; summary: RunSummary; onRestart: () => void; exitHref: string; extra?: React.ReactNode }) {
  const vocab = useAppStore((s) => s.vocab);
  const progress = useAppStore((s) => s.progress);
  const openQuickView = useUiStore((s) => s.openQuickView);
  const mastered = useMemo(() => summary.strong.filter((id) => (progress[id]?.mastery ?? 0) >= 60 || progress[id]?.status === "mastered"), [summary.strong, progress]);
  const pctScore = Math.round(summary.accuracy * 100);
  const secs = Math.round(summary.durationMs / 1000);

  return (
    <div className="mx-auto max-w-3xl animate-rise">
      <Panel className="overflow-hidden">
        <div className="dot-grid border-b border-line px-6 py-10 text-center">
          <div className="eyebrow">{title} · results</div>
          <div className="mt-4 text-[64px] font-semibold leading-none tracking-tight text-ink">{pctScore}%</div>
          <p className="mt-2 text-sm text-ink-2">
            {summary.perfect ? "Perfect run — not a single mistake." : pctScore >= 80 ? "Strong recall. Keep the streak going." : pctScore >= 50 ? "Solid — the missed words are queued for review." : "Tough round. Missed words are back in today's review."}
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          {[
            { icon: Target, label: "Score", value: `${summary.correct}/${summary.total}` },
            { icon: Award, label: "Accuracy", value: `${pctScore}%` },
            { icon: Clock, label: "Time", value: secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s` },
            { icon: Zap, label: "XP earned", value: `+${summary.xp}` },
          ].map((s) => (
            <div key={s.label} className="px-5 py-4">
              <div className="eyebrow flex items-center gap-1.5">
                <s.icon className="size-3.5" />
                {s.label}
              </div>
              <div className="mt-1 text-xl font-semibold text-ink">{s.value}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <WordList title="Words missed" empty="None — nicely done." ids={summary.missed} vocab={vocab} onOpen={openQuickView} tone="bad" />
        <WordList title="Words mastered" empty="Keep reviewing to master words." ids={mastered} vocab={vocab} onOpen={openQuickView} tone="good" />
      </div>

      {extra}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild variant="ghost">
          <Link href={exitHref}>
            <ArrowLeft /> Back
          </Link>
        </Button>
        <Button variant="primary" onClick={onRestart}>
          <RotateCcw /> Play again
        </Button>
        {summary.missed.length ? (
          <Button asChild variant="secondary">
            <Link href="/review">Review missed words</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WordList({
  title,
  ids,
  vocab,
  onOpen,
  empty,
  tone,
}: {
  title: string;
  ids: string[];
  vocab: Record<string, import("@/lib/types").Vocabulary>;
  onOpen: (id: string) => void;
  empty: string;
  tone: "good" | "bad";
}) {
  return (
    <Panel className="p-4">
      <div className="eyebrow mb-2 flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", tone === "good" ? "bg-good" : "bg-bad")} />
        {title} · {ids.length}
      </div>
      {ids.length ? (
        <ul className="divide-y divide-line">
          {ids.map((id) =>
            vocab[id] ? (
              <li key={id}>
                <button type="button" onClick={() => onOpen(id)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-ink">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{vocab[id].word}</span>
                    <span className="block truncate text-xs text-ink-3">{shortMeaning(vocab[id])}</span>
                  </span>
                  <CefrBadge level={vocab[id].cefr} source={vocab[id].cefrSource} size="sm" />
                </button>
              </li>
            ) : null,
          )}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">{empty}</p>
      )}
    </Panel>
  );
}
