"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { aiJson } from "@/lib/ai/client";
import { CEFR_META, CEFR_SOURCE_LABEL } from "@/lib/cefr";
import { CEFR_LEVELS, type CefrLevel, type CefrSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { cefrVar } from "./bits";

export function CefrSelector({
  value,
  source,
  onChange,
  onAutoDetect,
  detectInput,
  compact,
}: {
  value: CefrLevel | null;
  source: CefrSource;
  onChange: (level: CefrLevel) => void;
  /** Receives an estimate (stored as "estimated"). */
  onAutoDetect?: (level: CefrLevel) => void;
  detectInput?: { word: string; partOfSpeech?: string; meaning?: string };
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const detect = async () => {
    if (!detectInput?.word || !onAutoDetect) return;
    setBusy(true);
    try {
      const res = await aiJson<{ source: string; items: { cefr: CefrLevel; confidence: string }[] }>("/api/ai/cefr", { words: [detectInput] });
      const item = res.items[0];
      if (item) {
        onAutoDetect(item.cefr);
        toast(`Estimated ${item.cefr}`, {
          description: res.source === "heuristic" ? "Offline heuristic — add an AI key for better estimates." : `Confidence: ${item.confidence}`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not detect level");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="CEFR level">
          {CEFR_LEVELS.map((level) => {
            const active = value === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                title={`${level} · ${CEFR_META[level].name}`}
                onClick={() => onChange(level)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[5px] font-mono text-xs font-medium text-ink-3 transition-colors hover:text-ink",
                  compact ? "h-7 px-2" : "h-8 px-2.5",
                  active && "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
                )}
              >
                <span className="size-2 rounded-[2px]" style={{ background: active ? cefrVar(level) : "var(--line-strong)" }} />
                {level}
              </button>
            );
          })}
        </div>
        {onAutoDetect && detectInput ? (
          <Button type="button" size="sm" variant="ghost" onClick={detect} disabled={busy || !detectInput.word}>
            {busy ? <Spinner /> : <Wand2 />}
            Auto-detect CEFR
          </Button>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-ink-3">
        {value ? (
          <>
            <span className={cn("font-medium", source === "estimated" ? "text-warn-ink" : "text-ink-2")}>{source === "estimated" ? "Estimated CEFR" : CEFR_SOURCE_LABEL[source]}</span>
            {" · "}
            {CEFR_META[value].name}
            {source === "estimated" ? " — pick a level to confirm it." : ""}
          </>
        ) : (
          "No level yet."
        )}
      </p>
    </div>
  );
}
