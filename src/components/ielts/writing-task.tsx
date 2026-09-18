"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Clock, FileText, ImagePlus, Info, PenLine, RefreshCw, Send, Shuffle, Sparkles, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { TaskVisual } from "@/components/ielts/task-visual";
import { useAiStatus } from "@/hooks/use-ai-status";
import { aiJson } from "@/lib/ai/client";
import type { WritingEvaluation } from "@/lib/ai/schemas";
import { bandLabel, countWords, criteria, lengthPenalty, MIN_WORDS, overallBand, TIME_MINUTES, toHalfBand, type CriterionKey, type TaskType } from "@/lib/ielts/band";
import { describeVisual } from "@/lib/ielts/describe";
import { ACCEPTED_IMAGE_TYPES, ImageError, imageFromClipboard, prepareImage, type PreparedImage } from "@/lib/ielts/image";
import { randomSeed, randomTask1 } from "@/lib/ielts/random-task";
import { HARD_RULES, RUBRIC } from "@/lib/ielts/rubric";
import { tasksFor, type WritingTask } from "@/lib/ielts/tasks";
import { useAppStore } from "@/lib/store/app-store";
import type { Vocabulary } from "@/lib/types";
import { findWordInSentence } from "@/lib/vocab/word-forms";
import { cn } from "@/lib/utils";

const draftKey = (id: string) => `lexis-writing-draft:${id}`;

/** Where the Task 1 stimulus comes from. */
type Source = "random" | "library" | "image";

const IMAGE_TASK_ID = "t1-own-image";
const IMAGE_TAGS = ["data"];
const DEFAULT_IMAGE_PROMPT = "The image below shows information for an IELTS Academic Writing Task 1. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
const T1_RUBRIC = "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";

function bandTone(band: number): "good" | "accent" | "warn" | "bad" {
  if (band >= 7) return "good";
  if (band >= 6) return "accent";
  if (band >= 5) return "warn";
  return "bad";
}

