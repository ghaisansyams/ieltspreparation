"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Eraser, MessagesSquare, Search, Sparkles, SquareStop, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichText } from "@/components/tutor/rich-text";
import { CefrBadge } from "@/components/vocab/bits";
import { UseThisWord } from "@/components/vocab/use-this-word";
import { useAiStatus } from "@/hooks/use-ai-status";
import { aiStream, AiRequestError } from "@/lib/ai/client";
import { useAppStore } from "@/lib/store/app-store";
import type { Vocabulary } from "@/lib/types";
import { allMeaningsText, shortMeaning, synonymHeads } from "@/lib/vocab/fields";
import { searchVocabulary } from "@/lib/vocab/search";
import { cn, dayKey } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Explain the difference between distinct and distinguish.",
  "Give me 5 words from my vocabulary related to education.",
  "Create a short story using 10 words I learned this month.",
  "Which of my words work best for IELTS Writing Task 1 trends?",
  "Quiz me on three words I'm likely to confuse.",
];

const STORAGE_KEY = "lexis-tutor-thread";

function vocabularyIndex(list: Vocabulary[]): string {
  return list
    .slice(0, 3000)
    .map((v) => [v.word, v.partOfSpeech || "-", v.cefr ? `${v.cefr}${v.cefrSource === "estimated" ? "~" : ""}` : "-", allMeaningsText(v) || "-", synonymHeads(v).join(", ") || "-", v.createdAt.slice(0, 10)].join(" | "))
    .join("\n");
}

/** Offline answers when no AI provider is configured: comparisons and topic lookups straight from the library. */
function offlineAnswer(question: string, list: Vocabulary[]): string {
  const diff = question.match(/difference between\s+([a-z-]+)\s+and\s+([a-z-]+)/i);
  if (diff) {
    const find = (w: string) => list.find((v) => v.word.toLowerCase() === w.toLowerCase());
    const [a, b] = [find(diff[1]), find(diff[2])];
    const describe = (w: string, v?: Vocabulary) =>
      v
        ? `### [[${v.word}]]\n- **${v.partOfSpeech || "—"}** · ${allMeaningsText(v) || "—"}\n${v.definition ? `- ${v.definition}\n` : ""}${v.example1 ? `- _${v.example1}_` : ""}`
        : `### ${w}\n- Not in your library yet.`;
    return `${describe(diff[1], a)}\n\n${describe(diff[2], b)}\n\n_Offline answer from your library. Add an AI key for a full explanation with new examples._`;
  }
  const topic = question.match(/(?:related to|about|for)\s+([a-z ]{3,30})/i)?.[1]?.trim();
  if (topic) {
    const hits = searchVocabulary(list, topic.split(" ")[0], { limit: 8 });
    if (hits.length) return `Words in your library matching **${topic}**:\n\n${hits.map((h) => `- [[${h.vocab.word}]] — ${shortMeaning(h.vocab)}`).join("\n")}\n\n_Offline search. Add an AI key for smarter topic matching._`;
  }
  return "The AI tutor needs an AI provider. Add `ANTHROPIC_API_KEY` (or an OpenAI-compatible key) to `.env.local` and restart. Offline, I can still compare two saved words — try “difference between distinct and distinguish”.";
}

export default function TutorPage() {
  return (
    <div>
      <PageHeader eyebrow="AI tutor" title="Ask My Vocabulary" description="A tutor grounded in your own library: it searches your words first, reuses your meanings and examples, and highlights every saved word it mentions." />
      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">
            <MessagesSquare /> Ask my vocabulary
          </TabsTrigger>
          <TabsTrigger value="use">
            <Wand2 /> Use this word
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ask">
          <Chat />
        </TabsContent>
        <TabsContent value="use">
          <WordContexts />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Chat() {
  const vocab = useAppStore((s) => s.vocab);
  const list = useMemo(() => Object.values(vocab), [vocab]);
  const status = useAiStatus();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");

    if (status && !status.configured) {
      setMessages([...history, { role: "assistant", content: offlineAnswer(question, list) }]);
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await aiStream(
        "/api/ai/chat",
        { messages: history.slice(-20), vocabulary: vocabularyIndex(list), today: dayKey() },
        (full) => setMessages([...history, { role: "assistant", content: full }]),
        controller.signal,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const msg = e instanceof AiRequestError && e.code === "ai_not_configured" ? offlineAnswer(question, list) : `_${e instanceof Error ? e.message : "Something went wrong."}_`;
      setMessages([...history, { role: "assistant", content: msg }]);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <Panel className="flex h-[calc(100dvh-270px)] min-h-[480px] flex-col overflow-hidden">
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center">
            <div className="text-center">
              <Sparkles className="mx-auto size-6 text-ink-3" />
              <h2 className="headword mt-3 text-4xl text-ink">What would you like to understand?</h2>
              <p className="mt-2 text-sm text-ink-3">
                Grounded in your {list.length} saved words.
                {status && !status.configured ? " AI is not configured — offline answers only." : ""}
              </p>
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-[10px] border border-line bg-surface px-4 py-3 text-left text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-ink px-4 py-2.5 text-[14.5px] text-bg">{m.content}</div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
                    <Sparkles className="size-3.5 text-ink-2" />
                  </div>
                  <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink">
                    {m.content ? <RichText text={m.content} /> : <Spinner />}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>
      <div className="border-t border-line bg-surface p-3 sm:p-4">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          {messages.length ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setMessages([])} aria-label="Clear conversation" disabled={busy}>
              <Eraser />
            </Button>
          ) : null}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask about your words…"
            className="max-h-40 min-h-10 flex-1 resize-none"
            aria-label="Message"
          />
          {busy ? (
            <Button type="button" variant="secondary" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Stop">
              <SquareStop />
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="icon" disabled={!input.trim()} aria-label="Send">
              <ArrowUp />
            </Button>
          )}
        </form>
      </div>
    </Panel>
  );
}

function WordContexts() {
  const vocab = useAppStore((s) => s.vocab);
  const list = useMemo(() => Object.values(vocab).sort((a, b) => a.word.localeCompare(b.word)), [vocab]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const results = useMemo(() => (query.trim() ? searchVocabulary(list, query, { limit: 60 }).map((h) => h.vocab) : list), [list, query]);
  const current = selected ? vocab[selected] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Panel className="flex max-h-[70vh] flex-col overflow-hidden">
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Choose a word" className="pl-9" />
          </div>
        </div>
        <ul className="scrollbar-thin flex-1 overflow-y-auto p-1.5">
          {results.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelected(v.id)}
                className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors", selected === v.id ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/60")}
              >
                <span className="truncate">{v.word}</span>
                <CefrBadge level={v.cefr} source={v.cefrSource} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <div>
        {current ? (
          <div>
            <div className="mb-4">
              <h2 className="headword text-5xl text-ink">{current.word}</h2>
              <p className="mt-1 text-sm text-ink-3">
                {current.partOfSpeech} · {shortMeaning(current, 3)}
              </p>
            </div>
            <UseThisWord key={current.id} vocab={current} />
          </div>
        ) : (
          <Panel>
            <EmptyState icon={<Wand2 />} title="Pick a word" description="See it used formally, casually, academically, at work and in IELTS — and learn where it doesn't fit." />
          </Panel>
        )}
      </div>
    </div>
  );
}
