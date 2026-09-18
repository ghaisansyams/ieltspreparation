"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  GitFork,
  Network,
  PenLine,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState, Spinner, Stat } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiMark, ListenButton, MeaningText, SourceMark, StatusBadge, SynonymChip } from "@/components/vocab/bits";
import { CefrSelector } from "@/components/vocab/cefr-selector";
import { HighlightWord, UseThisWord } from "@/components/vocab/use-this-word";
import { VocabCard } from "@/components/vocab/vocab-card";
import { VocabForm } from "@/components/vocab/vocab-form";
import { aiJson } from "@/lib/ai/client";
import type { Enhancement } from "@/lib/ai/schemas";
import { proposeEnhancement, type ProposedChange } from "@/lib/ai/to-draft";
import { accuracy } from "@/lib/learning/srs";
import { priorityLevel, priorityScore } from "@/lib/learning/priority";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { AiField, VocabDraft, Vocabulary } from "@/lib/types";
import { examples, meanings, synonyms } from "@/lib/vocab/fields";
import { RELATION_LABEL, relationsFor, type Relation } from "@/lib/vocab/relations";
import { cn, formatInterval, relativeDays } from "@/lib/utils";

const ORIGIN_LABEL: Record<Vocabulary["origin"], string> = {
  "source-pdf": "From your vocabulary PDF",
  import: "Imported",
  manual: "Added manually",
  "ai-generated": "Generated with AI",
};

export default function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const vocab = useAppStore((s) => s.vocab[id]);
  if (!vocab) {
    return (
      <Panel>
        <EmptyState title="Word not found" description="It may have been deleted." action={<Button asChild size="sm"><Link href="/vocabulary">Back to library</Link></Button>} />
      </Panel>
    );
  }
  return <WordDetail key={vocab.id} vocab={vocab} />;
}

