"use client";

import { useMemo, useRef, useState } from "react";
import type { LearningStatus } from "@/lib/types";
import type { CefrBucket } from "@/lib/store/selectors";
import { cn } from "@/lib/utils";
import { cefrVar } from "@/components/vocab/bits";

// Hand-built SVG/HTML charts. Rules followed (data-viz method):
// - thin marks: columns ≤ 24px with 4px rounded data-end, 2px lines, ≥8px markers
// - recessive hairline grid, text in ink tokens (never the series colour)
// - legend for ≥ 2 series, selective direct labels, hover tooltips on every mark
// - a visually-hidden table carries every value for screen readers

interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: { label: string; value: string; color?: string }[];
}

function Tooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-32 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-line-strong bg-surface px-2.5 py-2 text-xs shadow-pop"
      style={{ left: state.x, top: state.y }}
      role="status"
    >
      <div className="mb-1 text-ink-3">{state.title}</div>
      {state.rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color ? <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} /> : null}
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Weekly columns ──────────────────────────────────────────────────────

export function WeeklyColumns({
  data,
  height = 150,
  valueLabel = "reviews",
}: {
  data: { date: Date; key: string; reviews: number; correct: number; incorrect: number }[];
  height?: number;
  valueLabel?: string;
}) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(4, ...data.map((d) => d.reviews));
  const niceMax = Math.ceil(max / 4) * 4;
  const ticks = [0, niceMax / 2, niceMax];
  const plotH = height - 24;

  return (
    <div ref={ref} className="relative">
      <div className="relative" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: 24 + (t / niceMax) * (plotH - 8) }}>
            <span className="w-6 text-right font-mono text-[10px] tabular-nums text-ink-3">{t}</span>
            <div className={cn("h-px flex-1", t === 0 ? "bg-axis" : "bg-grid")} />
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 grid" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
          {data.map((d, i) => {
            const h = (d.reviews / niceMax) * (plotH - 8);
            const isToday = i === data.length - 1;
            const weekday = d.date.toLocaleDateString("en-US", { weekday: "short" });
            return (
              <div
                key={d.key}
                className="group relative flex flex-col items-center justify-end"
                style={{ paddingBottom: 24 }}
                tabIndex={0}
                aria-label={`${weekday}: ${d.reviews} ${valueLabel}`}
                onPointerEnter={(e) => {
                  const box = ref.current!.getBoundingClientRect();
                  const col = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTip({
                    x: col.left - box.left + col.width / 2,
                    y: height - 24 - h,
                    title: d.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
                    rows: [
                      { label: valueLabel, value: String(d.reviews) },
                      { label: "correct", value: String(d.correct) },
                      { label: "missed", value: String(d.incorrect) },
                    ],
                  });
                }}
                onPointerLeave={() => setTip(null)}
                onFocus={(e) => {
                  const box = ref.current!.getBoundingClientRect();
                  const col = e.currentTarget.getBoundingClientRect();
                  setTip({ x: col.left - box.left + col.width / 2, y: height - 24 - h, title: weekday, rows: [{ label: valueLabel, value: String(d.reviews) }] });
                }}
                onBlur={() => setTip(null)}
              >
                {isToday && d.reviews > 0 ? <span className="mb-1 font-mono text-[10.5px] font-medium text-ink">{d.reviews}</span> : null}
                <div
                  className="w-full max-w-6 rounded-t-[4px] transition-[height,filter] duration-500 group-hover:brightness-110"
                  style={{ height: Math.max(d.reviews > 0 ? 3 : 0, h), background: "var(--series-1)", opacity: isToday ? 1 : 0.82 }}
                />
                <span className={cn("absolute bottom-0 font-mono text-[10px]", isToday ? "font-semibold text-ink" : "text-ink-3")}>{weekday.slice(0, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <Tooltip state={tip} />
      <div className="sr-only"><table>
        <caption>{valueLabel} per day, last 7 days</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.key}</th>
              <td>{d.reviews}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

// ── CEFR distribution with learning stage ───────────────────────────────

const STAGES: { key: LearningStatus; label: string; color: string }[] = [
  { key: "mastered", label: "Mastered", color: "var(--series-3)" },
  { key: "review", label: "Reviewing", color: "var(--series-1)" },
  { key: "learning", label: "Learning", color: "var(--series-2)" },
  { key: "new", label: "Not started", color: "color-mix(in oklab, var(--ink-3) 38%, transparent)" },
];

export function CefrDistribution({ buckets, onSelect }: { buckets: CefrBucket[]; onSelect?: (level: string) => void }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...buckets.map((b) => b.total));

  return (
    <div ref={ref} className="relative">
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {STAGES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
            <span className="size-2.5 rounded-[2px] border border-line" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {buckets.map((b) => (
          <button
            key={b.level}
            type="button"
            onClick={() => onSelect?.(b.level)}
            className="group grid w-full grid-cols-[44px_1fr_40px] items-center gap-3 text-left"
            aria-label={`${b.level}: ${b.total} words, ${b.byStatus.mastered} mastered`}
          >
            <span className="flex items-center gap-1.5 font-mono text-xs font-medium text-ink">
              {b.level !== "Unrated" ? <span className="size-2 rounded-[2px]" style={{ background: cefrVar(b.level) }} /> : null}
              {b.level === "Unrated" ? "—" : b.level}
            </span>
            <div className="flex h-3.5 items-stretch" style={{ width: `${Math.max(2, (b.total / max) * 100)}%` }}>
              {STAGES.map((s, i) => {
                const n = b.byStatus[s.key];
                if (!n) return null;
                return (
                  <div
                    key={s.key}
                    className={cn("h-full transition-[filter] group-hover:brightness-105", i > 0 && "ml-[2px]")}
                    style={{ flexGrow: n, background: s.color, borderRadius: 2 }}
                    onPointerEnter={(e) => {
                      const box = ref.current!.getBoundingClientRect();
                      const seg = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTip({
                        x: seg.left - box.left + seg.width / 2,
                        y: seg.top - box.top,
                        title: `${b.level} · ${b.total} words`,
                        rows: STAGES.map((st) => ({ label: st.label, value: String(b.byStatus[st.key]), color: st.color })),
                      });
                    }}
                    onPointerLeave={() => setTip(null)}
                  />
                );
              })}
            </div>
            <span className="text-right font-mono text-xs tabular-nums text-ink-2">{b.total}</span>
          </button>
        ))}
      </div>
      <Tooltip state={tip} />
      <div className="sr-only"><table>
        <caption>Words per estimated CEFR level by learning stage</caption>
        <thead>
          <tr>
            <th>Level</th>
            {STAGES.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.level}>
              <th>{b.level}</th>
              {STAGES.map((s) => (
                <td key={s.key}>{b.byStatus[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

// ── Accuracy line (0–100%) ──────────────────────────────────────────────

export function AccuracyLine({ points, height = 180 }: { points: { key: string; label: string; accuracy: number | null; total: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const width = 640;
  const pad = { l: 34, r: 12, t: 12, b: 22 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => pad.t + (1 - v) * plotH;

  const path = useMemo(() => {
    let d = "";
    let pen = false;
    points.forEach((p, i) => {
      if (p.accuracy === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.accuracy).toFixed(1)}`;
      pen = true;
    });
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const last = [...points].reverse().find((p) => p.accuracy !== null);
  const lastIndex = last ? points.lastIndexOf(last) : -1;
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label="Daily answer accuracy"
        onPointerMove={(e) => {
          const box = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * width;
          const i = Math.round(((px - pad.l) / plotW) * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">
              {t * 100}%
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? (
            <text key={p.key} x={x(i)} y={height - 6} textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"} className="fill-ink-3 font-mono text-[10px]">
              {p.label}
            </text>
          ) : null,
        )}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) =>
          p.accuracy !== null && p.total > 0 ? <circle key={p.key} cx={x(i)} cy={y(p.accuracy)} r={2.5} fill="var(--series-1)" /> : null,
        )}
        {last && last.accuracy !== null ? (
          <>
            <circle cx={x(lastIndex)} cy={y(last.accuracy)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
            <text x={x(lastIndex) - 8} y={y(last.accuracy) - 9} textAnchor="end" className="fill-ink font-mono text-[11px] font-semibold">
              {Math.round(last.accuracy * 100)}%
            </text>
          </>
        ) : null}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--line-strong)" strokeWidth={1} /> : null}
      </svg>
      {h ? (
        <div
          className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-pop"
          style={{ left: `${(x(hover!) / width) * 100}%` }}
        >
          <div className="text-ink-3">{h.label}</div>
          <div className="font-semibold text-ink">{h.accuracy === null ? "No answers" : `${Math.round(h.accuracy * 100)}% · ${h.total} answers`}</div>
        </div>
      ) : null}
      <div className="sr-only"><table>
        <caption>Accuracy per day</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th>{p.key}</th>
              <td>{p.accuracy === null ? "—" : `${Math.round(p.accuracy * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

// ── Activity heatmap (sequential blue) ─────────────────────────────────

const HEAT = ["var(--surface-3)", "#b7d3f6", "#6da7ec", "#2a78d6", "#1c5cab"];
const HEAT_DARK = ["var(--surface-3)", "#184f95", "#256abf", "#3987e5", "#86b6ef"];

export function ActivityHeatmap({ days, dark }: { days: { key: string; date: Date; value: number }[]; dark?: boolean }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const scale = dark ? HEAT_DARK : HEAT;
  const step = (v: number) => (v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999)));
  const weeks: (typeof days)[] = [];
  days.forEach((d, i) => {
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push(d);
  });

  return (
    <div ref={ref} className="relative">
      <div className="scrollbar-thin flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {w.map((d) => (
              <div
                key={d.key}
                className="size-3.5 rounded-[3px] transition-[filter] hover:brightness-110"
                style={{ background: scale[step(d.value)] }}
                aria-label={`${d.key}: ${d.value}`}
                onPointerEnter={(e) => {
                  const box = ref.current!.getBoundingClientRect();
                  const cell = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTip({
                    x: cell.left - box.left + cell.width / 2,
                    y: cell.top - box.top,
                    title: d.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
                    rows: [{ label: "answers", value: String(d.value) }],
                  });
                }}
                onPointerLeave={() => setTip(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-3">
        Less
        {scale.map((c) => (
          <span key={c} className="size-2.5 rounded-[2px]" style={{ background: c }} />
        ))}
        More
      </div>
      <Tooltip state={tip} />
    </div>
  );
}

// ── Horizontal bars (single series) ─────────────────────────────────────

export function HBars({ rows, format = (n) => String(n) }: { rows: { label: string; value: number; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3" title={`${r.label}: ${format(r.value)}`}>
          <span className="truncate text-xs text-ink-2">{r.label}</span>
          <div className="h-3 rounded-r-[4px]" style={{ width: r.value > 0 ? `${Math.max(1.5, (r.value / max) * 100)}%` : 0, background: "var(--series-1)" }} />
          <span className="text-right font-mono text-xs tabular-nums text-ink">
            {format(r.value)}
            {r.sub ? <span className="ml-1.5 text-ink-3">{r.sub}</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}
