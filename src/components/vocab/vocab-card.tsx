"use client";

import { useMemo, useRef, useState } from "react";
import { BookmarkPlus, Check, CornerDownRight, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { LearningProgress, Vocabulary } from "@/lib/types";
import { examples, meanings, shortMeaning, synonymHeads, synonyms } from "@/lib/vocab/fields";
import { relationsFor } from "@/lib/vocab/relations";
import { cn } from "@/lib/utils";
import { AiMark, CefrBadge, ListenButton, MeaningText, NeedsReviewBadge, StatusBadge, SynonymChip } from "./bits";

/**
 * The premium word card. Front: headword, IPA, part of speech and (unless
 * hidden for recall practice) meaning + synonyms. Back: meanings, examples,
 * synonyms, related words and learning actions. Click or Space flips it.
 */
export function VocabCard({
  vocab,
  progress,
  hideAnswerOnFront = false,
  flipped: controlledFlipped,
  onFlip,
  showActions = true,
  className,
}: {
  vocab: Vocabulary;
  progress?: LearningProgress;
  hideAnswerOnFront?: boolean;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  showActions?: boolean;
  className?: string;
}) {
  const [innerFlipped, setInnerFlipped] = useState(false);
  const flipped = controlledFlipped ?? innerFlipped;
  const tiltRef = useRef<HTMLDivElement>(null);
  const all = useAppStore((s) => s.vocab);
  const openQuickView = useUiStore((s) => s.openQuickView);
  const markKnown = useAppStore((s) => s.markKnown);
  const markStillLearning = useAppStore((s) => s.markStillLearning);
  const addToReview = useAppStore((s) => s.addToReview);

  const related = useMemo(() => relationsFor(vocab, Object.values(all)).slice(0, 10), [vocab, all]);

  const toggle = () => {
    const next = !flipped;
    setInnerFlipped(next);
    onFlip?.(next);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || flipped || !tiltRef.current) return;
    const r = tiltRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    tiltRef.current.style.setProperty("--ry", `${x * 6}deg`);
    tiltRef.current.style.setProperty("--rx", `${-y * 6}deg`);
  };
  const resetTilt = () => {
    tiltRef.current?.style.setProperty("--ry", "0deg");
    tiltRef.current?.style.setProperty("--rx", "0deg");
  };

  const act = (fn: (id: string) => void, message: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn(vocab.id);
    toast.success(message, { description: vocab.word });
  };

  const face = "flip-face flex flex-col rounded-[14px] border border-line bg-surface shadow-card";

  return (
    <div ref={tiltRef} className={cn("tilt flip-scene", className)} onPointerMove={onPointerMove} onPointerLeave={resetTilt}>
      <div
        className="flip-inner cursor-pointer select-none outline-none"
        data-flipped={flipped}
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? `Hide details for ${vocab.word}` : `Reveal details for ${vocab.word}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        {/* FRONT */}
        <div className={cn(face, "hairline-grid min-h-[360px] overflow-hidden")} aria-hidden={flipped} inert={flipped}>
          <div className="flex items-center justify-between gap-2 border-b border-line bg-surface/90 px-5 py-3">
            <div className="flex items-center gap-2">
              <CefrBadge level={vocab.cefr} source={vocab.cefrSource} />
              {progress ? <StatusBadge status={progress.status} /> : null}
            </div>
            <div className="flex items-center gap-2">
              {vocab.needsReview ? <NeedsReviewBadge /> : null}
              {vocab.sourceNumber ? <span className="font-mono text-[11px] text-ink-3">#{String(vocab.sourceNumber).padStart(3, "0")}</span> : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center bg-surface/80 px-6 py-8 text-center">
            <div className="eyebrow mb-4">{vocab.partOfSpeech || "—"}</div>
            <h3 className="headword break-words text-[clamp(2.6rem,7vw,3.6rem)] text-ink">{vocab.word}</h3>
            {vocab.pronunciation ? <div className="ipa mt-3 text-sm">{vocab.pronunciation}</div> : null}

            {hideAnswerOnFront ? (
              <p className="mt-8 text-sm text-ink-3">Recall the meaning, then flip.</p>
            ) : (
              <>
                <p className="mt-7 max-w-md text-[17px] leading-snug text-ink">{shortMeaning(vocab, 3) || <span className="text-ink-3">No meaning yet</span>}</p>
                {synonyms(vocab).length ? (
                  <div className="mt-5">
                    <div className="eyebrow mb-1.5">Synonyms</div>
                    <p className="text-sm text-ink-2">{synonymHeads(vocab).join(" · ")}</p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line bg-surface/90 px-5 py-3">
            <ListenButton text={vocab.word} />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
              <RotateCcw className="size-3.5" />
              {hideAnswerOnFront ? "Reveal meaning" : "Flip for examples"}
            </span>
          </div>
        </div>

        {/* BACK */}
        <div className={cn(face, "flip-back max-h-[540px] min-h-[360px] overflow-hidden")} aria-hidden={!flipped} inert={!flipped}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="headword truncate text-2xl">{vocab.word}</span>
              <span className="ipa truncate text-xs">{vocab.pronunciation}</span>
            </div>
            <ListenButton text={vocab.word} compact />
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 text-left">
            <section>
              <div className="eyebrow mb-2">Meaning</div>
              {meanings(vocab).length ? (
                <ol className="space-y-1">
                  {meanings(vocab).map((m, i) => (
                    <li key={i} className="flex gap-2.5 text-[15px] text-ink">
                      <span className="mt-0.5 font-mono text-[11px] text-ink-3">{i + 1}</span>
                      <MeaningText value={m} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-ink-3">No meaning recorded.</p>
              )}
              {vocab.definition ? (
                <p className="mt-2 flex items-start gap-2 text-[13px] italic text-ink-2">
                  {vocab.definition}
                  {vocab.aiFields.includes("definition") ? <AiMark label="AI" className="not-italic" /> : null}
                </p>
              ) : null}
            </section>

            {examples(vocab).length ? (
              <section>
                <div className="eyebrow mb-2">Examples</div>
                <ol className="space-y-3">
                  {examples(vocab).map((ex) => (
                    <li key={ex.index} className="flex gap-2.5">
                      <span className="mt-0.5 font-mono text-[11px] text-ink-3">{ex.index}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] leading-snug text-ink">{ex.en}</p>
                        {ex.id ? <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{ex.id}</p> : null}
                      </div>
                      <ListenButton text={ex.en} compact />
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {synonyms(vocab).length ? (
              <section>
                <div className="eyebrow mb-2">Synonyms</div>
                <div className="flex flex-wrap gap-1.5">
                  {synonyms(vocab).map((s) => (
                    <SynonymChip key={s} value={s} />
                  ))}
                </div>
              </section>
            ) : null}

            {related.length ? (
              <section>
                <div className="eyebrow mb-2 flex items-center gap-2">
                  Related words {vocab.aiFields.includes("wordFamily") ? <AiMark label="AI" /> : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {related.map((r) => (
                    <button
                      key={`${r.kind}-${r.label}`}
                      type="button"
                      disabled={!r.vocabId}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (r.vocabId) openQuickView(r.vocabId);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[13px]",
                        r.vocabId ? "border-accent/35 bg-accent-soft text-accent-ink hover:border-accent" : "border-line text-ink-2",
                      )}
                      title={r.vocabId ? "In your library — open" : r.kind}
                    >
                      {r.vocabId ? <CornerDownRight className="size-3" /> : null}
                      {r.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {showActions ? (
            <div className="grid grid-cols-3 gap-2 border-t border-line p-3">
              <Button size="sm" variant="secondary" onClick={act(addToReview, "Added to today's review")}>
                <BookmarkPlus />
                <span className="hidden sm:inline">Add to</span> Review
              </Button>
              <Button size="sm" variant="secondary" onClick={act(markKnown, "Marked as known")}>
                <Check />
                Known
              </Button>
              <Button size="sm" variant="secondary" onClick={act(markStillLearning, "Back in your learning queue")}>
                <RefreshCw />
                <span className="hidden sm:inline">Still</span> Learning
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
