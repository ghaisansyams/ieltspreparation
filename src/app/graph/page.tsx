"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { Maximize2, Minus, Plus, Search, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { PageHeader, Panel } from "@/components/ui/panel";
import { CefrBadge, cefrVar } from "@/components/vocab/bits";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { RELATION_LABEL, egoGraph, libraryGraph, relationsFor, type GraphLink, type GraphNode } from "@/lib/vocab/relations";
import { searchVocabulary } from "@/lib/vocab/search";
import { shortMeaning } from "@/lib/vocab/fields";
import { cn } from "@/lib/utils";

type SimNode = GraphNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode> & { kind: GraphLink["kind"] };

const W = 900;
const H = 620;

function layout(nodes: GraphNode[], links: GraphLink[], centerId?: string) {
  const simNodes: SimNode[] = nodes.map((n) => ({ ...n, ...(n.id === centerId ? { fx: W / 2, fy: H / 2 } : {}) }));
  const simLinks: SimLink[] = links.map((l) => ({ source: l.source, target: l.target, kind: l.kind }));
  const sim = forceSimulation(simNodes)
    .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance((l) => (centerId ? (l.kind === "family" ? 150 : 190) : 60)).strength(0.7))
    .force("charge", forceManyBody().strength(centerId ? -520 : -90))
    .force("collide", forceCollide<SimNode>().radius((d) => (d.id === centerId ? 60 : d.kind === "vocab" ? 34 : 26)))
    .force("center", forceCenter(W / 2, H / 2))
    .force("x", forceX(W / 2).strength(0.04))
    .force("y", forceY(H / 2).strength(0.06))
    .stop();
  for (let i = 0; i < 320; i++) sim.tick();
  return { nodes: simNodes, links: simLinks };
}

export default function GraphPage() {
  return (
    <Suspense>
      <WordGraph />
    </Suspense>
  );
}

