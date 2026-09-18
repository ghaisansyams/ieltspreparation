"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, BookOpen, PencilLine, Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { VocabForm } from "@/components/vocab/vocab-form";
import { useAiStatus } from "@/hooks/use-ai-status";
import { aiJson, AiRequestError } from "@/lib/ai/client";
import { findByWord, useAppStore } from "@/lib/store/app-store";
import type { VocabDraft } from "@/lib/types";
import { autoReviewNotes, emptyDraft, hasIncomplete } from "@/lib/vocab/fields";

export default function AddPage() {
  return (
    <Suspense>
      <AddVocabulary />
    </Suspense>
  );
}

function AddVocabulary() {
  const params = useSearchParams();
  const router = useRouter();
  const vocab = useAppStore((s) => s.vocab);
  const addVocabulary = useAppStore((s) => s.addVocabulary);
  const status = useAiStatus();
  const [word, setWord] = useState(params.get("word") ?? "");
  const [draft, setDraft] = useState<VocabDraft | null>(null);
  const [source, setSource] = useState<"ai" | "dictionary" | "manual" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const existing = findByWord(vocab, draft?.word || word);

  const generate = async () => {
    if (!word.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await aiJson<{ source: "ai" | "dictionary"; draft: VocabDraft }>("/api/ai/generate", { word: word.trim() });
      setDraft(res.draft);
      setSource(res.source);
    } catch (e) {
      setError(e instanceof AiRequestError ? e.message : "Could not generate this word.");
    } finally {
      setBusy(false);
    }
  };

  const manual = () => {
    setDraft({ ...emptyDraft(word.trim()), origin: "manual" });
    setSource("manual");
    setError(null);
  };

  const save = () => {
    if (!draft || !draft.word.trim()) {
      toast.error("Add the word first");
      return;
    }
    const notes = [...draft.reviewNotes.filter((n) => n.kind === "suggestion" || !/^Missing /.test(n.text)), ...autoReviewNotes(draft).filter((n) => n.kind === "incomplete")];
    const v = addVocabulary({ ...draft, word: draft.word.trim(), reviewNotes: notes, needsReview: hasIncomplete(notes) });
    toast.success(`Saved “${v.word}”`, { description: "Added to your review queue." });
    router.push(`/vocabulary/${v.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Smart input" title="Add a new vocabulary" description="Type a word. AI drafts the full entry — pronunciation, meanings, synonyms, examples with translations, CEFR and more. Nothing is saved until you check it." />

      <Panel className="p-4 sm:p-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <Input
            ref={inputRef}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="sophisticated"
            className="h-12 flex-1 text-lg headword"
            style={{ fontFamily: "var(--font-serif)" }}
            aria-label="Word to add"
            maxLength={60}
          />
          <Button type="submit" size="lg" variant="primary" disabled={busy || !word.trim()}>
            {busy ? <Spinner className="text-bg" /> : <Wand2 />}
            Generate Vocabulary
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            {status === null
              ? "Checking AI…"
              : status.configured
                ? `AI: ${status.provider} · ${status.model}`
                : "No AI key configured — a public dictionary is used instead (English only, marked Needs Review)."}
          </span>
          <button type="button" onClick={manual} className="inline-flex items-center gap-1 font-medium text-ink-2 hover:text-ink">
            <PencilLine className="size-3.5" /> Fill in manually
          </button>
        </div>
        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {error}{" "}
              <button type="button" className="font-medium underline" onClick={manual}>
                Fill in manually
              </button>
            </span>
          </div>
        ) : null}
      </Panel>

      {busy ? (
        <Panel className="mt-4 p-6">
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <Spinner /> Drafting “{word}”…
          </div>
          <div className="mt-4 space-y-3">
            {[70, 45, 90, 60].map((w, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-surface-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        </Panel>
      ) : null}

      {draft && !busy ? (
        <div className="mt-4 animate-rise">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {source === "ai" ? <Badge tone="accent"><Sparkles /> AI draft — review before saving</Badge> : null}
                {source === "dictionary" ? <Badge tone="warn"><BookOpen /> Dictionary draft — add Indonesian</Badge> : null}
                {source === "manual" ? <Badge tone="neutral"><PencilLine /> Manual entry</Badge> : null}
              </div>
              {existing ? (
                <Link href={`/vocabulary/${existing.id}`} className="inline-flex items-center gap-1.5 text-sm text-warn-ink">
                  <AlertTriangle className="size-4" /> “{existing.word}” is already in your library <ArrowRight className="size-3.5" />
                </Link>
              ) : null}
            </div>
            <VocabForm value={draft} onChange={setDraft} />
          </Panel>
          <div className="sticky bottom-4 z-10 mt-4 flex items-center justify-end gap-2 rounded-lg border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
            <Button variant="ghost" onClick={() => { setDraft(null); setSource(null); }}>
              Discard
            </Button>
            <Button variant="primary" onClick={save}>
              <Save /> Save Vocabulary
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
