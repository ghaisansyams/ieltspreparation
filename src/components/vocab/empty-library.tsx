"use client";

import Link from "next/link";
import { ArrowRight, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SOURCE_ROWS } from "@/data/source";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

/**
 * Shown wherever a feature needs vocabulary but this browser's library is
 * (nearly) empty. The library lives in the browser, so a new device, another
 * browser or a private window starts empty — say so, and offer the fix.
 */
export function EmptyLibrary({ feature, needed = 1, className }: { feature: string; needed?: number; className?: string }) {
  const count = useAppStore((s) => Object.keys(s.vocab).length);
  const empty = count === 0;
  return (
    <Panel className={cn("overflow-hidden", className)} role="status">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
            <Library className="size-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              {empty ? `${feature} need your vocabulary first` : `${feature} need at least ${needed} words`}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-2">
              {empty
                ? `This browser's library is empty. Your words are saved per browser, so a new device, another browser or a private window starts empty. Import your ${SOURCE_ROWS.length} words in one click and everything unlocks.`
                : `There ${count === 1 ? "is" : "are"} only ${count} word${count === 1 ? "" : "s"} in this browser's library. Import your ${SOURCE_ROWS.length} words to unlock everything.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
          <Button asChild variant="primary">
            <Link href="/import?source=pdf">
              Import {SOURCE_ROWS.length} words <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/add">
              <Plus /> Add a word instead
            </Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}
