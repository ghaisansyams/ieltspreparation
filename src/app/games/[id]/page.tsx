"use client";

import Link from "next/link";
import { use, useMemo, useRef, useState } from "react";
import { ChevronsUp, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { RunSession } from "@/components/games/run-session";
import type { AnswerResult } from "@/components/games/question-view";
import { gameById } from "@/lib/games/catalog";
import { bossQuestion, type Question } from "@/lib/games/questions";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const game = gameById(id);
  if (!game) {
    return (
      <Panel className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-ink-2">Unknown game.</p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/games">All games</Link>
        </Button>
      </Panel>
    );
  }
  return id === "boss-battle" ? <BossBattle /> : <StandardGame id={id} />;
}

function StandardGame({ id }: { id: string }) {
  const game = gameById(id)!;
  // Snapshot the library once so answering doesn't reshuffle the run.
  const [questions] = useState<Question[]>(() => {
    const { vocab, progress } = useAppStore.getState();
    return game.build ? game.build(Object.values(vocab), progress, Math.random) : [];
  });
  return (
    <RunSession
      title={game.title}
      questions={questions}
      rounds={game.rounds}
      timer={game.timer}
      autoAdvance={game.id === "flashcard-rush"}
      scoreOnly={game.id === "cefr-challenge"}
    />
  );
}

function BossBattle() {
  const game = gameById("boss-battle")!;
  const level = useRef(1);
  const used = useRef(new Set<string>());
  const pool = useMemo(() => Object.values(useAppStore.getState().vocab), []);

  const next = (history: { question: Question; result: AnswerResult }[]) => {
    if (history.length === 0) {
      level.current = 1;
      used.current = new Set();
    } else {
      const last = history[history.length - 1];
      level.current = Math.max(1, Math.min(5, level.current + (last.result.correct ? 1 : -1)));
    }
    const q = bossQuestion(level.current, pool, used.current, useAppStore.getState().progress, Math.random);
    if (q) used.current.add(q.vocabId);
    return q;
  };

  return (
    <RunSession
      title={game.title}
      next={next}
      rounds={game.rounds}
      header={({ history }) => {
        const hits = history.filter((h) => h.result.correct).length;
        const hp = game.rounds - hits;
        return (
          <div className="mb-4 flex items-center gap-4 rounded-[10px] border border-line bg-surface px-4 py-3">
            <Skull className="size-5 text-ink-2" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="eyebrow">Boss HP</span>
                <span className="font-mono text-ink-3">{hp}/{game.rounds}</span>
              </div>
              <div className="flex gap-[2px]">
                {Array.from({ length: game.rounds }, (_, i) => (
                  <div key={i} className={cn("h-2 flex-1 rounded-[2px] transition-colors duration-500", i < hp ? "bg-bad" : "bg-surface-3")} />
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="eyebrow">Difficulty</div>
              <div className="flex items-center justify-end gap-1 font-mono text-sm font-semibold text-ink">
                <ChevronsUp className="size-4 text-series-2" />
                {level.current}/5
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}
