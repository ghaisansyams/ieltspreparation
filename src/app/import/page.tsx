"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Papa from "papaparse";
import { ArrowRight, CheckCircle2, ClipboardPaste, FileSpreadsheet, FileText, FileUp, Gamepad2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { PreviewTable, type ImportRow } from "@/components/import/preview-table";
import { SOURCE_DOCUMENT, SOURCE_ROWS } from "@/data/source";
import { aiForm, aiJson } from "@/lib/ai/client";
import { difficultyFromCefr, estimateCefrHeuristic } from "@/lib/cefr";
import { draftsFromRows, draftsFromWordList } from "@/lib/import/tabular";
import { useAppStore } from "@/lib/store/app-store";
import type { CefrLevel, VocabDraft } from "@/lib/types";
import { hasIncomplete, meanings, wordKey } from "@/lib/vocab/fields";
import { sourceDrafts } from "@/lib/vocab/source-import";
import { cn } from "@/lib/utils";

type Stage = { kind: "choose" } | { kind: "loading"; label: string } | { kind: "preview"; label: string; warnings: string[] } | { kind: "done"; imported: number; needsReview: number };

export default function ImportPage() {
  return (
    <Suspense>
      <Importer />
    </Suspense>
  );
}

function Importer() {
  const params = useSearchParams();
  const vocab = useAppStore((s) => s.vocab);
  const importDrafts = useAppStore((s) => s.importDrafts);
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [filling, setFilling] = useState<{ done: number; total: number } | null>(null);
  const [estimating, setEstimating] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const toRows = useCallback(
    (drafts: VocabDraft[]): ImportRow[] => {
      const existing = new Map(Object.values(vocab).map((v) => [wordKey(v.word), v.word]));
      const seen = new Map<string, string>();
      return drafts.map((draft, i) => {
        const key = wordKey(draft.word);
        const duplicateOf = existing.get(key) ?? seen.get(key) ?? null;
        if (!seen.has(key)) seen.set(key, draft.word);
        return { key: `${i}-${key}`, draft, selected: !duplicateOf, duplicateOf: duplicateOf ? `“${duplicateOf}”${existing.has(key) ? " in your library" : " earlier in this file"}` : null };
      });
    },
    [vocab],
  );

  const preview = useCallback(
    (drafts: VocabDraft[], label: string, warnings: string[] = []) => {
      if (!drafts.length) {
        toast.error("No vocabulary found", { description: "Check that the file has a header row with a Word/Vocab column, or one word per line." });
        setStage({ kind: "choose" });
        return;
      }
      const built = toRows(drafts);
      setRows(built);
      setStage({ kind: "preview", label, warnings });
      void estimateMissingCefr(built);
    },
    [toRows],
  );

  /** Every imported word gets an Estimated CEFR: AI when configured, an offline heuristic otherwise. */
  const estimateMissingCefr = async (built: ImportRow[]) => {
    const missing = built.filter((r) => !r.draft.cefr && r.draft.word);
    if (!missing.length) return;
    setEstimating(missing.length);
    const levels = new Map<string, CefrLevel>();
    for (let i = 0; i < missing.length; i += 100) {
      const chunk = missing.slice(i, i + 100);
      try {
        const res = await aiJson<{ items: { word: string; cefr: CefrLevel }[] }>("/api/ai/cefr", {
          words: chunk.map((r) => ({ word: r.draft.word, partOfSpeech: r.draft.partOfSpeech || undefined, meaning: r.draft.meaning1 || undefined })),
        });
        const byWord = new Map(res.items.map((it) => [it.word.toLowerCase(), it.cefr]));
        chunk.forEach((r) => levels.set(r.key, byWord.get(r.draft.word.toLowerCase()) ?? estimateCefrHeuristic(r.draft.word)));
      } catch {
        chunk.forEach((r) => levels.set(r.key, estimateCefrHeuristic(r.draft.word)));
      }
    }
    setRows((prev) =>
      prev.map((r) => {
        const level = levels.get(r.key);
        if (!level || r.draft.cefr) return r;
        return {
          ...r,
          draft: {
            ...r.draft,
            cefr: level,
            cefrSource: "estimated",
            difficulty: r.draft.difficulty ?? difficultyFromCefr(level),
            aiFields: [...new Set([...r.draft.aiFields, "cefr" as const, ...(r.draft.difficulty === null ? (["difficulty"] as const) : [])])],
          },
        };
      }),
    );
    setEstimating(0);
  };

  const loadSource = useCallback(() => preview(sourceDrafts(), `${SOURCE_DOCUMENT.fileName} · ${SOURCE_ROWS.length} entries detected`), [preview]);

  useEffect(() => {
    if (params.get("source") === "pdf") loadSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseText = (text: string, label: string) => {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    if (/\t|,/.test(firstLine)) {
      const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: "greedy" });
      const { drafts, headerFound } = draftsFromRows(parsed.data);
      if (headerFound) return preview(drafts, label);
    }
    preview(draftsFromWordList(text), label);
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".pdf")) {
        setStage({ kind: "loading", label: `Reading ${file.name}…` });
        const form = new FormData();
        form.append("file", file);
        const res = await aiForm<{ matchedSource: boolean; pages: number; drafts?: VocabDraft[]; warnings?: string[] }>("/api/import/pdf", form);
        if (res.matchedSource) {
          toast.success("Recognised your vocabulary PDF", { description: "Using the verified row-by-row transcription." });
          return loadSource();
        }
        return preview(res.drafts ?? [], `${file.name} · ${res.pages} pages · extracted with AI`, res.warnings ?? []);
      }
      if (name.endsWith(".xlsx")) {
        setStage({ kind: "loading", label: `Reading ${file.name}…` });
        const { readSheet } = await import("read-excel-file/universal");
        const data = await readSheet(file);
        const { drafts, headerFound } = draftsFromRows(data as unknown[][]);
        if (!headerFound) {
          toast.error("No header row found", { description: "The sheet needs a column named Vocab or Word." });
          return setStage({ kind: "choose" });
        }
        return preview(drafts, `${file.name} · spreadsheet`);
      }
      if (name.endsWith(".xls")) {
        toast.error("Old .xls files aren't supported", { description: "Save as .xlsx or CSV first." });
        return;
      }
      const text = await file.text();
      parseText(text, `${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
      setStage({ kind: "choose" });
    }
  };

  const fillWithAi = async () => {
    const targets = rows.filter((r) => r.selected && r.draft.needsReview && meanings(r.draft).length < 2 && !r.draft.pronunciation);
    if (!targets.length) return;
    setFilling({ done: 0, total: targets.length });
    let done = 0;
    let failed = 0;
    const queue = [...targets];
    const results = new Map<string, VocabDraft>();
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const r = queue.shift()!;
          try {
            const { draft } = await aiJson<{ draft: VocabDraft }>("/api/ai/generate", { word: r.draft.word });
            // Keep anything the learner already wrote.
            const merged: VocabDraft = { ...draft, sourceNumber: r.draft.sourceNumber, origin: "import" };
            if (r.draft.meaning1) {
              merged.meaning1 = r.draft.meaning1;
              merged.meaning2 = r.draft.meaning2 || draft.meaning2;
              merged.meaning3 = r.draft.meaning3 || draft.meaning3;
            }
            if (r.draft.cefrSource === "source") {
              merged.cefr = r.draft.cefr;
              merged.cefrSource = "source";
            }
            merged.needsReview = hasIncomplete(merged.reviewNotes);
            results.set(r.key, merged);
          } catch {
            failed++;
          }
          done++;
          setFilling({ done, total: targets.length });
        }
      }),
    );
    setRows((prev) => prev.map((r) => (results.has(r.key) ? { ...r, draft: results.get(r.key)! } : r)));
    setFilling(null);
    if (failed) toast.error(`${failed} word${failed === 1 ? "" : "s"} could not be generated`);
    else toast.success(`Drafted ${results.size} entries`, { description: "Marked AI generated — check them before importing." });
  };

  const doImport = () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;
    const created = importDrafts(selected.map((r) => r.draft));
    setStage({ kind: "done", imported: created.length, needsReview: created.filter((v) => v.needsReview).length });
    setRows([]);
  };

  const fillable = rows.filter((r) => r.selected && r.draft.needsReview && meanings(r.draft).length < 2 && !r.draft.pronunciation).length;
  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div>
      <PageHeader eyebrow="Bulk import" title="Import Vocabulary" description="PDF, CSV, Excel, TXT or pasted text. Everything is previewed first — choose what to import, fix entries, and change CEFR levels before saving." />

      {stage.kind === "choose" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Panel className="flex flex-col p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-ink-3" />
              <span className="eyebrow">Your source document</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold tracking-tight text-ink">{SOURCE_DOCUMENT.title}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {SOURCE_ROWS.length} entries transcribed row by row from <span className="font-mono text-xs">{SOURCE_DOCUMENT.fileName}</span> — pronunciation, type, 3 meanings, 3 synonyms and 3 examples with translations, original numbering kept.
            </p>
            <div className="mt-auto pt-5">
              <Button variant="primary" onClick={loadSource}>
                Preview {SOURCE_ROWS.length} entries <ArrowRight />
              </Button>
            </div>
          </Panel>

          <Panel
            className={cn("flex flex-col border-dashed p-5 transition-colors", dragging && "border-accent bg-accent-soft")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
          >
            <div className="flex items-center gap-2">
              <Upload className="size-4 text-ink-3" />
              <span className="eyebrow">Upload a file</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { icon: FileText, label: "PDF", note: "AI extracts" },
                { icon: FileSpreadsheet, label: "CSV", note: "offline" },
                { icon: FileSpreadsheet, label: "Excel", note: ".xlsx, offline" },
                { icon: FileText, label: "TXT", note: "word lists" },
              ].map((f) => (
                <div key={f.label} className="rounded-md border border-line bg-surface-2/50 px-3 py-2">
                  <f.icon className="size-4 text-ink-3" />
                  <div className="mt-1 text-sm font-medium text-ink">{f.label}</div>
                  <div className="text-[11px] text-ink-3">{f.note}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-3">Headers like <span className="font-mono">Vocab · Pronounciation · Type · Means 2 · Sinonim · Example 3</span> are recognised, so an export of your original sheet imports without AI.</p>
            <div className="mt-auto pt-5">
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.csv,.tsv,.txt,.xlsx,.xls,text/plain,text/csv,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                <FileUp /> Choose file or drop it here
              </Button>
            </div>
          </Panel>

          <Panel className="p-5 lg:col-span-2">
            <div className="flex items-center gap-2">
              <ClipboardPaste className="size-4 text-ink-3" />
              <span className="eyebrow">Manual paste</span>
            </div>
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              className="mt-3 font-mono text-[13px]"
              placeholder={"One word per line, optionally with a meaning:\nominous - tidak menyenangkan\nfutile\n\n…or paste rows copied from your spreadsheet (with the header row)."}
            />
            <div className="mt-3 flex justify-end">
              <Button variant="primary" disabled={!paste.trim()} onClick={() => parseText(paste, "Pasted text")}>
                Preview <ArrowRight />
              </Button>
            </div>
          </Panel>
        </div>
      ) : null}

      {stage.kind === "loading" ? (
        <Panel className="flex items-center gap-3 p-8 text-sm text-ink-2">
          <Spinner /> {stage.label}
          <span className="text-ink-3">Large PDFs are read in parts; this can take a minute.</span>
        </Panel>
      ) : null}

      {stage.kind === "preview" ? (
        <div className="animate-rise">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold tracking-tight text-ink">{rows.length} vocabulary entries detected</div>
              <div className="text-xs text-ink-3">{stage.label}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => { setRows([]); setStage({ kind: "choose" }); }}>
                Cancel
              </Button>
              {fillable ? (
                <Button variant="secondary" onClick={fillWithAi} disabled={!!filling}>
                  {filling ? <Spinner /> : <Wand2 />}
                  {filling ? `Generating ${filling.done}/${filling.total}` : `Generate details with AI (${fillable})`}
                </Button>
              ) : null}
              <Button variant="primary" onClick={doImport} disabled={!selectedCount}>
                Import Selected ({selectedCount})
              </Button>
            </div>
          </div>
          {stage.warnings.length ? (
            <div className="mb-3 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-ink-2">
              {stage.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-ink-3">
            <Badge tone="outline"><Sparkles /> CEFR shown as “Estimated” unless your notes state it</Badge>
            {estimating ? <Badge tone="accent"><Spinner className="size-3" /> Estimating CEFR for {estimating} entries…</Badge> : null}
            <Badge tone="outline">Incomplete rows are flagged, never filled in silently</Badge>
          </div>
          <Panel className="overflow-hidden">
            <PreviewTable rows={rows} onChange={setRows} />
          </Panel>
        </div>
      ) : null}

      {stage.kind === "done" ? (
        <Panel className="mx-auto max-w-xl p-8 text-center animate-pop">
          <CheckCircle2 className="mx-auto size-10 text-good" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">
            {stage.imported} vocabulary {stage.imported === 1 ? "entry" : "entries"} imported
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {stage.needsReview ? `${stage.needsReview} marked Needs Review — you'll find them with the “Needs review” filter.` : "Every entry is complete."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild variant="primary">
              <Link href="/review">
                Start reviewing <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/games">
                <Gamepad2 /> Play games
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={stage.needsReview ? "/vocabulary?needsReview=1" : "/vocabulary"}>Open library</Link>
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: "choose" })}>
              Import more
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
