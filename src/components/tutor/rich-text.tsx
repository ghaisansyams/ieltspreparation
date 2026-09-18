"use client";

import { Fragment, useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import type { Vocabulary } from "@/lib/types";
import { wordPattern } from "@/lib/vocab/word-forms";

// Minimal, safe markdown for AI output: ### headings, **bold**, _italic_,
// `code`, "-" / "1." lists, paragraphs — plus [[word]] markers that become
// clickable vocabulary chips. No HTML is ever injected.

function useMatcher() {
  const vocab = useAppStore((s) => s.vocab);
  return useMemo(() => {
    const list = Object.values(vocab).map((v) => ({ v, re: new RegExp(`^(?:${wordPattern(v.word).source.slice(2, -2)})$`, "i") }));
    const cache = new Map<string, Vocabulary | null>();
    return (text: string): Vocabulary | null => {
      const key = text.trim().toLowerCase();
      if (cache.has(key)) return cache.get(key)!;
      const exact = list.find((x) => x.v.word.toLowerCase() === key) ?? list.find((x) => x.re.test(key));
      cache.set(key, exact?.v ?? null);
      return exact?.v ?? null;
    };
  }, [vocab]);
}

function Inline({ text, match }: { text: string; match: (t: string) => Vocabulary | null }) {
  const open = useUiStore((s) => s.openQuickView);
  const parts = text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|`[^`]+`|_[^_\s][^_]*_)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("[[") && part.endsWith("]]")) {
          const label = part.slice(2, -2);
          const v = match(label);
          return v ? (
            <button
              key={i}
              type="button"
              onClick={() => open(v.id)}
              className="rounded-[4px] bg-accent-soft px-1 font-medium text-accent-ink underline decoration-accent/40 underline-offset-2 transition-colors hover:bg-accent hover:text-accent-contrast"
              title={`Open “${v.word}”`}
            >
              {label}
            </button>
          ) : (
            <strong key={i} className="font-semibold text-ink">
              {label}
            </strong>
          );
        }
        if (part.startsWith("**")) return <strong key={i} className="font-semibold text-ink">{<Inline text={part.slice(2, -2)} match={match} />}</strong>;
        if (part.startsWith("`")) return <code key={i} className="rounded bg-surface-2 px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
        if (part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const match = useMatcher();
  const blocks = useMemo(() => {
    const lines = text.replace(/\r/g, "").split("\n");
    const out: { type: "h" | "p" | "ul" | "ol"; items: string[]; level?: number }[] = [];
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        out.push({ type: "p", items: [] });
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      const ul = line.match(/^\s*[-*•]\s+(.*)$/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const last = out[out.length - 1];
      if (h) out.push({ type: "h", items: [h[2]], level: h[1].length });
      else if (ul) {
        if (last?.type === "ul") last.items.push(ul[1]);
        else out.push({ type: "ul", items: [ul[1]] });
      } else if (ol) {
        if (last?.type === "ol") last.items.push(ol[1]);
        else out.push({ type: "ol", items: [ol[1]] });
      }
      else if (last?.type === "p" && last.items.length) last.items.push(line);
      else out.push({ type: "p", items: [line] });
    }
    return out.filter((b) => b.items.length);
  }, [text]);

  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === "h")
          return (
            <h3 key={i} className="mb-1.5 mt-4 text-[15px] font-semibold tracking-tight text-ink first:mt-0">
              <Inline text={b.items[0]} match={match} />
            </h3>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="my-2 space-y-1 pl-4 [list-style:disc] marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} match={match} />
                </li>
              ))}
            </ul>
          );
        if (b.type === "ol")
          return (
            <ol key={i} className="my-2 space-y-1 pl-5 [list-style:decimal] marker:font-mono marker:text-xs marker:text-ink-3">
              {b.items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} match={match} />
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="my-2 first:mt-0 last:mb-0">
            {b.items.map((it, j) => (
              <Fragment key={j}>
                {j ? <br /> : null}
                <Inline text={it} match={match} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