function WordDetail({ vocab }: { vocab: Vocabulary }) {
  const router = useRouter();
  const progress = useAppStore((s) => s.progress[vocab.id]);
  const all = useAppStore((s) => s.vocab);
  const attempts = useAppStore((s) => s.attempts);
  const { setCefr, updateVocabulary, deleteVocabulary, verifyAiFields, resolveReview } = useAppStore.getState();
  const openQuickView = useUiStore((s) => s.openQuickView);

  const [tab, setTab] = useState("overview");
  const [editDraft, setEditDraft] = useState<VocabDraft>(vocab);
  const [enhancing, setEnhancing] = useState(false);
  const [proposals, setProposals] = useState<ProposedChange[] | null>(null);
  const [accepted, setAccepted] = useState<Set<AiField>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const relations = useMemo(() => relationsFor(vocab, Object.values(all)), [vocab, all]);
  const history = useMemo(() => attempts.filter((a) => a.vocabularyId === vocab.id).slice(-12).reverse(), [attempts, vocab.id]);
  const isSource = vocab.origin === "source-pdf" || vocab.origin === "import";
  const ai = (f: AiField) => vocab.aiFields.includes(f);
  const originMark = (f: AiField) => (ai(f) ? <AiMark /> : isSource ? <SourceMark /> : null);

  const enhance = async () => {
    setEnhancing(true);
    try {
      const { enhancement } = await aiJson<{ enhancement: Enhancement }>("/api/ai/enhance", {
        word: vocab.word,
        partOfSpeech: vocab.partOfSpeech,
        meanings: meanings(vocab),
        synonyms: synonyms(vocab),
        examples: examples(vocab).map((e) => e.en),
      });
      const changes = proposeEnhancement(vocab, enhancement);
      setProposals(changes);
      setAccepted(new Set(changes.map((c) => c.field)));
      if (!changes.length) toast("Nothing to add", { description: "Your entry already has everything the AI suggested." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhancement failed");
    } finally {
      setEnhancing(false);
    }
  };

  const applyProposals = () => {
    if (!proposals) return;
    const chosen = proposals.filter((p) => accepted.has(p.field));
    const patch = Object.assign({}, ...chosen.map((c) => c.patch)) as Partial<Vocabulary>;
    const aiFields = [...new Set([...vocab.aiFields, ...chosen.map((c) => c.field)])];
    updateVocabulary(vocab.id, { ...patch, aiFields });
    setProposals(null);
    toast.success(`Added ${chosen.length} AI suggestion${chosen.length === 1 ? "" : "s"}`, { description: "Your original meanings and examples were not changed." });
  };

  const saveEdit = () => {
    const { id: _id, ...rest } = editDraft as Vocabulary;
    void _id;
    updateVocabulary(vocab.id, rest);
    toast.success("Saved");
    setTab("overview");
  };

  const acc = progress ? accuracy(progress) : null;
  const level = progress ? priorityLevel(priorityScore(progress)) : "medium";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/vocabulary">
            <ArrowLeft /> Library
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {vocab.aiFields.length ? (
            <Button size="sm" variant="ghost" onClick={() => { verifyAiFields(vocab.id, "all"); toast.success("All AI fields marked as verified"); }}>
              <BadgeCheck /> Verify AI fields
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={enhance} disabled={enhancing}>
            {enhancing ? <Spinner /> : <Sparkles />}
            Enhance with AI
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditDraft(vocab); setTab("edit"); }}>
            <PenLine /> Edit
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete word">
            <Trash2 />
          </Button>
        </div>
      </div>

      {vocab.needsReview ? (
        <div className="mb-5 flex flex-col gap-3 rounded-[10px] border border-warn/40 bg-warn-soft p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" />
            <div>
              <div className="text-sm font-medium text-ink">Needs review</div>
              <ul className="mt-1 space-y-0.5 text-sm text-ink-2">
                {vocab.reviewNotes.filter((n) => n.kind === "incomplete").map((n, i) => (
                  <li key={i}>{n.text}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditDraft(vocab); setTab("edit"); }}>
              Fix entry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => resolveReview(vocab.id)}>
              <Check /> Mark reviewed
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <VocabCard vocab={vocab} progress={progress} />
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-[10px] border border-line bg-surface p-3 text-center">
            <div>
              <div className="eyebrow">Mastery</div>
              <div className="mt-1 font-semibold text-ink">{progress?.mastery ?? 0}%</div>
            </div>
            <div>
              <div className="eyebrow">Accuracy</div>
              <div className="mt-1 font-semibold text-ink">{acc === null ? "—" : `${Math.round(acc * 100)}%`}</div>
            </div>
            <div>
              <div className="eyebrow">Next</div>
              <div className="mt-1 font-semibold text-ink">{progress?.nextReviewAt ? relativeDays(progress.nextReviewAt) : "—"}</div>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {vocab.sourceNumber ? <span className="font-mono">#{String(vocab.sourceNumber).padStart(3, "0")}</span> : null}
            <span>{ORIGIN_LABEL[vocab.origin]}</span>
            <span>·</span>
            <span>added {new Date(vocab.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="headword text-[clamp(2.6rem,6vw,4rem)] text-ink">{vocab.word}</h1>
            <span className="ipa text-base">{vocab.pronunciation}</span>
            <ListenButton text={vocab.word} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-2">{vocab.partOfSpeech || "—"}</span>
            <StatusBadge status={progress?.status ?? "new"} />
            {vocab.frequency ? <Badge tone="outline">{vocab.frequency}</Badge> : null}
            {vocab.difficulty ? <Badge tone="outline">difficulty {vocab.difficulty}/5</Badge> : null}
            {vocab.tags.map((t) => (
              <Badge key={t} tone="neutral">
                #{t}
              </Badge>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="use">Use this word</TabsTrigger>
              <TabsTrigger value="relations">Relations</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-7">
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="eyebrow">Estimated CEFR</h2>
                </div>
                <CefrSelector
                  value={vocab.cefr}
                  source={vocab.cefrSource}
                  onChange={(level) => setCefr(vocab.id, level)}
                  onAutoDetect={(level) => updateVocabulary(vocab.id, { cefr: level, cefrSource: "estimated", aiFields: [...new Set([...vocab.aiFields, "cefr" as AiField])] })}
                  detectInput={{ word: vocab.word, partOfSpeech: vocab.partOfSpeech, meaning: vocab.meaning1 }}
                />
              </section>

              <DetailSection title="Meanings" mark={originMark("meanings")}>
                {meanings(vocab).length ? (
                  <ol className="space-y-1.5">
                    {meanings(vocab).map((m, i) => (
                      <li key={i} className="flex gap-3 text-[17px] text-ink">
                        <span className="mt-1 font-mono text-xs text-ink-3">{i + 1}</span>
                        <MeaningText value={m} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Missing />
                )}
                {vocab.definition ? (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm italic text-ink-2">
                    “{vocab.definition}” {ai("definition") ? <AiMark label="AI definition" className="not-italic" /> : null}
                  </p>
                ) : null}
              </DetailSection>

              <DetailSection title="Examples" mark={originMark("examples")}>
                {examples(vocab).length ? (
                  <ol className="space-y-4">
                    {examples(vocab).map((ex) => (
                      <li key={ex.index} className="flex gap-3">
                        <span className="mt-1 font-mono text-xs text-ink-3">{ex.index}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] leading-relaxed text-ink">
                            <HighlightWord sentence={ex.en} word={vocab.word} />
                          </p>
                          {ex.id ? <p className="text-sm text-ink-3">{ex.id}</p> : <p className="text-xs italic text-ink-3">No translation</p>}
                        </div>
                        <ListenButton text={ex.en} compact />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Missing />
                )}
              </DetailSection>

              <DetailSection title="Synonyms" mark={originMark("synonyms")}>
                {synonyms(vocab).length ? (
                  <div className="flex flex-wrap gap-2">
                    {synonyms(vocab).map((s) => {
                      const lib = relations.find((r) => r.kind === "library-synonym" && r.label.toLowerCase() === s.split(" (")[0].toLowerCase());
                      return <SynonymChip key={s} value={s} linked={!!lib} onClick={lib?.vocabId ? () => openQuickView(lib.vocabId!) : undefined} />;
                    })}
                  </div>
                ) : (
                  <Missing />
                )}
              </DetailSection>

              <div className="grid gap-6 md:grid-cols-2">
                <DetailSection title="Word family" mark={vocab.wordFamily.length ? originMark("wordFamily") : null}>
                  {vocab.wordFamily.length ? (
                    <div className="space-y-1">
                      <div className="font-medium text-ink">{vocab.word.toUpperCase()}</div>
                      {vocab.wordFamily.map((f) => {
                        const r = relations.find((x) => x.label === f && x.vocabId);
                        return (
                          <div key={f} className="flex items-center gap-2 pl-1 text-sm text-ink-2">
                            <span className="text-ink-3">→</span>
                            {r?.vocabId ? (
                              <button type="button" onClick={() => openQuickView(r.vocabId!)} className="font-medium text-accent-ink hover:underline">
                                {f}
                              </button>
                            ) : (
                              f
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Missing text="No word family yet — try Enhance with AI." />
                  )}
                </DetailSection>
                <DetailSection title="Collocations" mark={vocab.collocations.length ? originMark("collocations") : null}>
                  {vocab.collocations.length ? (
                    <ul className="space-y-1">
                      {vocab.collocations.map((c) => (
                        <li key={c} className="text-sm text-ink">
                          <HighlightWord sentence={c} word={vocab.word} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Missing />
                  )}
                </DetailSection>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <DetailSection title="Common mistakes" mark={vocab.commonMistakes.length ? originMark("commonMistakes") : null}>
                  {vocab.commonMistakes.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-sm text-ink-2">
                      {vocab.commonMistakes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <Missing text="None recorded." />
                  )}
                </DetailSection>
                <DetailSection title="IELTS relevance" mark={vocab.ieltsRelevance ? originMark("ieltsRelevance") : null}>
                  {vocab.ieltsRelevance ? (
                    <div>
                      <Badge tone={vocab.ieltsRelevance.level === "high" ? "good" : vocab.ieltsRelevance.level === "medium" ? "accent" : "neutral"} className="uppercase">
                        {vocab.ieltsRelevance.level}
                      </Badge>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {vocab.ieltsRelevance.skills.map((s) => (
                          <Badge key={s} tone="outline">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      {vocab.ieltsRelevance.note ? <p className="mt-2 text-sm text-ink-2">{vocab.ieltsRelevance.note}</p> : null}
                    </div>
                  ) : (
                    <Missing />
                  )}
                </DetailSection>
              </div>

              {vocab.reviewNotes.some((n) => n.kind === "suggestion") ? (
                <DetailSection title="Notes on the source" mark={<AiMark label="AI noticed" />}>
                  <ul className="space-y-1 text-sm text-ink-2">
                    {vocab.reviewNotes.filter((n) => n.kind === "suggestion").map((n, i) => (
                      <li key={i}>• {n.text}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-3">Your source text was left exactly as written.</p>
                </DetailSection>
              ) : null}
            </TabsContent>

            <TabsContent value="use">
              <UseThisWord vocab={vocab} />
            </TabsContent>

            <TabsContent value="relations">
              <RelationTree vocab={vocab} relations={relations} onOpen={openQuickView} />
            </TabsContent>

            <TabsContent value="progress">
              <div className="grid grid-cols-2 gap-4 rounded-[10px] border border-line bg-surface p-5 sm:grid-cols-4">
                <Stat label="Reviews" value={progress?.reviewCount ?? 0} />
                <Stat label="Correct" value={progress?.correctCount ?? 0} />
                <Stat label="Missed" value={progress?.incorrectCount ?? 0} />
                <Stat label="Streak" value={progress?.streak ?? 0} />
                <Stat label="Interval" value={progress ? formatInterval(progress.intervalDays) : "—"} />
                <Stat label="Ease" value={progress?.easeFactor.toFixed(2) ?? "—"} />
                <Stat label="Confidence" value={`${Math.round((progress?.confidence ?? 0) * 100)}%`} />
                <Stat label="Priority" value={<span className="capitalize">{level}</span>} />
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-ink-2">
                <CalendarClock className="size-4 text-ink-3" />
                {progress?.nextReviewAt ? `Next review ${relativeDays(progress.nextReviewAt)} (${new Date(progress.nextReviewAt).toLocaleString()})` : "Not scheduled yet — it will appear among today's new words."}
              </div>
              <div className="mt-5">
                <div className="eyebrow mb-2">Recent answers</div>
                {history.length ? (
                  <ul className="divide-y divide-line rounded-[10px] border border-line bg-surface">
                    {history.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", a.isCorrect ? "bg-good" : "bg-bad")} />
                          {a.isCorrect ? "Correct" : "Missed"}
                          <span className="text-ink-3">· {a.quizType.replace(/-/g, " ")}</span>
                        </span>
                        <span className="font-mono text-xs text-ink-3">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {(a.responseTime / 1000).toFixed(1)}s</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-3">No answers yet.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="edit">
              <Panel className="p-5">
                <VocabForm value={editDraft} onChange={setEditDraft} />
              </Panel>
              <div className="sticky bottom-4 z-10 mt-4 flex justify-end gap-2 rounded-lg border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
                <Button variant="ghost" onClick={() => { setEditDraft(vocab); setTab("overview"); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={saveEdit}>
                  <Save /> Save changes
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!proposals?.length} onOpenChange={(o) => !o && setProposals(null)}>
        <DialogContent title="AI suggestions" description="Choose what to add. Your own meanings, synonyms and examples are never changed." className="max-w-2xl">
          <ul className="mt-4 space-y-2">
            {proposals?.map((p) => (
              <li key={p.field}>
                <label className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 hover:bg-surface-2/60">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={accepted.has(p.field)}
                    onChange={(e) => {
                      const next = new Set(accepted);
                      if (e.target.checked) next.add(p.field);
                      else next.delete(p.field);
                      setAccepted(next);
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-ink">{p.label}</div>
                    {p.current ? <div className="mt-1 text-xs text-ink-3 line-through">{p.current}</div> : null}
                    <div className="mt-0.5 text-sm text-ink-2">{p.proposed}</div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setProposals(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyProposals} disabled={!accepted.size}>
              Add {accepted.size} selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent title={`Delete “${vocab.word}”?`} description="Its learning progress and answer history are deleted too. This can't be undone.">
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                deleteVocabulary(vocab.id);
                toast(`Deleted “${vocab.word}”`);
                router.push("/vocabulary");
              }}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailSection({ title, mark, children }: { title: string; mark?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <h2 className="eyebrow">{title}</h2>
        {mark}
      </div>
      {children}
    </section>
  );
}

function Missing({ text = "Not recorded." }: { text?: string }) {
  return <p className="text-sm text-ink-3">{text}</p>;
}

function RelationTree({ vocab, relations, onOpen }: { vocab: Vocabulary; relations: Relation[]; onOpen: (id: string) => void }) {
  const groups = (Object.keys(RELATION_LABEL) as Relation["kind"][])
    .map((kind) => ({ kind, items: relations.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length);
  if (!groups.length) {
    return <EmptyState icon={<GitFork />} title="No connections yet" description="Add synonyms or a word family to connect this word to the rest of your library." />;
  }
  return (
    <div>
      <div className="rounded-[10px] border border-line bg-surface p-5 font-mono text-sm">
        <div className="font-semibold text-ink">{vocab.word.toUpperCase()}</div>
        {groups.map((g, gi) => (
          <div key={g.kind} className="mt-1">
            <div className="text-ink-3">
              {gi === groups.length - 1 ? "└──" : "├──"} <span className="font-sans text-xs uppercase tracking-wider">{RELATION_LABEL[g.kind]}</span>
            </div>
            {g.items.map((r, i) => (
              <div key={`${r.kind}-${r.label}`} className="text-ink-2">
                <span className="text-ink-3">{gi === groups.length - 1 ? "    " : "│   "}{i === g.items.length - 1 ? "└── " : "├── "}</span>
                {r.vocabId ? (
                  <button type="button" onClick={() => onOpen(r.vocabId!)} className="font-sans font-medium text-accent-ink hover:underline">
                    {r.label}
                  </button>
                ) : (
                  <span className="font-sans">{r.label}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <Button asChild size="sm" variant="secondary" className="mt-3">
        <Link href={`/graph?word=${vocab.id}`}>
          <Network /> Explore in Word Graph
        </Link>
      </Button>
    </div>
  );
}
