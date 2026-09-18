"use client";

import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { VocabCard } from "./vocab-card";

/** App-wide popup card: opened from chat highlights, graph nodes, search and games. */
export function WordQuickView() {
  const id = useUiStore((s) => s.quickViewId);
  const close = useUiStore((s) => s.closeQuickView);
  const vocab = useAppStore((s) => (id ? s.vocab[id] : undefined));
  const progress = useAppStore((s) => (id ? s.progress[id] : undefined));

  return (
    <Dialog open={!!vocab} onOpenChange={(o) => !o && close()}>
      {vocab ? (
        <DialogContent title={vocab.word} hideTitle hideClose className="max-w-md border-0 bg-transparent p-0 shadow-none">
          <VocabCard key={vocab.id} vocab={vocab} progress={progress} />
          <div className="mt-3 flex justify-center gap-2">
            <Button asChild size="sm" variant="secondary" onClick={close}>
              <Link href={`/vocabulary/${vocab.id}`}>
                Open full page
                <ArrowUpRight />
              </Link>
            </Button>
            <DialogClose asChild>
              <Button size="sm" variant="secondary">
                <X /> Close
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
