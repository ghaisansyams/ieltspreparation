"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CornerDownLeft, Filter, Plus, Search } from "lucide-react";
import { CefrBadge } from "@/components/vocab/bits";
import { Kbd } from "@/components/ui/misc";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { MATCH_LABEL, searchVocabulary, synonymMatches } from "@/lib/vocab/search";
import { shortMeaning } from "@/lib/vocab/fields";

const TIPS = ["cefr:c1", "pos:verb", "tag:academic", "status:learning"];

/** ⌘K global search across word, meaning, synonym, CEFR, part of speech, example and tag. */
export function CommandSearch() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const openQuickView = useUiStore((s) => s.openQuickView);
  const vocab = useAppStore((s) => s.vocab);
  const progress = useAppStore((s) => s.progress);
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const list = useMemo(() => Object.values(vocab), [vocab]);
  const hits = useMemo(
    () => (query.trim() ? searchVocabulary(list, query, { limit: 30, statusOf: (id) => progress[id]?.status }) : []),
    [list, query, progress],
  );
  const syn = useMemo(() => (query.trim() ? synonymMatches(list, query) : []), [list, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] animate-fade" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop">
          <DialogPrimitive.Title className="sr-only">Search vocabulary</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search by word, meaning, synonym, level, type, example or tag</DialogPrimitive.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-ink-3" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                autoFocus
                placeholder="Search words, meanings, synonyms…"
                className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="scrollbar-thin max-h-[58vh] overflow-y-auto p-2">
              {!query.trim() ? (
                <div className="px-3 py-4">
                  <div className="eyebrow mb-2 flex items-center gap-1.5">
                    <Filter className="size-3" /> Filters
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPS.map((t) => (
                      <button key={t} type="button" onClick={() => setQuery(`${t} `)} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-xs text-ink-2 hover:text-ink">
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-ink-3">Try “reduce”, “enggan”, or “cefr:c1 pos:adjective”.</p>
                </div>
              ) : null}

              {query.trim() && hits.length === 0 && syn.length === 0 ? (
                <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">
                  No match in your library.
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/add?word=${encodeURIComponent(query.trim())}`);
                      close();
                    }}
                    className="mx-auto mt-3 flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-ink hover:bg-surface-2"
                  >
                    <Plus className="size-3.5" /> Add “{query.trim()}”
                  </button>
                </Command.Empty>
              ) : null}

              {hits.length ? (
                <Command.Group heading="Vocabulary">
                  {hits.map((h) => (
                    <Command.Item
                      key={h.vocab.id}
                      value={h.vocab.id}
                      onSelect={() => {
                        router.push(`/vocabulary/${h.vocab.id}`);
                        close();
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 data-[selected=true]:bg-surface-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-ink">{h.vocab.word}</span>
                          <span className="truncate text-xs text-ink-3">{h.vocab.partOfSpeech}</span>
                        </div>
                        <div className="truncate text-xs text-ink-2">
                          {h.field === "word" ? shortMeaning(h.vocab) : (
                            <>
                              <span className="text-ink-3">{MATCH_LABEL[h.field]}: </span>
                              {h.snippet}
                            </>
                          )}
                        </div>
                      </div>
                      <CefrBadge level={h.vocab.cefr} source={h.vocab.cefrSource} size="sm" />
                      <button
                        type="button"
                        className="hidden rounded px-1.5 py-0.5 text-[11px] text-ink-3 hover:bg-surface-3 hover:text-ink sm:block"
                        onClick={(e) => {
                          e.stopPropagation();
                          openQuickView(h.vocab.id);
                          close();
                        }}
                      >
                        Peek
                      </button>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {syn.length ? (
                <Command.Group heading="Synonyms in your notes">
                  {syn.map((s) => (
                    <Command.Item
                      key={`${s.synonym}-${s.parent.id}`}
                      value={`syn-${s.synonym}-${s.parent.id}`}
                      onSelect={() => {
                        openQuickView(s.parent.id);
                        close();
                      }}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm data-[selected=true]:bg-surface-2"
                    >
                      <span className="text-ink">{s.synonym}</span>
                      <span className="text-xs text-ink-3">synonym of {s.parent.word}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-3">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                open
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