function WordGraph() {
  const params = useSearchParams();
  const router = useRouter();
  const vocab = useAppStore((s) => s.vocab);
  const openQuickView = useUiStore((s) => s.openQuickView);
  const list = useMemo(() => Object.values(vocab), [vocab]);

  const [mode, setMode] = useState<"focus" | "library">("focus");
  const [focusId, setFocusId] = useState<string | null>(() => params.get("word"));
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!focusId || !vocab[focusId]) {
      const connected = list.find((v) => v.wordFamily.length > 1) ?? list[0];
      if (connected) setFocusId(connected.id);
    }
  }, [focusId, vocab, list]);

  const focus = focusId ? vocab[focusId] : undefined;
  const graph = useMemo(() => {
    if (mode === "library") {
      const g = libraryGraph(list);
      return layout(g.nodes, g.links);
    }
    if (!focus) return { nodes: [], links: [] };
    const g = egoGraph(focus, list);
    return layout(g.nodes, g.links, `v:${focus.id}`);
  }, [mode, focus, list]);

  useEffect(() => setView({ x: 0, y: 0, k: mode === "library" ? 0.9 : 1 }), [mode, focusId]);

  const results = useMemo(() => (query.trim() ? searchVocabulary(list, query, { limit: 8 }) : []), [list, query]);
  const relations = useMemo(() => (focus ? relationsFor(focus, list) : []), [focus, list]);

  const neighbors = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    graph.links.forEach((l) => {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      if (s === hover) set.add(t);
      if (t === hover) set.add(s);
    });
    return set;
  }, [hover, graph.links]);

  const selectNode = (n: SimNode) => {
    if (!n.vocabId) return;
    if (mode === "library" || n.vocabId === focusId) openQuickView(n.vocabId);
    else {
      setFocusId(n.vocabId);
      router.replace(`/graph?word=${n.vocabId}`, { scroll: false });
    }
  };

  if (list.length === 0) {
    return (
      <Panel>
        <EmptyState title="No vocabulary yet" description="Import your words to explore how they connect." />
      </Panel>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Word relationship graph"
        title="See how your words connect"
        description="Synonyms, word families and words that share meanings. Click a word to re-centre on it; click the centre to open its card."
        actions={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "focus", label: "Focus" },
              { value: "library", label: "Whole library" },
            ]}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Panel className="relative overflow-hidden">
          <div className="absolute left-3 top-3 z-10 w-64 max-w-[calc(100%-24px)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Jump to a word" className="bg-surface/95 pl-9 backdrop-blur" />
            </div>
            {results.length ? (
              <ul className="mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-pop">
                {results.map((h) => (
                  <li key={h.vocab.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2"
                      onClick={() => {
                        setMode("focus");
                        setFocusId(h.vocab.id);
                        setQuery("");
                      }}
                    >
                      {h.vocab.word}
                      <CefrBadge level={h.vocab.cefr} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
            <Button size="icon-sm" variant="secondary" onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.2) }))} aria-label="Zoom in">
              <Plus />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))} aria-label="Zoom out">
              <Minus />
            </Button>
            <Button size="icon-sm" variant="secondary" onClick={() => setView({ x: 0, y: 0, k: 1 })} aria-label="Reset view">
              <Maximize2 />
            </Button>
            {mode === "focus" ? (
              <Button size="icon-sm" variant="secondary" onClick={() => setFocusId(list[Math.floor(Math.random() * list.length)].id)} aria-label="Random word">
                <Shuffle />
              </Button>
            ) : null}
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="dot-grid h-[min(70vh,640px)] w-full touch-none select-none"
            role="img"
            aria-label={mode === "focus" && focus ? `Relationship graph for ${focus.word}` : "Library relationship graph"}
            onWheel={(e) => {
              const k = Math.min(3, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.08 : 0.92)));
              setView((v) => ({ ...v, k }));
            }}
            onPointerDown={(e) => {
              if ((e.target as Element).closest("[data-node]")) return;
              drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
              (e.target as Element).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current || !svgRef.current) return;
              const scale = W / svgRef.current.getBoundingClientRect().width;
              setView((v) => ({ ...v, x: drag.current!.vx + (e.clientX - drag.current!.x) * scale, y: drag.current!.vy + (e.clientY - drag.current!.y) * scale }));
            }}
            onPointerUp={() => (drag.current = null)}
          >
            <g transform={`translate(${view.x + (W / 2) * (1 - view.k)} ${view.y + (H / 2) * (1 - view.k)}) scale(${view.k})`}>
              {graph.links.map((l, i) => {
                const s = l.source as SimNode;
                const t = l.target as SimNode;
                const dim = neighbors && !(neighbors.has(s.id) && neighbors.has(t.id));
                return (
                  <line
                    key={i}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={l.kind === "family" || l.kind === "same-family" ? "var(--ink-3)" : "var(--line-strong)"}
                    strokeWidth={l.kind === "library-synonym" ? 1.6 : 1}
                    opacity={dim ? 0.15 : 0.9}
                  />
                );
              })}
              {graph.nodes.map((n) => {
                const isCenter = mode === "focus" && n.vocabId === focusId;
                const r = isCenter ? 12 : n.kind === "vocab" ? (mode === "library" ? 5 : 8) : 5;
                const dim = neighbors && !neighbors.has(n.id);
                const showLabel = mode === "focus" || isCenter || hover === n.id || (neighbors?.has(n.id) ?? false);
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${n.x} ${n.y})`}
                    className={cn(n.vocabId && "cursor-pointer")}
                    opacity={dim ? 0.25 : 1}
                    onPointerEnter={() => setHover(n.id)}
                    onPointerLeave={() => setHover(null)}
                    onClick={() => selectNode(n)}
                    tabIndex={n.vocabId ? 0 : -1}
                    onKeyDown={(e) => e.key === "Enter" && selectNode(n)}
                    role={n.vocabId ? "button" : undefined}
                    aria-label={n.label}
                  >
                    <circle r={Math.max(r, 14)} fill="transparent" />
                    {n.kind === "vocab" ? (
                      <circle r={r} fill={n.cefr ? cefrVar(n.cefr) : "var(--ink-3)"} stroke="var(--surface)" strokeWidth={2} />
                    ) : n.kind === "family" ? (
                      <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={1.5} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth={1.4} />
                    ) : (
                      <circle r={r} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={1.4} />
                    )}
                    {showLabel ? (
                      <text
                        y={isCenter ? -22 : -(r + 7)}
                        textAnchor="middle"
                        className={cn(isCenter ? "fill-ink text-[22px]" : n.kind === "vocab" ? "fill-ink text-[13px] font-medium" : "fill-ink-2 text-[12px]")}
                        style={isCenter ? { fontFamily: "var(--font-serif)" } : undefined}
                        paintOrder="stroke"
                        stroke="var(--surface)"
                        strokeWidth={4}
                        strokeLinejoin="round"
                      >
                        {isCenter ? n.label : n.label.toLowerCase()}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: cefrVar("B2") }} /> In your library (colour = CEFR)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-ink-3" /> Synonym
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px] border border-ink-2" /> Word family
            </span>
            <span className="ml-auto text-ink-3">
              {graph.nodes.length} nodes · {graph.links.length} links
            </span>
          </div>
        </Panel>

        <Panel className="h-fit p-5">
          {mode === "focus" && focus ? (
            <>
              <div className="eyebrow">Focus</div>
              <button type="button" onClick={() => openQuickView(focus.id)} className="mt-2 text-left">
                <span className="headword text-4xl text-ink hover:underline">{focus.word}</span>
              </button>
              <p className="mt-1 text-sm text-ink-2">{shortMeaning(focus, 3)}</p>
              <div className="mt-5 space-y-4">
                {(Object.keys(RELATION_LABEL) as (keyof typeof RELATION_LABEL)[]).map((kind) => {
                  const items = relations.filter((r) => r.kind === kind);
                  if (!items.length) return null;
                  return (
                    <div key={kind}>
                      <div className="eyebrow mb-1.5">{RELATION_LABEL[kind]}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((r) =>
                          r.vocabId ? (
                            <button key={r.label} type="button" onClick={() => setFocusId(r.vocabId!)} className="rounded-md border border-accent/35 bg-accent-soft px-2 py-0.5 text-[13px] text-accent-ink hover:border-accent">
                              {r.label}
                            </button>
                          ) : (
                            <span key={r.label} className="rounded-md border border-line px-2 py-0.5 text-[13px] text-ink-2">
                              {r.label}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  );
                })}
                {!relations.length ? <p className="text-sm text-ink-3">No connections yet. Add synonyms or a word family.</p> : null}
              </div>
            </>
          ) : (
            <>
              <div className="eyebrow">Whole library</div>
              <p className="mt-2 text-sm text-ink-2">
                Only words that connect to at least one other saved word are drawn. Hover a node to trace its neighbours; click to open it.
              </p>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
