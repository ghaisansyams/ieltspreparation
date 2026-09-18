"use client";

import { useState } from "react";
import { BookOpenText, Languages, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { Panel } from "@/components/ui/panel";
import { AiMark, ListenButton } from "@/components/vocab/bits";
import { aiJson } from "@/lib/ai/client";
import type { Story } from "@/lib/ai/schemas";
import type { Vocabulary } from "@/lib/types";
import { shortMeaning } from "@/lib/vocab/fields";
import { RichText } from "./rich-text";

export function MiniStory({ words, title = "Mini story", theme }: { words: Vocabulary[]; title?: string; theme?: string }) {
  const [story, setStory] = useState<Story | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await aiJson<{ story: Story }>("/api/ai/story", {
        words: words.slice(0, 15).map((w) => ({ word: w.word, meaning: shortMeaning(w) })),
        theme,
      });
      setStory(res.story);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write the story");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpenText className="size-4 text-ink-3" />
          <span className="eyebrow">{title}</span>
          {story ? <AiMark /> : null}
        </div>
        {story ? (
          <div className="flex gap-1">
            <ListenButton text={story.story.replace(/\[\[|\]\]/g, "")} compact />
            <Button size="xs" variant="ghost" onClick={() => setShowTranslation((s) => !s)}>
              <Languages /> {showTranslation ? "Hide" : "Terjemahan"}
            </Button>
            <Button size="xs" variant="ghost" onClick={generate} disabled={busy}>
              {busy ? <Spinner /> : <RefreshCw />}
            </Button>
          </div>
        ) : null}
      </div>

      {story ? (
        <div className="mt-3 animate-rise">
          <h3 className="headword text-3xl text-ink">{story.title}</h3>
          <RichText text={story.story} className="mt-3 text-[15.5px] leading-[1.75] text-ink" />
          {showTranslation ? <p className="mt-4 border-t border-line pt-3 text-sm leading-relaxed text-ink-3">{story.translation}</p> : null}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-2">A short story using {words.map((w) => w.word.toLowerCase()).slice(0, 8).join(", ")}{words.length > 8 ? "…" : ""} — every word highlighted and clickable.</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={generate} disabled={busy || !words.length}>
            {busy ? <Spinner /> : <Sparkles />}
            Write the story
          </Button>
          {error ? <p className="mt-2 text-xs text-bad-ink">{error}</p> : null}
        </div>
      )}
    </Panel>
  );
}