export function WritingTaskPractice({ taskType }: { taskType: TaskType }) {
  const status = useAiStatus();
  const vocab = useAppStore((s) => s.vocab);
  const logSentence = useAppStore((s) => s.logSentence);
  const awardXp = useAppStore((s) => s.awardXp);

  const pool = useMemo(() => tasksFor(taskType), [taskType]);
  const [source, setSource] = useState<Source>(taskType === "task1" ? "random" : "library");
  const [seed, setSeed] = useState(() => randomSeed());
  const [savedId, setSavedId] = useState(() => pool[0].id);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<WritingEvaluation | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedId(pool[0].id);
    setSource(taskType === "task1" ? "random" : "library");
  }, [pool, taskType]);

  const imageTask = useMemo<WritingTask>(
    () => ({
      id: IMAGE_TASK_ID,
      type: "task1",
      title: "Your own image",
      prompt: imagePrompt.trim() || DEFAULT_IMAGE_PROMPT,
      rubric: T1_RUBRIC,
      tags: IMAGE_TAGS,
    }),
    [imagePrompt],
  );

  const randomTask = useMemo(() => randomTask1(seed), [seed]);
  const task: WritingTask =
    taskType === "task1" && source === "random" ? randomTask : taskType === "task1" && source === "image" ? imageTask : (pool.find((t) => t.id === savedId) ?? pool[0]);

  // Restore/keep a draft so a reload never loses the learner's writing.
  useEffect(() => {
    try {
      setText(localStorage.getItem(draftKey(task.id)) ?? "");
    } catch {
      setText("");
    }
    setEvaluation(null);
    setError(null);
    setStartedAt(null);
    setElapsed(0);
  }, [task.id]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (text) localStorage.setItem(draftKey(task.id), text);
        else localStorage.removeItem(draftKey(task.id));
      } catch {}
    }, 500);
    return () => clearTimeout(t);
  }, [text, task.id]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const words = countWords(text);
  const min = MIN_WORDS[taskType];
  const length = lengthPenalty(taskType, words);
  const minutes = TIME_MINUTES[taskType];
  const imageMode = taskType === "task1" && source === "image";

  const targetWords = useMemo(() => {
    const list = Object.values(vocab);
    const tagged = list.filter((v) => v.ieltsRelevance?.level === "high" || v.tags.some((t) => task.tags.includes(t)));
    return (tagged.length >= 20 ? tagged : list).slice(0, 160).map((v) => v.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, task.tags.join("|")]);

  const usedFromLibrary = useMemo(() => {
    if (!text.trim()) return [] as Vocabulary[];
    return Object.values(vocab).filter((v) => findWordInSentence(text, v.word)).slice(0, 24);
  }, [text, vocab]);

  const acceptFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setImageBusy(true);
    setImageError(null);
    try {
      setImage(await prepareImage(file));
    } catch (e) {
      setImage(null);
      setImageError(e instanceof ImageError ? e.message : "That image could not be prepared.");
    } finally {
      setImageBusy(false);
    }
  }, []);

  // Paste a screenshot straight in — the fastest way to bring a real task here.
  useEffect(() => {
    if (!imageMode) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFromClipboard(e.clipboardData?.items ?? null);
      if (file) {
        e.preventDefault();
        void acceptFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [imageMode, acceptFile]);

  const nextTask = () => {
    if (taskType === "task1" && source === "random") {
      setSeed(randomSeed());
      return;
    }
    const other = pool.filter((t) => t.id !== task.id);
    const next = other.length ? other[Math.floor(Math.random() * other.length)] : pool[0];
    setSavedId(next.id);
    setSource("library");
  };

  const canSubmit = !busy && words >= 1 && !!status?.configured && (!imageMode || !!image);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await aiJson<{ evaluation: WritingEvaluation; words: number }>("/api/ai/writing", {
        taskType,
        prompt: task.prompt,
        rubric: task.rubric,
        visual: task.visual ? describeVisual(task.visual) : undefined,
        image: imageMode && image ? { mediaType: image.mediaType, data: image.data } : undefined,
        response: text,
        targetWords,
      });
      setEvaluation(res.evaluation);
      logSentence();
      awardXp(25, "IELTS writing task");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark this response");
    } finally {
      setBusy(false);
    }
  };

  const bands = evaluation
    ? ({
        task: toHalfBand(evaluation.criteria.task.band),
        coherence: toHalfBand(evaluation.criteria.coherence.band),
        lexical: toHalfBand(evaluation.criteria.lexical.band),
        grammar: toHalfBand(evaluation.criteria.grammar.band),
      } satisfies Record<CriterionKey, number>)
    : null;
  const overall = bands ? overallBand(bands) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Panel className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="outline">{taskType === "task1" ? "Academic Task 1" : "Task 2"}</Badge>
              <span className="text-xs text-ink-3">
                {minutes} minutes · at least {min} words
              </span>
            </div>
            {taskType === "task1" ? (
              <div className="flex items-center gap-1" role="group" aria-label="Where the task comes from">
                {(
                  [
                    { key: "random", label: "Random chart", icon: Shuffle },
                    { key: "library", label: "Sample tasks", icon: FileText },
                    { key: "image", label: "Your image", icon: ImagePlus },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={source === key}
                    onClick={() => setSource(key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                      source === key ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:text-ink",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {taskType === "task1" && source === "random" ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <span className="text-xs text-ink-2">A fresh chart, table, pie or process diagram every time — the data is generated for practice.</span>
              <Button size="xs" variant="ghost" onClick={() => setSeed(randomSeed())}>
                <RefreshCw /> New chart
              </Button>
            </div>
          ) : null}

          {taskType !== "task1" || source === "library" ? (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <select
                aria-label="Choose a task"
                value={pool.some((t) => t.id === savedId) ? savedId : pool[0].id}
                onChange={(e) => {
                  setSavedId(e.target.value);
                  setSource("library");
                }}
                className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink-2"
              >
                {pool.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <Button size="xs" variant="ghost" onClick={nextTask}>
                <RefreshCw /> New task
              </Button>
            </div>
          ) : null}

          {imageMode ? (
            <div className="mt-4 space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  void acceptFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {image ? (
                <figure className="m-0 rounded-[10px] border border-line bg-surface p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.dataUrl} alt="The Task 1 stimulus you uploaded" className="mx-auto max-h-[420px] w-auto rounded-md" />
                  <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
                    <span className="truncate">
                      {image.name} · {image.width}×{image.height} · {(image.bytes / 1024).toFixed(0)} KB
                    </span>
                    <span className="flex gap-1">
                      <Button size="xs" variant="ghost" onClick={() => fileRef.current?.click()}>
                        <Upload /> Replace
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setImage(null)}>
                        <Trash2 /> Remove
                      </Button>
                    </span>
                  </figcaption>
                </figure>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void acceptFile(e.dataTransfer.files?.[0]);
                  }}
                  className="rounded-[10px] border border-dashed border-line-strong bg-surface-2/40 px-4 py-8 text-center"
                >
                  {imageBusy ? (
                    <Spinner />
                  ) : (
                    <>
                      <ImagePlus className="mx-auto size-6 text-ink-3" />
                      <p className="mt-2 text-sm text-ink">Upload the chart, table or diagram you want to write about.</p>
                      <p className="mt-1 text-xs text-ink-3">Drag it here, paste a screenshot with ⌘V, or choose a file. PNG, JPEG, WebP or GIF, up to 12 MB.</p>
                      <Button size="sm" variant="secondary" className="mt-3" onClick={() => fileRef.current?.click()}>
                        <Upload /> Choose image
                      </Button>
                    </>
                  )}
                </div>
              )}
              {imageError ? <p className="text-sm text-bad-ink">{imageError}</p> : null}
              <div>
                <label htmlFor="own-question" className="eyebrow mb-1 block">
                  The question that came with it (optional)
                </label>
                <Input
                  id="own-question"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="e.g. The chart below shows the number of visitors to three museums between 2010 and 2020."
                  maxLength={400}
                />
                <p className="mt-1 text-xs text-ink-3">
                  Leave it blank and the examiner marks it as a standard Task 1: summarise the main features and make comparisons.
                </p>
              </div>
              <p className="flex items-start gap-2 text-xs text-ink-3">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Your image is sent with your writing so the examiner can check your figures against it, and is not saved anywhere.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-4 text-[17px] leading-snug text-ink">{task.prompt}</p>
              <p className="mt-2 text-sm italic text-ink-2">{task.rubric}</p>
              {task.visual ? <div className="mt-4">{<TaskVisual visual={task.visual} />}</div> : null}
            </>
          )}
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="eyebrow flex items-center gap-1.5">
              <PenLine className="size-3.5" /> Your response
            </span>
            <div className="flex items-center gap-3 font-mono text-xs">
              <span className={cn(words >= min ? "text-good-ink" : "text-ink-3")}>
                {words}/{min} words
              </span>
              <button
                type="button"
                onClick={() => setStartedAt(startedAt ? null : Date.now())}
                className={cn("flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-ink-2 hover:text-ink", startedAt && elapsed > minutes * 60 && "border-bad text-bad-ink")}
                title={startedAt ? "Stop the timer" : `Start a ${minutes}-minute timer`}
              >
                <Clock className="size-3.5" />
                {startedAt ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}` : `${minutes}:00`}
              </button>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!startedAt && e.target.value.length > 3) setStartedAt(Date.now());
            }}
            rows={16}
            placeholder={taskType === "task1" ? "Introduce what the visual shows, give an overview of the main trends, then describe the key figures in detail…" : "Introduce the topic and your position, develop two or three body paragraphs with examples, then conclude…"}
            aria-label="Your response"
            className="min-h-64 text-[15px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={cn("text-xs", length.under ? "text-warn-ink" : "text-ink-3")}>{length.note}</span>
            <div className="flex items-center gap-2">
              {text ? (
                <Button size="sm" variant="ghost" onClick={() => setText("")}>
                  Clear
                </Button>
              ) : null}
              <Button variant="primary" onClick={submit} disabled={!canSubmit}>
                {busy ? <Spinner className="text-bg" /> : <Send />}
                {busy ? "Marking…" : "Mark my writing"}
              </Button>
            </div>
          </div>
          {imageMode && !image ? <p className="mt-2 text-right text-xs text-ink-3">Add your image above to have it marked.</p> : null}
          {!status?.configured ? (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-ink-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn-ink" />
              Band marking needs an AI provider. Without one you can still write, keep your draft and track the word count — but nothing here can give you a band.
            </p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-bad-ink">{error}</p> : null}
        </Panel>

        {evaluation && bands && overall !== null ? (
          <div ref={resultRef} className="space-y-4 animate-rise">
            <Panel className="overflow-hidden">
              <div className="dot-grid flex flex-col items-center gap-2 border-b border-line px-6 py-8 text-center">
                <span className="eyebrow">Estimated band · this task only</span>
                <div className="text-[64px] font-semibold leading-none tracking-tight text-ink">{overall.toFixed(overall % 1 ? 1 : 0)}</div>
                <p className="text-sm text-ink-2">{bandLabel(overall)}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <Badge tone={length.under ? "warn" : "neutral"}>{words} words</Badge>
                  {words <= HARD_RULES.band1MaxWords ? <Badge tone="bad">{HARD_RULES.band1MaxWords} words or fewer · Band 1</Badge> : null}
                  {evaluation.offTopic ? <Badge tone="bad">Off topic</Badge> : null}
                  {evaluation.memorisedLanguage ? <Badge tone="warn">Looks memorised</Badge> : null}
                  {!evaluation.addressesTask ? <Badge tone="bad">Question not fully answered</Badge> : null}
                  {evaluation.needsReview ? <Badge tone="warn">Needs review</Badge> : null}
                </div>
              </div>
              <div className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {criteria(taskType).map((c) => {
                  const detail = evaluation.criteria[c.key];
                  const band = bands[c.key];
                  return (
                    <div key={c.key} className="px-4 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="eyebrow">{c.abbr}</span>
                        <span className={cn("size-2 rounded-full", { good: "bg-good", accent: "bg-accent", warn: "bg-warn", bad: "bg-bad" }[bandTone(band)])} />
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-ink">{band.toFixed(band % 1 ? 1 : 0)}</div>
                      <div className="text-[11px] leading-snug text-ink-2">{c.name}</div>
                      <p className="mt-2 text-[13px] leading-snug text-ink-2">{detail.summary}</p>
                    </div>
                  );
                })}
              </div>
              <p className="flex items-start gap-2 border-t border-line bg-surface-2/50 px-5 py-3 text-xs text-ink-2">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Marked against the official IELTS Writing band descriptors (public version). The four criteria are averaged and rounded to the nearest half band (an average ending in .25 or .75 rounds up), the same arithmetic the test uses. In the real exam Task 2 counts twice as much as Task 1 and a certified examiner marks your work — treat this as practice feedback, not a result.
              </p>
            </Panel>

            {evaluation.visualReading ? (
              <Panel className="p-5">
                <div className="eyebrow mb-2">How the examiner read the visual</div>
                <p className="text-sm text-ink-2">{evaluation.visualReading}</p>
                <p className="mt-2 text-xs text-ink-3">Check this against your image. If it misread the chart, the content marking will be off — re-upload a clearer crop and mark again.</p>
              </Panel>
            ) : null}

            <Panel className="p-5">
              <div className="eyebrow mb-2">What an examiner would notice</div>
              <p className="text-sm text-ink">{evaluation.overallComment}</p>
              {evaluation.nextBandAdvice.length ? (
                <ul className="mt-3 space-y-1.5">
                  {evaluation.nextBandAdvice.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-ink-2">
                      <span className="text-ink-3">→</span>
                      {a}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>

            <div className="grid gap-4 md:grid-cols-2">
              {criteria(taskType).map((c) => {
                const detail = evaluation.criteria[c.key];
                return (
                  <Panel key={c.key} className="p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-ink">{c.name}</div>
                        <div className="text-xs text-ink-3">{c.what}</div>
                      </div>
                      <span className="text-xl font-semibold text-ink">{bands[c.key]}</span>
                    </div>
                    {detail.evidence.length ? (
                      <div className="mt-3">
                        <div className="eyebrow mb-1.5">From your text</div>
                        <ul className="space-y-1">
                          {detail.evidence.map((q, i) => (
                            <li key={i} className="border-l-2 border-line-strong pl-2.5 text-[13px] italic text-ink-2">“{q}”</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {detail.improve.length ? (
                      <div className="mt-3">
                        <div className="eyebrow mb-1.5">To go half a band higher</div>
                        <ul className="space-y-1 text-[13px] text-ink-2">
                          {detail.improve.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <details className="mt-3 border-t border-line pt-2">
                      <summary className="cursor-pointer text-xs text-ink-3">Band {bands[c.key]} descriptor</summary>
                      <ul className="mt-2 space-y-1 text-[12px] leading-snug text-ink-2">
                        {(RUBRIC[taskType][c.key].find((d) => d.band === Math.floor(bands[c.key])) ?? RUBRIC[taskType][c.key][0]).positive.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                      </ul>
                    </details>
                  </Panel>
                );
              })}
            </div>

            {evaluation.corrections.length ? (
              <Panel className="p-5">
                <div className="eyebrow mb-3">Corrections — your sentence, then a suggestion</div>
                <ul className="space-y-3">
                  {evaluation.corrections.map((c, i) => (
                    <li key={i} className="rounded-[10px] border border-line p-3">
                      <p className="text-[13px] text-ink-3 line-through">{c.original}</p>
                      <p className="mt-1 text-sm font-medium text-ink">{c.suggestion}</p>
                      <p className="mt-1 text-xs text-ink-2">{c.why}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-3">Suggestions only — your response is never rewritten or replaced.</p>
              </Panel>
            ) : null}

            {evaluation.vocabularyUsed.length ? (
              <Panel className="p-5">
                <div className="eyebrow mb-3">Words from your library</div>
                <div className="flex flex-wrap gap-2">
                  {evaluation.vocabularyUsed.map((v) => (
                    <span key={v.word} className={cn("rounded-md border px-2 py-1 text-[13px]", v.usedWell ? "border-good/40 bg-good-soft text-good-ink" : "border-warn/40 bg-warn-soft text-warn-ink")} title={v.comment}>
                      {v.word}
                    </span>
                  ))}
                </div>
              </Panel>
            ) : null}

            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => setEvaluation(null)}>
                <PenLine /> Revise this response
              </Button>
              <Button variant="primary" onClick={nextTask}>
                Next task
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel className="p-5">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <FileText className="size-3.5" /> How this is marked
          </div>
          <ul className="space-y-2 text-[13px] text-ink-2">
            {criteria(taskType).map((c) => (
              <li key={c.key}>
                <span className="font-medium text-ink">{c.abbr}</span> — {c.name}: {c.what}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">
            Each is scored 0–9 in half bands against the official IELTS Writing band descriptors; the task band is their average, rounded to the nearest half band. A response of {HARD_RULES.band1MaxWords} words or fewer is Band 1.
          </p>
        </Panel>

        <Panel className="p-5">
          <div className="eyebrow mb-2">The band descriptors</div>
          <div className="space-y-1">
            {criteria(taskType).map((c) => (
              <details key={c.key} className="rounded-md border border-line px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-ink">{c.name}</summary>
                <ol className="mt-2 space-y-2">
                  {RUBRIC[taskType][c.key].map((d) => (
                    <li key={d.band} className="text-[12px] leading-snug text-ink-2">
                      <span className="font-mono text-[11px] font-semibold text-ink">Band {d.band}</span>
                      <ul className="mt-0.5 space-y-0.5">
                        {d.positive.map((line, i) => (
                          <li key={i}>• {line}</li>
                        ))}
                        {d.limiting?.map((line, i) => (
                          <li key={`l${i}`} className="text-warn-ink">⚠ {line}</li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">Condensed from the public IELTS Writing band descriptors (updated May 2023). ⚠ marks the negative features that limit a band.</p>
        </Panel>

        <Panel className="p-5">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Your words in this response
          </div>
          {usedFromLibrary.length ? (
            <div className="flex flex-wrap gap-1.5">
              {usedFromLibrary.map((v) => (
                <span key={v.id} className="rounded-md border border-accent/35 bg-accent-soft px-2 py-0.5 text-[13px] text-accent-ink">
                  {v.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-3">None yet. Words from your library will light up here as you use them.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
