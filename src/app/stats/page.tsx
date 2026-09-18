"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, Calendar, Compass, Flame, Library, Lock, Sparkles, Target, Zap } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, Stat } from "@/components/ui/misc";
import { AccuracyLine, ActivityHeatmap, CefrDistribution, HBars } from "@/components/charts/charts";
import { CefrBadge } from "@/components/vocab/bits";
import { ACHIEVEMENTS, longestStreak } from "@/lib/learning/gamification";
import { useAppStore } from "@/lib/store/app-store";
import { useStats } from "@/lib/store/selectors";
import { shortMeaning } from "@/lib/vocab/fields";
import { addDays, cn, dayKey } from "@/lib/utils";

const ICONS: Record<string, typeof Award> = { sparkles: Sparkles, library: Library, flame: Flame, compass: Compass, target: Target, award: Award, zap: Zap, calendar: Calendar };

const QUIZ_LABEL: Record<string, string> = {
  review: "Spaced review",
  "flashcard-rush": "Flashcard Rush",
  "multiple-choice": "Multiple Choice",
  "synonym-match": "Synonym Match",
  "meaning-match": "Meaning Match",
  "sentence-completion": "Sentence Completion",
  "reverse-translation": "Reverse Translation",
  "cefr-challenge": "CEFR Challenge",
  "odd-one-out": "Odd One Out",
  "boss-battle": "Boss Battle",
  "daily-challenge": "Daily Challenge",
  ielts: "IELTS Mode",
};

function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.dataset.theme === "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export default function StatsPage() {
  const stats = useStats();
  const attempts = useAppStore((s) => s.attempts);
  const profile = useAppStore((s) => s.profile);
  const dark = useIsDark();

  const derived = useMemo(() => {
    const now = new Date();
    const byDay = new Map<string, { n: number; correct: number }>();
    const byType = new Map<string, { n: number; correct: number; time: number }>();
    for (const a of attempts) {
      const k = dayKey(new Date(a.createdAt));
      const d = byDay.get(k) ?? { n: 0, correct: 0 };
      d.n++;
      if (a.isCorrect) d.correct++;
      byDay.set(k, d);
      const t = byType.get(a.quizType) ?? { n: 0, correct: 0, time: 0 };
      t.n++;
      t.time += a.responseTime;
      if (a.isCorrect) t.correct++;
      byType.set(a.quizType, t);
    }
    const line = Array.from({ length: 30 }, (_, i) => {
      const date = addDays(now, i - 29);
      const k = dayKey(date);
      const d = byDay.get(k);
      return { key: k, label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), accuracy: d ? d.correct / d.n : null, total: d?.n ?? 0 };
    });
    // 12 full weeks ending this week, Monday-aligned.
    const end = addDays(now, 6 - ((now.getDay() + 6) % 7));
    const heat = Array.from({ length: 84 }, (_, i) => {
      const date = addDays(end, i - 83);
      const k = dayKey(date);
      return { key: k, date, value: date > now ? 0 : (byDay.get(k)?.n ?? 0) };
    });
    const total = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const avgTime = total ? attempts.reduce((s, a) => s + a.responseTime, 0) / total : 0;
    const types = [...byType.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({ label: QUIZ_LABEL[k] ?? k, value: v.n, sub: `${Math.round((v.correct / v.n) * 100)}%` }));
    return { line, heat, total, correct, avgTime, types };
  }, [attempts]);

  const stages = [
    { label: "Not started", value: stats.status.new },
    { label: "Learning", value: stats.status.learning },
    { label: "Reviewing", value: stats.status.review },
    { label: "Mastered", value: stats.status.mastered },
  ];

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Statistics" title="Your learning, measured" description="Accuracy, activity and retention across every review, game and writing task." />

      <Panel className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Level" value={stats.level} sub={stats.levelTitle} />
        <Stat label="Total XP" value={stats.xp.toLocaleString()} sub={`${stats.levelNext - stats.levelCurrent} XP to next level`} />
        <Stat label="Current streak" value={stats.streak} sub={`longest ${longestStreak(profile.activity)} days`} />
        <Stat label="Answers" value={derived.total.toLocaleString()} sub={`avg ${(derived.avgTime / 1000).toFixed(1)}s each`} />
        <Stat label="Overall accuracy" value={derived.total ? `${Math.round((derived.correct / derived.total) * 100)}%` : "—"} sub="all time" />
        <Stat label="Mastered" value={stats.mastered} sub={`of ${stats.total} words`} />
      </Panel>
      <div className="px-1">
        <ProgressBar value={stats.levelProgress} label="Level progress" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="p-5">
          <div className="mb-3">
            <div className="eyebrow">Last 30 days</div>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Answer accuracy per day</h2>
          </div>
          {derived.total ? <AccuracyLine points={derived.line} /> : <EmptyState icon={<Target />} title="No answers yet" description="Play a game or review to start tracking accuracy." />}
        </Panel>
        <Panel className="p-5">
          <div className="mb-3">
            <div className="eyebrow">12 weeks</div>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Activity</h2>
          </div>
          <ActivityHeatmap days={derived.heat} dark={dark} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5">
          <div className="mb-4">
            <div className="eyebrow">Practice mix</div>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Answers by activity</h2>
          </div>
          {derived.types.length ? <HBars rows={derived.types} /> : <p className="text-sm text-ink-3">Nothing yet.</p>}
        </Panel>
        <Panel className="p-5">
          <div className="mb-4">
            <div className="eyebrow">Retention</div>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Learning stage</h2>
          </div>
          <HBars rows={stages} />
        </Panel>
        <Panel className="p-5">
          <div className="mb-4">
            <div className="eyebrow">Estimated CEFR</div>
            <h2 className="mt-1 text-[15px] font-semibold text-ink">Level distribution</h2>
          </div>
          <CefrDistribution buckets={stats.cefr} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <PanelHeader eyebrow="Needs attention" title="Hardest words" />
          {stats.forgetting.length ? (
            <ul className="mt-3 divide-y divide-line">
              {stats.forgetting.map((f) => (
                <li key={f.vocab.id}>
                  <Link href={`/vocabulary/${f.vocab.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-ink">{f.vocab.word}</div>
                      <div className="truncate text-xs text-ink-3">{shortMeaning(f.vocab)}</div>
                    </div>
                    <CefrBadge level={f.vocab.cefr} source={f.vocab.cefrSource} size="sm" />
                    <span className="w-20 text-right font-mono text-xs text-ink">
                      {Math.round(f.accuracy * 100)}% <span className="text-ink-3">/{f.attempts}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<BookOpen />} title="No struggling words" description="Words you miss repeatedly will show up here." />
          )}
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="eyebrow">Achievements</div>
              <h2 className="mt-1 text-[15px] font-semibold text-ink">
                {Object.keys(profile.achievements).length} of {ACHIEVEMENTS.length} unlocked
              </h2>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a) => {
              const at = profile.achievements[a.id];
              const Icon = ICONS[a.icon] ?? Award;
              return (
                <div key={a.id} className={cn("flex items-center gap-3 rounded-[10px] border p-3", at ? "border-line-strong bg-surface" : "border-line bg-surface-2/40")}>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", at ? "bg-ink text-bg" : "bg-surface-3 text-ink-3")}>
                    {at ? <Icon className="size-4" /> : <Lock className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className={cn("truncate text-sm font-medium", at ? "text-ink" : "text-ink-2")}>{a.title}</div>
                    <div className="truncate text-xs text-ink-3">{at ? `Unlocked ${new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : a.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
