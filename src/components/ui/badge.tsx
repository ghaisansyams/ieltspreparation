import * as React from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  outline: "bg-transparent text-ink-2 border-line-strong",
  accent: "bg-accent-soft text-accent-ink border-transparent",
  good: "bg-good-soft text-good-ink border-transparent",
  warn: "bg-warn-soft text-warn-ink border-transparent",
  bad: "bg-bad-soft text-bad-ink border-transparent",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 text-[11px] font-medium leading-none [&_svg]:size-3",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
