"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { LibraryCard, LibraryRow } from "@/components/vocab/library-card";
import { cefrVar } from "@/components/vocab/bits";
import { accuracy, isDue } from "@/lib/learning/srs";
import { useAppStore } from "@/lib/store/app-store";
import { CEFR_LEVELS, type CefrLevel, type LearningStatus } from "@/lib/types";
import { searchVocabulary } from "@/lib/vocab/search";
import { cn, DAY_MS, endOfDay } from "@/lib/utils";

type SortKey = "source" | "alpha" | "recent" | "mastery" | "accuracy" | "next";
type ReviewFilter = "any" | "due" | "scheduled" | "unscheduled";
type AccuracyFilter = "any" | "low" | "mid" | "high" | "none";
type AddedFilter = "any" | "7" | "30";

const STATUSES: { value: LearningStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "review", label: "Reviewing" },
  { value: "mastered", label: "Mastered" },
];

function posGroup(pos: string): string {
  const p = pos.toLowerCase();
  if (!p) return "unknown";
  return p.split(/[/ ]/)[0].replace(/^adj$/, "adjective").replace(/^adv$/, "adverb");
}

export default function VocabularyPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}

function Library() {
  const params = useSearchParams();
  const vocab = useAppStore((s) => s.vocab);
  const progress = useAppStore((s) => s.progress);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [cefr, setCefr] = useState<CefrLevel[]>(() => {
    const c = params.get("cefr")?.toUpperCase();
    return c && (CEFR_LEVELS as readonly string[]).includes(c) ? [c as CefrLevel] : [];
  });
  const [pos, setPos] = useState("any");
  const [status, setStatus] = useState<LearningStatus[]>([]);
  const [review, setReview] = useState<ReviewFilter>("any");
  const [difficulty, setDifficulty] = useState("any");
  const [added, setAdded] = useState<AddedFilter>("any");
  const [acc, setAcc] = useState<AccuracyFilter>("any");
  const [needsReview, setNeedsReview] = useState(params.get("needsReview") === "1");
  const [sort, setSort] = useState<SortKey>("source");
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(48);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lexis-library-view");
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {}
  }, []);
  const changeView = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("lexis-library-view", v);
    } catch {}
  };

  const list = useMemo(() => Object.values(vocab), [vocab]);
  const posOptions = useMemo(() => [...new Set(list.map((v) => posGroup(v.partOfSpeech)))].sort(), [list]);

  const filtered = useMemo(() => {
    const now = new Date();
    const eod = endOfDay(now);
    const base = query.trim() ? searchVocabulary(list, query, { statusOf: (id) => progress[id]?.status }).map((h) => h.vocab) : list;
    const out = base.filter((v) => {
      const p = progress[v.id];
      if (cefr.length && (!v.cefr || !cefr.includes(v.cefr))) return false;
      if (pos !== "any" && posGroup(v.partOfSpeech) !== pos) return false;
      if (status.length && !status.includes(p?.status ?? "new")) return false;
      if (review === "due" && !isDue(p, now, eod)) return false;
      if (review === "scheduled" && (!p?.nextReviewAt || isDue(p, now, eod))) return false;
      if (review === "unscheduled" && p?.nextReviewAt) return false;
      if (difficulty !== "any" && String(v.difficulty ?? "") !== difficulty) return false;
      if (added !== "any" && now.getTime() - new Date(v.createdAt).getTime() > Number(added) * DAY_MS) return false;
      const a = p ? accuracy(p) : null;
      if (acc === "none" && a !== null) return false;
      if (acc === "low" && (a === null || a >= 0.5)) return false;
      if (acc === "mid" && (a === null || a < 0.5 || a >= 0.8)) return false;
      if (acc === "high" && (a === null || a < 0.8)) return false;
      if (needsReview && !v.needsReview) return false;
      return true;
    });
    if (query.trim() && sort === "source") return out; // keep relevance order
    const byAcc = (id: string) => {
      const p = progress[id];
      const a = p ? accuracy(p) : null;
      return a === null ? 2 : a;
    };
    return [...out].sort((a, b) => {
      switch (sort) {
        case "alpha":
          return a.word.localeCompare(b.word);
        case "recent":
          return b.createdAt.localeCompare(a.createdAt);
        case "mastery":
          return (progress[a.id]?.mastery ?? 0) - (progress[b.id]?.mastery ?? 0);
        case "accuracy":
          return byAcc(a.id) - byAcc(b.id);
        case "next":
          return (progress[a.id]?.nextReviewAt ?? "9999").localeCompare(progress[b.id]?.nextReviewAt ?? "9999");
        default:
          return (a.sourceNumber ?? 1e9) - (b.sourceNumber ?? 1e9) || a.createdAt.localeCompare(b.createdAt);
      }
    });
  }, [list, progress, query, cefr, pos, status, review, difficulty, added, acc, needsReview, sort]);

  useEffect(() => setLimit(48), [filtered.length, view]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((l) => l + 48);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const activeCount =
    cefr.length + status.length + (pos !== "any" ? 1 : 0) + (review !== "any" ? 1 : 0) + (difficulty !== "any" ? 1 : 0) + (added !== "any" ? 1 : 0) + (acc !== "any" ? 1 : 0) + (needsReview ? 1 : 0);
  const clear = () => {
    setCefr([]);
    setStatus([]);
    setPos("any");
    setReview("any");
    setDifficulty("any");
    setAdded("any");
    setAcc("any");
    setNeedsReview(false);
  };
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="My Vocabulary"
        description={`${list.length} words — every entry keeps its pronunciation, meanings, synonyms and examples.`}
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/add">
              <Plus /> Add Vocabulary
            </Link>
          </Button>
        }
      />

      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search word, meaning, synonym, example, tag…" className="pl-9" aria-label="Search vocabulary" />
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="CEFR filter">
            {CEFR_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={cefr.includes(l)}
                onClick={() => setCefr(toggle(cefr, l))}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-md border px-2 font-mono text-xs font-medium transition-colors",
                  cefr.includes(l) ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:border-line-strong",
                )}
              >
                <span className="size-2 rounded-[2px]" style={{ background: cefrVar(l) }} />
                {l}
              </button>
            ))}
          </div>
          <Button variant={showFilters || activeCount ? "outline" : "secondary"} size="md" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <SlidersHorizontal />
            Filters
            {activeCount ? <span className="rounded bg-ink px-1 font-mono text-[10px] text-bg">{activeCount}</span> : null}
          </Button>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto" aria-label="Sort">
            <option value="source">Original order</option>
            <option value="alpha">A → Z</option>
            <option value="recent">Recently added</option>
            <option value="mastery">Lowest mastery</option>
            <option value="accuracy">Lowest accuracy</option>
            <option value="next">Next review</option>
          </Select>
          <Segmented
            value={view}
            onChange={changeView}
            options={[
              { value: "grid", label: <LayoutGrid />, title: "Cards" },
              { value: "list", label: <List />, title: "List" },
            ]}
          />
        </div>

        {showFilters ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade">
            <div>
              <div className="eyebrow mb-1.5">Mastery</div>
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={status.includes(s.value)}
                    onClick={() => setStatus(toggle(status, s.value))}
                    className={cn("h-7 rounded-md border px-2 text-xs", status.includes(s.value) ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-strong")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <div className="eyebrow mb-1.5">Part of speech</div>
              <Select value={pos} onChange={(e) => setPos(e.target.value)}>
                <option value="any">Any</option>
                {posOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <div className="eyebrow mb-1.5">Review status</div>
              <Select value={review} onChange={(e) => setReview(e.target.value as ReviewFilter)}>
                <option value="any">Any</option>
                <option value="due">Due today</option>
                <option value="scheduled">Scheduled later</option>
                <option value="unscheduled">Not started</option>
              </Select>
            </label>
            <label>
              <div className="eyebrow mb-1.5">Difficulty</div>
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="any">Any</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {"●".repeat(d)}
                    {"○".repeat(5 - d)} ({d})
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <div className="eyebrow mb-1.5">Date added</div>
              <Select value={added} onChange={(e) => setAdded(e.target.value as AddedFilter)}>
                <option value="any">Any time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </Select>
            </label>
            <label>
              <div className="eyebrow mb-1.5">Accuracy</div>
              <Select value={acc} onChange={(e) => setAcc(e.target.value as AccuracyFilter)}>
                <option value="any">Any</option>
                <option value="low">Below 50%</option>
                <option value="mid">50–79%</option>
                <option value="high">80% and above</option>
                <option value="none">No answers yet</option>
              </Select>
            </label>
            <label className="flex items-end gap-2 pb-1.5">
              <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              <span className="text-sm text-ink-2">Only entries that need review</span>
            </label>
            <div className="flex items-end justify-end">
              <Button size="sm" variant="ghost" onClick={clear} disabled={!activeCount}>
                <X /> Clear filters
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mb-3 text-xs text-ink-3">
        {filtered.length === list.length ? `${list.length} words` : `${filtered.length} of ${list.length} words`}
      </div>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Search />}
            title={list.length ? "No words match" : "Your library is empty"}
            description={list.length ? "Try a different search or clear some filters." : "Import your vocabulary or add your first word."}
            action={
              list.length ? (
                <Button size="sm" onClick={() => { clear(); setQuery(""); }}>Reset</Button>
              ) : (
                <Button asChild size="sm" variant="primary"><Link href="/import">Import vocabulary</Link></Button>
              )
            }
          />
        </Panel>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.slice(0, limit).map((v) => (
            <LibraryCard key={v.id} vocab={v} progress={progress[v.id]} />
          ))}
        </div>
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[48px_minmax(0,1fr)_minmax(0,1.4fr)_80px_110px_70px_90px] gap-3 border-b border-line bg-surface-2/60 px-4 py-2 md:grid">
            {["No.", "Word", "Meaning", "CEFR", "Status", "Accuracy", "Mastery"].map((h, i) => (
              <span key={h} className={cn("eyebrow", i >= 5 && "text-right")}>
                {h}
              </span>
            ))}
          </div>
          {filtered.slice(0, limit).map((v) => (
            <LibraryRow key={v.id} vocab={v} progress={progress[v.id]} />
          ))}
        </Panel>
      )}
      {filtered.length > limit ? <div ref={sentinel} className="h-10" /> : null}
    </div>
  );
}
