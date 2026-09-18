"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Headphones, Mic, MicOff, PenLine, Presentation, RefreshCw, Send, Sparkles, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/misc";
import { EvaluationView } from "@/components/games/evaluation-view";
import { WritingTaskPractice } from "@/components/ielts/writing-task";
import { Feedback, QuestionView, type AnswerResult } from "@/components/games/question-view";
import { CefrBadge, ListenButton } from "@/components/vocab/bits";
import { EmptyLibrary } from "@/components/vocab/empty-library";
import { useAiStatus } from "@/hooks/use-ai-status";
import { aiJson } from "@/lib/ai/client";
import type { Evaluation } from "@/lib/ai/schemas";
import { clozeTyped, synonymChoice, type Question } from "@/lib/games/questions";
import { useAppStore } from "@/lib/store/app-store";
import type { TaskType } from "@/lib/ielts/band";
import { MIN_WORDS, TIME_MINUTES } from "@/lib/ielts/band";
import type { IeltsSkill, Vocabulary } from "@/lib/types";
import { allMeaningsText, examples, shortMeaning } from "@/lib/vocab/fields";
import { findWordInSentence } from "@/lib/vocab/word-forms";
import { cn, sample } from "@/lib/utils";

const CATEGORIES: { skill: IeltsSkill; icon: typeof PenLine; blurb: string; mode: "write" | "reading" | "listening" }[] = [
  { skill: "Academic", icon: BookOpen, blurb: "Formal, precise sentences for academic contexts.", mode: "write" },
  { skill: "Writing Task 1", icon: Presentation, blurb: "Describe charts, trends and processes.", mode: "write" },
  { skill: "Writing Task 2", icon: SquarePen, blurb: "Argue, concede and conclude in essays.", mode: "write" },
  { skill: "Speaking", icon: Mic, blurb: "Natural spoken answers — type or dictate.", mode: "write" },
  { skill: "Reading", icon: BookOpen, blurb: "Recognise paraphrases in context.", mode: "reading" },
  { skill: "Listening", icon: Headphones, blurb: "Hear a sentence, catch the word.", mode: "listening" },
];

const TASK1 = [
  "Describe a trend in a line graph using “{w}”.",
  "Summarise the main difference between two groups in a bar chart using “{w}”.",
  "Describe one stage of a manufacturing process using “{w}”.",
  "Write an overview sentence for a table of data using “{w}”.",
];
const TOPICS = ["technology in education", "urban living", "climate change", "public health", "work–life balance", "the influence of social media", "globalisation", "government spending"];
const TASK2 = [
  "Write a sentence for an essay about {t} that uses “{w}”.",
  "Write a concession sentence (“Although…”) about {t} using “{w}”.",
  "Write a conclusion sentence about {t} that uses “{w}”.",
];
const SPEAKING = [
  "Part 1 — Do you enjoy learning new things? Answer in one or two sentences using “{w}”.",
  "Part 2 — Describe a time you had to change a plan. Use “{w}” naturally.",
  "Part 3 — Do people today rely too much on technology? Answer using “{w}”.",
  "Part 3 — How has your city changed in recent years? Use “{w}”.",
];
const ACADEMIC = [
  "Write an academic sentence that uses “{w}” with the collocation “{c}”.",
  "Paraphrase this idea formally using “{w}”: “{e}”",
  "Write a sentence that could appear in a research summary, using “{w}”.",
];

function pickTask(skill: IeltsSkill, v: Vocabulary): string {
  const fill = (t: string) =>
    t
      .replace("{w}", v.word.toLowerCase())
      .replace("{t}", sample(TOPICS, 1)[0])
      .replace("{c}", v.collocations[0] ?? v.word.toLowerCase())
      .replace("{e}", examples(v)[0]?.en ?? v.definition ?? v.word);
  switch (skill) {
    case "Writing Task 1":
      return fill(sample(TASK1, 1)[0]);
    case "Writing Task 2":
      return fill(sample(TASK2, 1)[0]);
    case "Speaking":
      return fill(sample(SPEAKING, 1)[0]);
    default:
      return fill(sample(v.collocations.length ? ACADEMIC : ACADEMIC.slice(1), 1)[0]);
  }
}

