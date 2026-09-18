"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, PenLine, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/misc";
import { cefrVar } from "@/components/vocab/bits";
import { VocabForm } from "@/components/vocab/vocab-form";
import { CEFR_LEVELS, type CefrLevel, type VocabDraft } from "@/lib/types";
import { examples, meanings, shortMeaning, synonymHeads } from "@/lib/vocab/fields";
import { cn } from "@/lib/utils";

export interface ImportRow {
  key: string;
  draft: VocabDraft;
  selected: boolean;
  /** Existing library entry (or earlier row) with the same headword. */
  duplicateOf: string | null;
}

type Filter = "all" | "review" | "duplicates";
const PAGE = 150;

export function PreviewTable({ rows, onChange }: { rows: ImportRow[]; onChange: (rows: ImportRow[]) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<ImportRow | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const visible = useMemo(
    () => rows.filter((r) => (filter === "review" ? r.draft.needsReview : filter === "duplicates" ? !!r.duplicateOf : true)),
    [rows, filter],
  );
  const selectedCount = rows.filter((r) => r.selected).length;
  const allVisibleSelected = visible.length > 0 && visible.every((r) => r.selected);

  const update = (key: string, patch: Partial<ImportRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setDraft = (key: string, patch: Partial<VocabDraft>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, draft: { ...r.draft, ...patch } } : r)));

  const reviewCount = rows.filter((r) => r.draft.needsReview).length;
  const dupCount = rows.filter((r) => r.duplicateOf).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${rows.length}` },
            { value: "review", label: `Needs review ${reviewCount}` },
            { value: "duplicates", label: `Duplicates ${dupCount}` },
          ]}
        />
        <span className="text-xs text-ink-3">{selectedCount} selected</span>
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="size-4 accent-[var(--accent)]"
                  checked={allVisibleSelected}
                  onChange={(e) => {
                    const keys = new Set(visible.map((r) => r.key));
                    onChange(rows.map((r) => (keys.has(r.key) ? { ...r, selected: e.target.checked } : r)));
                  }}
                />
              </th>
              {["No.", "Word", "Type", "Meaning", "Synonyms", "Examples", "CEFR", "Status", ""].map((h) => (
                <th key={h} className="eyebrow px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map((r) => {
              const d = r.draft;
              return (
                <tr key={r.key} className={cn("border-b border-line align-top transition-colors last:border-0", r.selected ? "bg-surface" : "bg-surface-2/40 text-ink-3")}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" aria-label={`Select ${d.word}`} className="size-4 accent-[var(--accent)]" checked={r.selected} onChange={(e) => update(r.key, { selected: e.target.checked })} />
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs text-ink-3">{d.sourceNumber ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium text-ink">{d.word}</div>
                    <div className="ipa text-[11px]">{d.pronunciation || "—"}</div>
                  </td>
                  <td className="px-2 py-2.5 text-xs text-ink-2">{d.partOfSpeech || <span className="text-ink-3">—</span>}</td>
                  <td className="max-w-56 px-2 py-2.5 text-ink-2">
                    <span className="line-clamp-2">{shortMeaning(d, 3) || <span className="text-ink-3">—</span>}</span>
                    <span className="font-mono text-[10.5px] text-ink-3">{meanings(d).length}/3</span>
                  </td>
                  <td className="max-w-44 px-2 py-2.5 text-xs text-ink-2">
                    <span className="line-clamp-2">{synonymHeads(d).join(", ") || "—"}</span>
                  </td>
                  <td className="px-2 py-2.5 font-mono text-xs text-ink-2">{examples(d).length}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px]" style={{ background: d.cefr ? cefrVar(d.cefr) : "var(--line-strong)" }} />
                      <select
                        aria-label={`CEFR for ${d.word}`}
                        value={d.cefr ?? ""}
                        onChange={(e) =>
                          setDraft(r.key, {
                            cefr: (e.target.value || null) as CefrLevel | null,
                            cefrSource: "manual",
                            aiFields: d.aiFields.filter((f) => f !== "cefr"),
                          })
                        }
                        className="h-7 rounded border border-line bg-surface px-1 font-mono text-xs text-ink"
                      >
                        <option value="">—</option>
                        {CEFR_LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-3">{d.cefr ? (d.cefrSource === "estimated" ? "Estimated" : d.cefrSource === "source" ? "From source" : "Set by you") : ""}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      {d.needsReview ? (
                        <Badge tone="warn" title={d.reviewNotes.filter((n) => n.kind === "incomplete").map((n) => n.text).join(" ")}>
                          <AlertTriangle /> Needs review
                        </Badge>
                      ) : (
                        <Badge tone="good">Ready</Badge>
                      )}
                      {r.duplicateOf ? (
                        <Badge tone="neutral" title={`Same word as ${r.duplicateOf}`}>
                          <Copy /> Duplicate
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => setEditing(r)} aria-label={`Edit ${d.word}`}>
                        <PenLine />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => onChange(rows.filter((x) => x.key !== r.key))} aria-label={`Delete ${d.word}`}>
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length > limit ? (
        <div className="border-t border-line p-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, visible.length - limit)} more
          </Button>
        </div>
      ) : null}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing ? (
          <DialogContent title={`Edit “${editing.draft.word}”`} description="Changes apply to this import preview." className="max-w-3xl">
            <EditRow
              row={editing}
              onCancel={() => setEditing(null)}
              onSave={(draft) => {
                update(editing.key, { draft });
                setEditing(null);
              }}
            />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function EditRow({ row, onSave, onCancel }: { row: ImportRow; onSave: (d: VocabDraft) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(row.draft);
  return (
    <div className="mt-4">
      <VocabForm value={draft} onChange={setDraft} dense />
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave(draft)}>
          Apply
        </Button>
      </div>
    </div>
  );
}
