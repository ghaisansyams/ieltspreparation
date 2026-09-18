"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { describeVisual } from "@/lib/ielts/describe";
import type { Visual } from "@/lib/ielts/tasks";
import { cn } from "@/lib/utils";

// The Task 1 stimulus. Charts follow the same rules as the rest of the app:
// thin marks, hairline recessive grid, a legend for every multi-series chart,
// selective direct labels, and a hidden table so the data is readable without
// seeing the picture.

const SERIES_COLOURS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
// Pie slices use one hue stepped light→dark: with five parts, identity comes
// from the direct labels, not from telling five hues apart.
const PIE_COLOURS = ["var(--pie-1)", "var(--pie-2)", "var(--pie-3)", "var(--pie-4)", "var(--pie-5)"];

function Legend({ names, colours = SERIES_COLOURS, swatch = "line", center }: { names: string[]; colours?: string[]; swatch?: "line" | "block"; center?: boolean }) {
  return (
    <div className={cn("mb-3 flex flex-wrap gap-x-4 gap-y-1", center && "justify-center")}>
      {names.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className={swatch === "line" ? "h-0.5 w-4 rounded-full" : "size-2.5 rounded-[2px]"} style={{ background: colours[i % colours.length] }} />
          {n}
        </span>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, caption }: { columns: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineChart({ v }: { v: Extract<Visual, { kind: "line" }> }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const W = 720;
  const H = 320;
  const pad = { l: 44, r: 96, t: 16, b: 34 };
  const max = Math.ceil(Math.max(...v.points.flatMap((p) => p.values)) / 20) * 20;
  const x = (i: number) => pad.l + (i / (v.points.length - 1)) * (W - pad.l - pad.r);
  const y = (val: number) => pad.t + (1 - val / max) * (H - pad.t - pad.b);
  const ticks = useMemo(() => Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i)), [max]);

  // Direct end labels only work when they don't overlap: nudge them apart,
  // keeping each label next to its own line.
  const endLabels = useMemo(() => {
    const last = v.points[v.points.length - 1];
    const placed = v.series
      .map((name, s) => ({ name, value: last.values[s], colour: SERIES_COLOURS[s % SERIES_COLOURS.length], y: y(last.values[s]) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].y - placed[i - 1].y < 15) placed[i].y = placed[i - 1].y + 15;
    }
    return placed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, max]);

  return (
    <div className="relative">
      <Legend names={v.series} />
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={describeVisual(v)}
        onPointerMove={(e) => {
          const box = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          setHover(Math.min(v.points.length - 1, Math.max(0, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (v.points.length - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" className="fill-ink-3 font-mono text-[10px]">{t}</text>
          </g>
        ))}
        {v.points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 10} textAnchor="middle" className="fill-ink-3 font-mono text-[10px]">{p.label}</text>
        ))}
        {v.series.map((name, s) => {
          const d = v.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.values[s]).toFixed(1)}`).join("");
          return (
            <g key={name}>
              <path d={d} fill="none" stroke={SERIES_COLOURS[s]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {v.points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p.values[s])} r={hover === i ? 4.5 : 3} fill={SERIES_COLOURS[s]} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </g>
          );
        })}
        {endLabels.map((l) => {
          const anchorY = y(l.value);
          return (
            <g key={l.name}>
              {/* leader line so a nudged label still points at its own series */}
              <path d={`M${W - pad.r + 2},${anchorY} L${W - pad.r + 6},${l.y - 4}`} stroke={l.colour} strokeWidth={1} fill="none" opacity={0.7} />
              <text x={W - pad.r + 9} y={l.y} className="fill-ink text-[12px] font-medium">
                {l.name} {l.value}
              </text>
            </g>
          );
        })}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeWidth={1} /> : null}
      </svg>
      {hover !== null ? (
        <div className="pointer-events-none absolute top-6 rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-xs shadow-pop" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="text-ink-3">{v.points[hover].label}</div>
          {v.series.map((n, i) => (
            <div key={n} className="flex justify-between gap-3">
              <span className="text-ink-2">{n}</span>
              <span className="font-semibold text-ink">{v.points[hover].values[i]}</span>
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-center text-xs text-ink-3">{v.unit}</p>
      <DataTable columns={["Year", ...v.series]} rows={v.points.map((p) => [p.label, ...p.values])} caption={`Data: ${v.unit}`} />
    </div>
  );
}

function BarChart({ v }: { v: Extract<Visual, { kind: "bar" }> }) {
  const max = Math.ceil(Math.max(...v.points.flatMap((p) => p.values)) / 100) * 100;
  return (
    <div>
      <Legend names={v.series} />
      <div className="space-y-3">
        {v.points.map((p) => (
          <div key={p.label} className="grid grid-cols-[92px_1fr] items-center gap-3">
            <span className="truncate text-xs text-ink-2">{p.label}</span>
            <div className="space-y-[3px]">
              {p.values.map((val, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3.5 rounded-r-[4px]" style={{ width: `${(val / max) * 100}%`, background: SERIES_COLOURS[i] }} title={`${v.series[i]}: ${val}`} />
                  <span className="font-mono text-[11px] tabular-nums text-ink-2">{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">{v.unit}</p>
      <DataTable columns={["Category", ...v.series]} rows={v.points.map((p) => [p.label, ...p.values])} caption={`Data: ${v.unit}`} />
    </div>
  );
}

function TableVisual({ v }: { v: Extract<Visual, { kind: "table" }> }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong">
            {v.columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {r.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2 text-ink", j > 0 && "font-mono tabular-nums")}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/**
 * Two pies side by side — the usual Task 1 "compare these proportions" shape.
 * Every slice is labelled with its own name and share, so nobody has to tell
 * five steps of one hue apart; the ramp only groups them.
 */
function PieVisual({ v }: { v: Extract<Visual, { kind: "pie" }> }) {
  // Wide enough that a long category name ('Wind and solar 23%') never
  // runs off the left edge.
  const W = 360;
  const H = 206;
  const cx = W / 2;
  const cy = 96;
  const R = 60;

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-4">
        {v.groups.map((group) => {
          // Geometry first, then labels pushed apart within each side.
          let angle = -Math.PI / 2;
          const slices = group.slices.map((slice) => {
            const sweep = (slice.value / 100) * Math.PI * 2;
            const start = angle;
            angle += sweep;
            const mid = start + sweep / 2;
            return { ...slice, start, end: angle, sweep, mid, right: Math.cos(mid) >= 0, y: cy + (R + 8) * Math.sin(mid) };
          });
          for (const side of [true, false]) {
            const column = slices.filter((s) => s.right === side).sort((a, b) => a.y - b.y);
            for (let i = 1; i < column.length; i++) {
              if (column[i].y - column[i - 1].y < 15) column[i].y = column[i - 1].y + 15;
            }
            const overflow = (column.at(-1)?.y ?? 0) - (H - 24);
            if (overflow > 0) for (const c of column) c.y -= overflow;
          }

          return (
            <figure key={group.label} className="m-0">
              <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-[340px] max-w-full" role="img"
                aria-label={`${group.label}: ${group.slices.map((s) => `${s.label} ${s.value} percent`).join(", ")}`}>
                {slices.map((slice, i) => {
                  const p = (a: number) => `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
                  const large = slice.sweep > Math.PI ? 1 : 0;
                  const labelX = slice.right ? cx + R + 20 : cx - R - 20;
                  const elbowX = slice.right ? cx + R + 12 : cx - R - 12;
                  return (
                    <g key={slice.label}>
                      {/* 2px surface ring keeps neighbouring slices from touching */}
                      <path d={`M${cx},${cy} L${p(slice.start)} A${R},${R} 0 ${large} 1 ${p(slice.end)} Z`}
                        fill={PIE_COLOURS[i % PIE_COLOURS.length]} stroke="var(--surface)" strokeWidth={2} />
                      <polyline
                        points={`${(cx + (R + 2) * Math.cos(slice.mid)).toFixed(1)},${(cy + (R + 2) * Math.sin(slice.mid)).toFixed(1)} ${elbowX},${slice.y} ${labelX - (slice.right ? 4 : -4)},${slice.y}`}
                        fill="none" stroke="var(--axis)" strokeWidth={1}
                      />
                      <text x={labelX} y={slice.y + 3.5} textAnchor={slice.right ? "start" : "end"} className="fill-ink text-[10px]">
                        {slice.label} <tspan className="font-mono font-semibold">{slice.value}%</tspan>
                      </text>
                    </g>
                  );
                })}
              </svg>
              <figcaption className="-mt-1 text-center text-xs font-medium text-ink">{group.label}</figcaption>
            </figure>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-ink-3">{v.unit}</p>
      <DataTable
        columns={["Category", ...v.groups.map((g) => g.label)]}
        rows={v.groups[0].slices.map((s, i) => [s.label, ...v.groups.map((g) => `${g.slices[i].value}%`)])}
        caption={`Data: ${v.unit}`}
      />
    </div>
  );
}

function ProcessVisual({ v }: { v: Extract<Visual, { kind: "process" }> }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {v.steps.map((s, i) => (
        <li key={s.title} className="relative rounded-[10px] border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-bg">{i + 1}</span>
            <span className="text-sm font-semibold text-ink">{s.title}</span>
            {i < v.steps.length - 1 ? <ArrowRight className="ml-auto size-3.5 text-ink-3" /> : null}
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{s.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function TaskVisual({ visual }: { visual: Visual }) {
  return (
    <div className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
      {visual.kind === "line" ? <LineChart v={visual} /> : null}
      {visual.kind === "bar" ? <BarChart v={visual} /> : null}
      {visual.kind === "table" ? <TableVisual v={visual} /> : null}
      {visual.kind === "pie" ? <PieVisual v={visual} /> : null}
      {visual.kind === "process" ? <ProcessVisual v={visual} /> : null}
    </div>
  );
}
