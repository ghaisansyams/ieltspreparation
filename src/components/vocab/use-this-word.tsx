"use client";

import { useState } from "react";
import { Briefcase, Coffee, GraduationCap, Landmark, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { aiJson } from "@/lib/ai/client";
import { useAppStore } from "@/lib/store/app-store";
import type { UsageContext, UsageContexts, Vocabulary } from "@/lib/types";
import { meanings } from "@/lib/vocab/fields";
import { findWordInSentence } from "@/lib/vocab/word-forms";
import { AiMark, ListenButton } from "./bits";

const REGISTER: Record<UsageContext["register"], { label: string; icon: typeof Landmark }> = {
  formal: { label: "Formal", icon: Landmark },
  casual: { label: "Casual", icon: Coffee },
  academic: { label: "Academic", icon: GraduationCap },
  work: { label: "Work", icon: Briefcase },
  ielts: { label: "IELTS", icon: Trophy },
};

export function HighlightWord({ sentence, word }: { sentence: string; word: string }) {
  const m = findWordInSentence(sentence, word);
  if (!m) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, m.start)}
      <mark className="rounded-[3px] bg-accent-soft px-0.5 font-medium text-accent-ink">{m.text}</mark>
      {sentence.slice(m.end)}
    </>
  );
}

/** "Use This Word": the same word in formal, casual, academic, work and IELTS contexts. */
export function UseThisWord({ vocab }: { vocab: Vocabulary }) {
  const cacheContexts = useAppStore((s) => s.cacheContexts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = vocab.contexts;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await aiJson<Omit<UsageContexts, "generatedAt">>("/api/ai/contexts", {
        word: vocab.word,
        partOfSpeech: vocab.partOfSpeech,
        meanings: meanings(vocab),
      });
      cacheContexts(vocab.id, { ...res, generatedAt: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate contexts");
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="rounded-[10px] border border-dashed border-line-strong">
        <EmptyState
          icon={<Sparkles />}
          title={`When is “${vocab.word.toLowerCase()}” actually appropriate?`}
          description="Generate one example per register — formal, casual, academic, work and IELTS — with notes on where the word sounds natural or stiff."
          action={
            <div className="flex flex-col items-center gap-2">
              <Button variant="primary" size="sm" onClick={generate} disabled={busy}>
                {busy ? <Spinner className="text-bg" /> : <Sparkles />}
                Use this word
              </Button>
              {error ? <p className="max-w-sm text-xs text-bad-ink">{error}</p> : null}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <AiMark />
        <Button size="xs" variant="ghost" onClick={generate} disabled={busy}>
          {busy ? <Spinner /> : <RefreshCw />}
          Regenerate
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.contexts.map((c) => {
          const R = REGISTER[c.register];
          return (
            <div key={c.register} className="rounded-[10px] border border-line bg-surface p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="eyebrow flex items-center gap-1.5">
                  <R.icon className="size-3.5" />
                  {R.label}
                </span>
                <ListenButton text={c.sentence} compact />
              </div>
              <p className="text-[15px] leading-snug text-ink">
                <HighlightWord sentence={c.sentence} word={vocab.word} />
              </p>
              <p className="mt-1 text-[13px] text-ink-3">{c.translation}</p>
              <p className="mt-2 border-t border-line pt-2 text-xs text-ink-2">{c.note}</p>
            </div>
          );
        })}
        <div className="rounded-[10px] border border-line bg-surface-2/60 p-4 md:col-span-2">
          <div className="eyebrow mb-1.5">Where it fits</div>
          <p className="text-sm text-ink-2">{data.appropriateness}</p>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-bad-ink">{error}</p> : null}
    </div>
  );
}
