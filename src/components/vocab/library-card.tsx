"use client";

import Link from "next/link";
import { Repeat } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import type { LearningProgress, Vocabulary } from "@/lib/types";
import { shortMeaning } from "@/lib/vocab/fields";
import { accuracy, isDue } from "@/lib/learning/srs";
import { cn, endOfDay, relativeDays } from "@/lib/utils";
import { CefrBadge, NeedsReviewBadge, StatusBadge } from "./bits";

function reviewLabel(p?: LearningProgress): string {
  if (!p || !p.nextReviewAt) return "Not scheduled";
  if (isDue(p, new Date(), endOfDay())) return "Due today";
  return `Next ${relativeDays(p.nextReviewAt)}`;
}

export function LibraryCard({ vocab, progress, className }: { vocab: Vocabulary; progress?: LearningProgress; className?: string }) {
  const addToReview = useAppStore((s) => s.addToReview);
  const mastery = progress?.mastery ?? 0;
  const due = isDue(progress, new Date(), endOfDay());
  return (
    <div className={cn("group relative flex flex-col rounded-[10px] border border-line bg-surface p-4 transition-[border,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card", className)}>
      <Link href={`/vocabulary/${vocab.id}`} className="absolute inset-0 rounded-[10px]" aria-label={`Open ${vocab.word}`} />
      <div className="flex items-center justify-between gap-2">
        <CefrBadge level={vocab.cefr} source={vocab.cefrSource} size="sm" />
        <div className="flex items-center gap-1.5">
          {vocab.needsReview ? <NeedsReviewBadge /> : null}
          <StatusBadge status={progress?.status ?? "new"} />
        </div>
      </div>
      <div className="mt-3 min-w-0">
        <h3 className="headword truncate text-[28px] text-ink">{vocab.word}</h3>
        <div className="mt-1 truncate font-mono text-[10.5px] uppercase tracking-wider text-ink-3">{vocab.partOfSpeech || "—"}</div>
      </div>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-ink-2">{shortMeaning(vocab) || "—"}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-ink-3">Mastery</span>
            <span className="font-mono font-medium tabular-nums text-ink">{mastery}%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${mastery}%` }} />
          </div>
          <div className={cn("mt-1.5 text-[11px]", due ? "font-medium text-accent-ink" : "text-ink-3")}>{reviewLabel(progress)}</div>
        </div>
        <button
          type="button"
          onClick={() => addToReview(vocab.id)}
          className="relative z-10 inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2 text-xs font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          title="Add to today's review"
        >
          <Repeat className="size-3" />
          Review
        </button>
      </div>
    </div>
  );
}

export function LibraryRow({ vocab, progress }: { vocab: Vocabulary; progress?: LearningProgress }) {
  const acc = progress ? accuracy(progress) : null;
  return (
    <Link
      href={`/vocabulary/${vocab.id}`}
      className="grid grid-cols-[minmax(0,1.2fr)_auto] items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/60 md:grid-cols-[48px_minmax(0,1fr)_minmax(0,1.4fr)_80px_110px_70px_90px]"
    >
      <span className="hidden font-mono text-[11px] text-ink-3 md:block">{vocab.sourceNumber ? `#${vocab.sourceNumber}` : "—"}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{vocab.word}</span>
          {vocab.needsReview ? <span className="size-1.5 shrink-0 rounded-full bg-warn" title="Needs review" /> : null}
        </div>
        <div className="truncate text-xs text-ink-3">{vocab.partOfSpeech}</div>
        <div className="mt-0.5 truncate text-xs text-ink-2 md:hidden">{shortMeaning(vocab)}</div>
      </div>
      <span className="hidden truncate text-sm text-ink-2 md:block">{shortMeaning(vocab) || "—"}</span>
      <span className="hidden md:block">
        <CefrBadge level={vocab.cefr} source={vocab.cefrSource} size="sm" />
      </span>
      <span className="justify-self-end md:justify-self-start">
        <StatusBadge status={progress?.status ?? "new"} />
      </span>
      <span className="hidden text-right font-mono text-xs tabular-nums text-ink-2 md:block">{acc === null ? "—" : `${Math.round(acc * 100)}%`}</span>
      <span className="hidden text-right font-mono text-xs tabular-nums text-ink md:block">{progress?.mastery ?? 0}%</span>
    </Link>
  );
}
