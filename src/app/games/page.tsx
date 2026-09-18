"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Clock, Lock, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/ui/panel";
import { EmptyLibrary } from "@/components/vocab/empty-library";
import { GAMES } from "@/lib/games/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

export default function GamesPage() {
  const total = useAppStore((s) => Object.keys(s.vocab).length);
  const attempts = useAppStore((s) => s.attempts);

  const byType = useMemo(() => {
    const map = new Map<string, { n: number; correct: number }>();
    for (const a of attempts) {
      const m = map.get(a.quizType) ?? { n: 0, correct: 0 };
      m.n++;
      if (a.isCorrect) m.correct++;
      map.set(a.quizType, m);
    }
    return map;
  }, [attempts]);

  const boss = GAMES.find((g) => g.id === "boss-battle")!;
  const rest = GAMES.filter((g) => g.id !== "boss-battle");

  return (
    <div>
      <PageHeader eyebrow="Game center" title="Play with your words" description="Every game draws from your own library and leans toward the words you're weakest on. Answers feed your spaced-repetition schedule." />

      {total < boss.minWords ? <EmptyLibrary feature="Games" needed={boss.minWords} className="mb-4" /> : null}

      <Link
        href={total >= boss.minWords ? `/games/${boss.id}` : "#"}
        aria-disabled={total < boss.minWords}
        tabIndex={total < boss.minWords ? -1 : undefined}
        className={cn("group block", total < boss.minWords && "pointer-events-none opacity-45")}
      >
        <Panel className="relative mb-4 overflow-hidden p-6 transition-colors group-hover:border-line-strong sm:p-8">
          <div className="hairline-grid absolute inset-0 opacity-70" aria-hidden />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="eyebrow flex items-center gap-2">
                <Swords className="size-3.5" /> Game 9 · Challenge
              </div>
              <h2 className="headword mt-3 text-[clamp(2rem,4vw,2.8rem)] text-ink">{boss.title}</h2>
              <p className="mt-2 max-w-lg text-sm text-ink-2">{boss.tagline} Get one right and the next gets harder; miss and it eases off. Score, accuracy, time, words missed and words mastered at the end.</p>
            </div>
            <span className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-ink px-5 text-sm font-medium text-bg sm:self-auto">
              {total < boss.minWords ? (
                <>
                  <Lock className="size-4" /> Locked
                </>
              ) : (
                <>
                  Enter battle <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </div>
        </Panel>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rest.map((g) => {
          const locked = total < g.minWords;
          const stat = byType.get(g.quizType);
          return (
            <Link
              key={g.id}
              href={locked ? "#" : `/games/${g.id}`}
              aria-disabled={locked}
              tabIndex={locked ? -1 : undefined}
              className={cn(
                "group flex flex-col rounded-[10px] border border-line bg-surface p-5 transition-[border,transform,box-shadow] duration-200",
                locked ? "pointer-events-none opacity-45" : "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-3">{String(g.number).padStart(2, "0")}</span>
                {locked ? (
                  <Badge tone="neutral">
                    <Lock /> Locked
                  </Badge>
                ) : (
                  <Badge tone="outline">{g.skill}</Badge>
                )}
              </div>
              <h3 className="mt-6 text-[17px] font-semibold tracking-tight text-ink">{g.title}</h3>
              <p className="mt-1 flex-1 text-sm text-ink-2">{g.tagline}</p>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-3">
                <span className="flex items-center gap-1.5">
                  {locked ? <Lock className="size-3.5" /> : g.timer ? <Clock className="size-3.5" /> : null}
                  {locked ? `Needs ${g.minWords} words` : `${g.rounds} rounds${g.timer ? ` · ${g.timer}s each` : ""}`}
                </span>
                <span className="font-mono">{stat ? `${Math.round((stat.correct / stat.n) * 100)}% · ${stat.n}` : "new"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
