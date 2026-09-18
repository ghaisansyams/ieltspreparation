"use client";

import * as React from "react";
import { AlertTriangle, BadgeCheck, FileText, Sparkles, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CEFR_META, CEFR_SOURCE_LABEL } from "@/lib/cefr";
import type { CefrLevel, CefrSource, LearningStatus } from "@/lib/types";
import { splitMeaning, synonymGloss, synonymHead, synonymLevel } from "@/lib/vocab/fields";
import { useSpeech } from "@/hooks/use-speech";
import { cn } from "@/lib/utils";

export const cefrVar = (level: string) => `var(--cefr-${level.toLowerCase()})`;

export function CefrBadge({
  level,
  source,
  className,
  size = "md",
}: {
  level: CefrLevel | null;
  source?: CefrSource;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!level) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-3", className)} title="No CEFR level yet">
        <span className="size-2 rounded-[2px] border border-line-strong" />
        —
      </span>
    );
  }
  const estimated = source === "estimated";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-mono font-medium text-ink", size === "sm" ? "text-[11px]" : "text-xs", className)}
      title={`${level} · ${CEFR_META[level].name}${source ? ` · ${CEFR_SOURCE_LABEL[source]}` : ""}`}
    >
      <span className={cn("rounded-[2px]", size === "sm" ? "size-2" : "size-2.5")} style={{ background: cefrVar(level) }} />
      {level}
      {estimated ? <span className="font-sans text-[10px] font-normal text-ink-3">est.</span> : null}
    </span>
  );
}

const STATUS: Record<LearningStatus, { label: string; tone: "neutral" | "warn" | "accent" | "good" }> = {
  new: { label: "New", tone: "neutral" },
  learning: { label: "Learning", tone: "warn" },
  review: { label: "Reviewing", tone: "accent" },
  mastered: { label: "Mastered", tone: "good" },
};

export function StatusBadge({ status, className }: { status: LearningStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} className={className}>
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </Badge>
  );
}

export function AiMark({ label = "AI generated", className, verified }: { label?: string; className?: string; verified?: boolean }) {
  if (verified) {
    return (
      <Badge tone="good" className={className} title="Verified by you">
        <BadgeCheck />
        Verified
      </Badge>
    );
  }
  return (
    <Badge tone="accent" className={className} title="Produced by AI — check before relying on it">
      <Sparkles />
      {label}
    </Badge>
  );
}

export function SourceMark({ className, label = "Source" }: { className?: string; label?: string }) {
  return (
    <Badge tone="outline" className={className} title="From your own notes">
      <FileText />
      {label}
    </Badge>
  );
}

export function NeedsReviewBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warn" className={className}>
      <AlertTriangle />
      Needs review
    </Badge>
  );
}

export function ListenButton({ text, className, label = "Listen", compact }: { text: string; className?: string; label?: string; compact?: boolean }) {
  const { speak, speaking, supported } = useSpeech();
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-ink-2 transition-colors hover:text-ink",
        compact ? "size-7 justify-center hover:bg-surface-2" : "h-7 border border-line-strong px-2 hover:bg-surface-2",
        speaking && "text-accent-ink",
        className,
      )}
      aria-label={`${label}: ${text}`}
    >
      <Volume2 className={cn("size-3.5", speaking && "animate-pulse")} />
      {compact ? null : label}
    </button>
  );
}

/** "Diwajibkan (Verb)" → Diwajibkan + a quiet "verb" tag. */
export function MeaningText({ value, className }: { value: string; className?: string }) {
  const { text, pos } = splitMeaning(value);
  return (
    <span className={className}>
      {text}
      {pos ? <span className="ml-1.5 align-middle font-mono text-[10px] uppercase tracking-wider text-ink-3">{pos}</span> : null}
    </span>
  );
}

/** "Different (Berbeda)" / "Mainly (B1)" → head, gloss and level rendered separately. */
export function SynonymChip({ value, onClick, linked }: { value: string; onClick?: () => void; linked?: boolean }) {
  const head = synonymHead(value);
  const gloss = synonymGloss(value);
  const level = synonymLevel(value);
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md border border-line bg-surface-2/60 px-2 py-1 text-[13px] text-ink",
        onClick && "transition-colors hover:border-line-strong hover:bg-surface-2",
        linked && "border-accent/40",
      )}
    >
      <span className="font-medium">{head}</span>
      {gloss ? <span className="text-xs text-ink-3">{gloss}</span> : null}
      {level ? <CefrBadge level={level as CefrLevel} size="sm" /> : null}
    </Comp>
  );
}