export default function IeltsPage() {
  const [mode, setMode] = useState<"writing" | "sentence">("writing");
  const [taskType, setTaskType] = useState<TaskType>("task2");

  return (
    <div>
      <PageHeader
        eyebrow="IELTS mode"
        title="Use your words like an examiner expects"
        description="Write a full Task 1 or Task 2 answer and get it marked against the official IELTS band descriptors — on a random chart, a sample task, or an image you upload yourself."
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "writing", label: "Full writing task" },
              { value: "sentence", label: "Sentence practice" },
            ]}
          />
        }
      />

      {mode === "writing" ? (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented
              value={taskType}
              onChange={setTaskType}
              options={[
                { value: "task1", label: "Task 1" },
                { value: "task2", label: "Task 2" },
              ]}
            />
            <span className="text-xs text-ink-3">
              {taskType === "task1"
                ? `Describe a chart, table, pie or process — random, sample or your own image · ${TIME_MINUTES.task1} min · ${MIN_WORDS.task1}+ words`
                : `Write an essay · ${TIME_MINUTES.task2} min · ${MIN_WORDS.task2}+ words`}
            </span>
            <Badge tone="outline">Marked on TA/TR · CC · LR · GRA (0–9)</Badge>
          </div>
          <WritingTaskPractice key={taskType} taskType={taskType} />
        </div>
      ) : (
        <SentencePractice />
      )}
    </div>
  );
}

function SentencePractice() {
  const vocab = useAppStore((s) => s.vocab);
  const list = useMemo(() => Object.values(vocab), [vocab]);
  const [skill, setSkill] = useState<IeltsSkill>("Writing Task 2");
  const category = CATEGORIES.find((c) => c.skill === skill)!;

  const poolFor = useCallback(
    (s: IeltsSkill) => {
      const tagged = list.filter((v) => v.ieltsRelevance?.skills.includes(s));
      const high = list.filter((v) => v.ieltsRelevance?.level === "high");
      return tagged.length >= 5 ? tagged : high.length >= 5 ? high : list;
    },
    [list],
  );
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.skill, list.filter((v) => v.ieltsRelevance?.skills.includes(c.skill)).length])), [list]);

  return (
    <div>
      <p className="mb-4 text-sm text-ink-2">One word, one sentence, quick feedback. Sentence practice is for using vocabulary correctly — it deliberately gives no band, because a band describes a whole Task 1 or Task 2 response.</p>

      <div className="scrollbar-thin -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.skill}
            type="button"
            onClick={() => setSkill(c.skill)}
            aria-pressed={skill === c.skill}
            className={cn(
              "flex min-w-40 flex-col rounded-[10px] border px-4 py-3 text-left transition-colors",
              skill === c.skill ? "border-ink bg-surface shadow-card" : "border-line bg-surface/60 hover:border-line-strong",
            )}
          >
            <span className="flex items-center justify-between">
              <c.icon className={cn("size-4", skill === c.skill ? "text-ink" : "text-ink-3")} />
              <span className="font-mono text-[10.5px] text-ink-3">{counts[c.skill]} words</span>
            </span>
            <span className="mt-2 text-sm font-semibold text-ink">{c.skill}</span>
            <span className="mt-0.5 text-xs text-ink-3">{c.blurb}</span>
          </button>
        ))}
      </div>

      {list.length < 4 ? (
        <EmptyLibrary feature="IELTS exercises" needed={4} />
      ) : category.mode === "write" ? (
        <WritingExercise key={skill} skill={skill} pool={poolFor(skill)} />
      ) : (
        <ObjectiveExercise key={skill} mode={category.mode} pool={poolFor(skill)} all={list} />
      )}
    </div>
  );
}

