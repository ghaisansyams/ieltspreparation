"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock, Flame, Sparkles, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Results, RunSession } from "@/components/games/run-session";
import { MiniStory } from "@/components/tutor/mini-story";
import { CefrBadge } from "@/components/vocab/bits";
import { EmptyLibrary } from "@/components/vocab/empty-library";
import { useAiStatus } from "@/hooks/use-ai-status";
import { dailyPlan, type DailyPlan } from "@/lib/games/daily";
import { useAppStore } from "@/lib/store/app-store";
import { shortMeaning } from "@/lib/vocab/fields";

export default function ChallengePage() {
  const [plan] = useState<DailyPlan>(() => {
    const { vocab, progress } = useAppStore.getState();
    return dailyPlan(vocab, progress);
  });
  const [started, setStarted] = useState(false);
  const done = useAppStore((s) => !!s.profile.dailyChallenges[plan.date]);
  // Captured before playing: finishing flips `done`, but the reward still belongs to this run.
  const [rewardPending] = useState(() => !useAppStore.getState().profile.dailyChallenges[plan.date]);
  const completeDailyChallenge = useAppStore((s) => s.completeDailyChallenge);
  const aiStatus = useAiStatus();

  if (!plan.questions.length) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyLibrary feature="Daily challenges" needed={8} />
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl animate-rise">
        <Panel className="overflow-hidden">
          <div className="hairline-grid px-6 py-10 text-center sm:px-10">
            <div className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            <h1 className="headword mt-3 text-[clamp(2.4rem,6vw,3.6rem)] text-ink">Today&rsquo;s challenge</h1>
            <div className="mt-6 flex flex-wrap justify-center gap-6 font-mono text-sm text-ink">
              <span className="flex items-center gap-2"><Flame className="size-4 text-series-2" /> {plan.reviewWords.length + plan.newWords.length} WORDS</span>
              <span className="flex items-center gap-2"><Swords className="size-4 text-series-2" /> {plan.questions.length} QUESTIONS</span>
              <span className="flex items-center gap-2"><Clock className="size-4 text-series-2" /> {plan.estimatedMinutes} MINUTES</span>
            </div>
            <div className="mt-4">
              {done ? <Badge tone="good"><Check /> Completed today — replay for practice</Badge> : <Badge tone="accent">Reward +{plan.reward} XP</Badge>}
            </div>
          </div>
          <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
            <WordColumn title={`${plan.reviewWords.length} review words`} words={plan.reviewWords} />
            <WordColumn title={`${plan.newWords.length} new words`} words={plan.newWords} />
          </div>
          <div className="flex flex-col items-center gap-2 border-t border-line p-6">
            <p className="text-sm text-ink-3">+ 1 synonym challenge · 1 sentence challenge · 1 mini story</p>
            <Button size="lg" variant="primary" onClick={() => setStarted(true)}>
              {done ? "Replay challenge" : "Start"} <ArrowRight />
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <RunSession
      title="Daily challenge"
      questions={plan.questions}
      rounds={plan.questions.length}
      exitHref="/"
      onFinish={(s) => completeDailyChallenge(plan.date, s.correct, s.total)}
      renderFinish={(summary, restart) => (
        <Results
          title="Daily challenge"
          summary={{ ...summary, xp: summary.xp + (rewardPending ? plan.reward : 0) }}
          onRestart={restart}
          exitHref="/"
          extra={
            <div className="mt-4">
              <MiniStory words={plan.storyWords} title="Your mini story" />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                <Sparkles className="size-3.5" />
                {aiStatus && !aiStatus.configured ? "The mini story needs an AI provider (see Settings)." : "Highlighted words open their cards."}
              </p>
            </div>
          }
        />
      )}
    />
  );
}

function WordColumn({ title, words }: { title: string; words: import("@/lib/types").Vocabulary[] }) {
  return (
    <div className="bg-surface p-5">
      <div className="eyebrow mb-3">{title}</div>
      {words.length ? (
        <ul className="space-y-2">
          {words.map((w) => (
            <li key={w.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <span className="headword text-xl text-ink">{w.word}</span>
                <span className="ml-2 truncate text-xs text-ink-3">{shortMeaning(w)}</span>
              </span>
              <CefrBadge level={w.cefr} source={w.cefrSource} size="sm" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">—</p>
      )}
    </div>
  );
}
