"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRight,
  Check,
  Circle,
  Clock,
  FileText,
  Flame,
  Plus,
  Sparkles,
  Swords,
  Target,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState, Stat } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { CefrDistribution, WeeklyColumns } from "@/components/charts/charts";
import { LibraryCard } from "@/components/vocab/library-card";
import { SOURCE_DOCUMENT, SOURCE_ROWS } from "@/data/source";
import { dailyPlan } from "@/lib/games/daily";
import { useAppStore } from "@/lib/store/app-store";
import { useStats } from "@/lib/store/selectors";
import { shortMeaning } from "@/lib/vocab/fields";
import { cn, dayKey, formatCompact, greeting, pct } from "@/lib/utils";

const greetingFor = (name: string) => (name ? greeting().replace(/\.$/, `, ${name}.`) : greeting());

export default function DashboardPage() {
  const stats = useStats();
  const vocab = useAppStore((s) => s.vocab);
  const progress = useAppStore((s) => s.progress);
  const attempts = useAppStore((s) => s.attempts);
  const name = useAppStore((s) => s.profile.displayName);
  const router = useRouter();

  const recent = useMemo(
    () => Object.values(vocab).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || (b.sourceNumber ?? 0) - (a.sourceNumber ?? 0)).slice(0, 4),
    [vocab],
  );
  const plan = useMemo(() => (stats.total ? dailyPlan(vocab, progress) : null), [vocab, progress, stats.total]);

  // New words started today = words whose every review happened today.
  const newStartedToday = useMemo(() => {
    const today = dayKey();
    const counts = new Map<string, number>();
    for (const a of attempts) {
      if (a.quizType === "review" && dayKey(new Date(a.createdAt)) === today) counts.set(a.vocabularyId, (counts.get(a.vocabularyId) ?? 0) + 1);
    }
    let n = 0;
    counts.forEach((c, id) => {
      if (progress[id] && progress[id].reviewCount === c) n++;
    });
    return n;
  }, [attempts, progress]);

  if (!stats.total) return <Onboarding name={name} />;

  // Today's workload = what is still due + what was already reviewed today.
  const reviewTarget = Math.min(stats.dailyGoal, 10, stats.due + stats.reviewsToday);
  const newTarget = Math.min(5, stats.newInQueue + newStartedToday);
  const missions = [
    reviewTarget > 0
      ? { label: `${reviewTarget} words to review`, done: stats.reviewsToday >= reviewTarget, progress: `${Math.min(stats.reviewsToday, reviewTarget)}/${reviewTarget}`, href: "/review" }
      : { label: "No reviews due", done: true, progress: "clear", href: "/review" },
    ...(newTarget > 0 ? [{ label: `${newTarget} new words`, done: newStartedToday >= newTarget, progress: `${Math.min(newStartedToday, newTarget)}/${newTarget}`, href: "/review" }] : []),
    { label: "1 vocabulary challenge", done: stats.dailyDone, progress: stats.dailyDone ? "done" : "0/1", href: "/challenge" },
    { label: "1 sentence challenge", done: stats.sentencesToday > 0, progress: stats.sentencesToday > 0 ? "done" : "0/1", href: "/ielts" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting + today's review */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel className="dot-grid relative overflow-hidden p-6 sm:p-8 animate-rise">
          <div className="relative">
            <p className="text-sm text-ink-3">{greetingFor(name)}</p>
            <h1 className="headword mt-2 text-[clamp(2rem,4.5vw,3.1rem)] text-ink">Ready to remember what you&rsquo;ve learned?</h1>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <div className="eyebrow">Today&rsquo;s review</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[56px] font-semibold leading-none tracking-tight text-ink">{stats.queue.length}</span>
                  <span className="text-lg text-ink-2">words</span>
                </div>
                <div className="mt-2 text-sm text-ink-3">
                  {stats.due} due · {stats.newInQueue} new · {stats.reviewsToday} reviewed today
                </div>
              </div>
              <Button size="lg" variant="primary" onClick={() => router.push("/review")} disabled={!stats.queue.length}>
                {stats.queue.length ? "Continue Learning" : "All caught up"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="flex flex-col p-5 animate-rise [animation-delay:60ms]">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">Today&rsquo;s mission</div>
              <h2 className="mt-1 text-[15px] font-semibold text-ink">
                {missions.filter((m) => m.done).length} of {missions.length} complete
              </h2>
            </div>
            <span className="font-mono text-xs text-ink-3">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          </div>
          <ul className="mt-4 flex-1 space-y-1">
            {missions.map((m) => (
              <li key={m.label}>
                <Link href={m.href} className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2">
                  <span className={cn("grid size-5 place-items-center rounded-full border", m.done ? "border-good bg-good text-white" : "border-line-strong text-transparent")}>
                    {m.done ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-2" />}
                  </span>
                  <span className={cn("flex-1 text-sm", m.done ? "text-ink-3 line-through" : "text-ink")}>{m.label}</span>
                  <span className="font-mono text-[11px] text-ink-3">{m.progress}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      {/* Overview */}
      <Panel className="grid grid-cols-2 gap-x-4 gap-y-5 p-5 sm:grid-cols-4 xl:grid-cols-7 animate-rise [animation-delay:100ms]">
        <Stat label="Total words" value={formatCompact(stats.total)} sub={stats.needsReview ? `${stats.needsReview} need review` : "all complete"} />
        <Stat label="Mastered" value={stats.mastered} sub={`${pct(stats.mastered, stats.total)}% of library`} />
        <Stat label="Learning" value={stats.learning} sub="in rotation" />
        <Stat label="Due for review" value={stats.due} sub="by end of today" />
        <Stat label="Newly added" value={stats.newlyAdded} sub="last 7 days" />
        <Stat label="Quiz accuracy" value={stats.accuracy === null ? "—" : `${Math.round(stats.accuracy * 100)}%`} sub="last 30 days" />
        <Stat label="Streak" value={<span className="flex items-center gap-1.5">{stats.streak}<Flame className={cn("size-5", stats.streak ? "text-series-2" : "text-ink-3")} /></span>} sub={stats.streak === 1 ? "day" : "days"} />
      </Panel>

      {/* Struggles + daily challenge */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader eyebrow="Personalised" title="Words you keep forgetting" action={stats.forgetting.length ? <Button asChild size="xs" variant="ghost"><Link href="/review?focus=struggling">Drill these <ArrowRight /></Link></Button> : null} />
          {stats.forgetting.length ? (
            <ul className="mt-3 divide-y divide-line">
              {stats.forgetting.map((f) => (
                <li key={f.vocab.id}>
                  <Link href={`/vocabulary/${f.vocab.id}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{f.vocab.word}</div>
                      <div className="truncate text-xs text-ink-3">{shortMeaning(f.vocab)}</div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="font-mono text-sm font-medium tabular-nums text-ink">{Math.round(f.accuracy * 100)}%</div>
                      <div className="text-[11px] text-ink-3">{f.attempts} attempts</div>
                    </div>
                    <Badge tone={f.priority === "high" ? "bad" : f.priority === "medium" ? "warn" : "neutral"} className="w-16 justify-center uppercase tracking-wide">
                      {f.priority}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Target />}
              title="Nothing slipping yet"
              description="As you review and play, words you miss more than once will collect here so you can drill them."
            />
          )}
        </Panel>

        <Panel className="relative overflow-hidden">
          <div className="hairline-grid absolute inset-0 opacity-60" aria-hidden />
          <div className="relative flex h-full flex-col p-5">
            <div className="flex items-center justify-between">
              <div className="eyebrow">Daily challenge</div>
              {stats.dailyDone ? <Badge tone="good"><Check /> Completed</Badge> : <Badge tone="accent">+100 XP</Badge>}
            </div>
            <h2 className="headword mt-3 text-[34px] text-ink">Today&rsquo;s challenge</h2>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: Sparkles, value: plan ? plan.reviewWords.length + plan.newWords.length : 0, label: "words" },
                { icon: Swords, value: plan?.questions.length ?? 0, label: "questions" },
                { icon: Clock, value: plan?.estimatedMinutes ?? 3, label: "minutes" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
                  <Icon className="size-4 text-series-2" />
                  <div className="mt-1.5 text-xl font-semibold text-ink">{value}</div>
                  <div className="text-[11px] text-ink-3">{label}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 flex-1 text-sm text-ink-2">
              5 review words, 3 new words, a synonym challenge, a sentence challenge and a mini story.
            </p>
            <Button asChild className="mt-4" variant={stats.dailyDone ? "secondary" : "accent"}>
              <Link href="/challenge">
                {stats.dailyDone ? "Play again" : "Start challenge"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </Panel>
      </section>

      {/* Recent + CEFR */}
      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <div className="eyebrow">Library</div>
              <h2 className="mt-1 text-[15px] font-semibold text-ink">Recent vocabulary</h2>
            </div>
            <Button asChild size="xs" variant="ghost">
              <Link href="/vocabulary">
                View all <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((v) => (
              <LibraryCard key={v.id} vocab={v} progress={progress[v.id]} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="mb-4">
              <div className="eyebrow">Estimated CEFR</div>
              <h2 className="mt-1 text-[15px] font-semibold text-ink">CEFR progress</h2>
            </div>
            <CefrDistribution buckets={stats.cefr} onSelect={(level) => level !== "Unrated" && router.push(`/vocabulary?cefr=${level}`)} />
            <p className="mt-3 text-[11px] text-ink-3">Levels are estimates unless written in your notes or confirmed by you.</p>
          </Panel>
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="eyebrow">Weekly progress</div>
                <h2 className="mt-1 text-[15px] font-semibold text-ink">Reviews per day</h2>
              </div>
              <span className="font-mono text-xs text-ink-3">{stats.week.reduce((s, d) => s + d.reviews, 0)} this week</span>
            </div>
            <WeeklyColumns data={stats.week} />
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Onboarding({ name }: { name: string }) {
  const complete = SOURCE_ROWS.length;
  return (
    <div className="mx-auto max-w-3xl py-6 animate-rise">
      <p className="text-sm text-ink-3">{greetingFor(name)}</p>
      <h1 className="headword mt-2 text-[clamp(2.2rem,5vw,3.4rem)] text-ink">Ready to remember what you&rsquo;ve learned?</h1>
      <p className="mt-3 max-w-xl text-ink-2">Your library is empty. Start with the vocabulary you&rsquo;ve already written — every word keeps its pronunciation, meanings, synonyms and example sentences.</p>

      <Panel className="mt-8 overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-[1fr_auto]">
          <div className="p-6">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-ink-3" />
              <span className="font-mono text-xs text-ink-3">{SOURCE_DOCUMENT.fileName}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">{complete} vocabulary entries detected</h2>
            <p className="mt-1.5 text-sm text-ink-2">
              Parsed row by row from your PDF, with original numbering. Incomplete rows are flagged <em>Needs Review</em> — nothing is invented. CEFR levels are marked as estimates.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="primary">
                <Link href="/import?source=pdf">
                  Review &amp; import
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/import">
                  <Upload />
                  Import another file
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden border-l border-line bg-surface-2/50 p-6 sm:block">
            <div className="eyebrow mb-3">Preview</div>
            <div className="space-y-2.5">
              {SOURCE_ROWS.slice(0, 4).map((r) => (
                <div key={r.n} className="flex items-baseline gap-3">
                  <span className="w-6 font-mono text-[11px] text-ink-3">{r.n}</span>
                  <span className="headword text-xl text-ink">{r.word}</span>
                  <span className="text-xs text-ink-3">{r.m.slice(0, 2).join(" · ")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/add" className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
          <span className="grid size-9 place-items-center rounded-md bg-surface-2 text-ink-2">
            <Plus className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium text-ink">Add a single word</span>
            <span className="block text-xs text-ink-3">Type it, let AI draft the entry, edit and save.</span>
          </span>
        </Link>
        <Link href="/settings" className="flex items-center gap-3 rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-line-strong">
          <span className="grid size-9 place-items-center rounded-md bg-surface-2 text-ink-2">
            <Sparkles className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium text-ink">Set up AI &amp; sync</span>
            <span className="block text-xs text-ink-3">Check the AI provider and optional cloud sync.</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