function WritingExercise({ skill, pool }: { skill: IeltsSkill; pool: Vocabulary[] }) {
  const status = useAiStatus();
  const logSentence = useAppStore((s) => s.logSentence);
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const [word, setWord] = useState<Vocabulary>(() => sample(pool, 1)[0]);
  const [task, setTask] = useState(() => pickTask(skill, word));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [offlineNote, setOfflineNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(Date.now());

  const next = () => {
    const w = sample(pool.filter((p) => p.id !== word.id), 1)[0] ?? word;
    setWord(w);
    setTask(pickTask(skill, w));
    setText("");
    setEvaluation(null);
    setOfflineNote(null);
    setError(null);
    started.current = Date.now();
  };

  const submit = async () => {
    const sentence = text.trim();
    if (sentence.length < 4) return;
    setError(null);
    if (!status?.configured) {
      const used = !!findWordInSentence(sentence, word.word);
      logSentence(word.id);
      answerQuestion(word.id, "ielts", used, Date.now() - started.current);
      setOfflineNote(used ? "You used the target word. Add an AI key to get grammar, naturalness and band feedback." : `The sentence doesn't seem to use “${word.word.toLowerCase()}”.`);
      return;
    }
    setBusy(true);
    try {
      const res = await aiJson<{ evaluation: Evaluation }>("/api/ai/evaluate", { word: word.word, meaning: allMeaningsText(word), task, category: skill, sentence });
      setEvaluation(res.evaluation);
      logSentence(word.id);
      answerQuestion(word.id, "ielts", res.evaluation.targetWordUsedCorrectly, Date.now() - started.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not evaluate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Panel className="p-5 sm:p-7">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="outline">{skill}</Badge>
          <Button size="xs" variant="ghost" onClick={next}>
            <RefreshCw /> New prompt
          </Button>
        </div>
        <p className="mt-4 text-[clamp(1.1rem,2.4vw,1.35rem)] leading-snug text-ink">{task}</p>

        {evaluation ? (
          <div className="mt-6">
            <EvaluationView evaluation={evaluation} sentence={text} />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEvaluation(null)}>
                <PenLine /> Revise my sentence
              </Button>
              <Button variant="primary" onClick={next}>
                Next prompt
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={skill === "Speaking" ? "Speak or type your answer…" : "Write your sentence…"}
                className="pr-12 text-base"
                aria-label="Your answer"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
                }}
              />
              {skill === "Speaking" ? <Dictation onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <Sparkles className="size-3.5" />
                {status?.configured ? "Grammar · vocabulary usage · naturalness · context · CEFR fit" : "Offline check only — add an AI key for full feedback"}
              </span>
              <Button variant="primary" onClick={submit} disabled={busy || text.trim().length < 4}>
                {busy ? <Spinner className="text-bg" /> : <Send />} Get feedback
              </Button>
            </div>
            {offlineNote ? <p className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">{offlineNote}</p> : null}
            {error ? <p className="mt-3 text-sm text-bad-ink">{error}</p> : null}
          </div>
        )}
      </Panel>

      <Panel className="h-fit p-5">
        <div className="eyebrow">Target word</div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <h3 className="headword text-4xl text-ink">{word.word}</h3>
          <ListenButton text={word.word} compact />
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
          <span className="ipa">{word.pronunciation}</span>
          <CefrBadge level={word.cefr} source={word.cefrSource} size="sm" />
        </div>
        <p className="mt-3 text-sm text-ink">{shortMeaning(word, 3)}</p>
        {word.collocations.length ? (
          <div className="mt-4">
            <div className="eyebrow mb-1">Collocations</div>
            <p className="text-sm text-ink-2">{word.collocations.join(" · ")}</p>
          </div>
        ) : null}
        {examples(word)[0] ? (
          <div className="mt-4">
            <div className="eyebrow mb-1">Your example</div>
            <p className="text-sm italic text-ink-2">{examples(word)[0].en}</p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function Dictation({ onText }: { onText: (t: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((res) => res[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setSupported(true);
  }, [onText]);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (listening) rec.current?.stop();
        else {
          rec.current?.start();
          setListening(true);
        }
      }}
      className={cn("absolute right-2 top-2 grid size-8 place-items-center rounded-md border transition-colors", listening ? "animate-pulse border-bad bg-bad-soft text-bad-ink" : "border-line-strong text-ink-2 hover:bg-surface-2")}
      aria-label={listening ? "Stop dictation" : "Dictate"}
    >
      {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </button>
  );
}

function ObjectiveExercise({ mode, pool, all }: { mode: "reading" | "listening"; pool: Vocabulary[]; all: Vocabulary[] }) {
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const make = useCallback((): Question | null => {
    for (const v of sample(pool, 30)) {
      if (mode === "reading") {
        const ex = examples(v).find((e) => findWordInSentence(e.en, v.word));
        const q = synonymChoice(v, all, Math.random, "ielts");
        if (q && ex) return { ...q, prompt: { eyebrow: "Reading · paraphrase", text: `“${ex.en}”`, sub: `Which option is closest in meaning to “${v.word.toLowerCase()}” here?` } };
      } else {
        const q = clozeTyped(v, Math.random, "ielts");
        if (q) return { ...q, prompt: { ...q.prompt, eyebrow: "Listening · dictation", sub: "Press Listen, then type the missing word.", speak: q.prompt.speak } };
      }
    }
    return null;
  }, [pool, all, mode]);

  const [question, setQuestion] = useState<Question | null>(() => make());
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  if (!question) return <Panel className="p-8 text-center text-sm text-ink-2">Not enough example sentences for this exercise yet.</Panel>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 flex items-center justify-between text-xs text-ink-3">
        <span>{mode === "reading" ? "Reading" : "Listening"} practice</span>
        <span className="font-mono">
          {score.correct}/{score.total} correct
        </span>
      </div>
      <Panel className="px-5 py-8 sm:px-10 sm:py-12">
        {mode === "listening" && !result ? (
          <div className="mb-2 flex justify-center">
            <Badge tone="accent">
              <Headphones /> Audio uses your browser&rsquo;s voice
            </Badge>
          </div>
        ) : null}
        <QuestionView
          key={question.id}
          question={question}
          result={result}
          onAnswer={(r) => {
            setResult(r);
            setScore((s) => ({ correct: s.correct + (r.correct ? 1 : 0), total: s.total + 1 }));
            answerQuestion(question.vocabId, "ielts", r.correct, r.responseTime);
          }}
        />
      </Panel>
      {result ? (
        <Feedback
          question={question}
          result={result}
          onNext={() => {
            setResult(null);
            setQuestion(make());
          }}
        />
      ) : null}
    </div>
  );
}
