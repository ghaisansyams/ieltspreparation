// Endless Task 1 practice: a seeded generator that builds a fresh stimulus —
// line graph, bar chart, table, pie charts or a process diagram — with numbers
// that behave like real data (trends, peaks, dips) rather than noise.
//
// The seed lives in the task id (`t1-rand-<seed>`), so the same chart can be
// reopened, re-marked and matched with its saved draft.

import type { SeriesPoint, Visual, WritingTask } from "./tasks";

const T1_RUBRIC = "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
const PROCESS_RUBRIC = "Summarise the information by selecting and reporting the main features.";

/** mulberry32 — small, fast, and stable across machines. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)];
}
function pickMany<T>(r: () => number, xs: readonly T[], n: number): T[] {
  const pool = [...xs];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(...pool.splice(Math.floor(r() * pool.length), 1));
  return out;
}
function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}

const COUNTRIES = ["Indonesia", "Japan", "Brazil", "Canada", "Germany", "Nigeria", "Australia", "Spain", "India", "Mexico"] as const;
const CITIES = ["Riverton", "Ashford", "Newport", "Kingsley", "Marlow"] as const;
const AGE_GROUPS = ["18–29", "30–49", "50–64"] as const;

type Shape = "rise" | "fall" | "peak" | "dip" | "flat";

/** A plausible series: one overall movement plus small year-to-year wobble. */
function series(r: () => number, shape: Shape, min: number, max: number, steps: number, decimals = 0): number[] {
  const lo = between(r, min, min + (max - min) * 0.3);
  const hi = between(r, lo + (max - lo) * 0.45, max);
  const at = (t: number) => {
    switch (shape) {
      case "rise":
        return lo + (hi - lo) * Math.pow(t, between(r, 0.7, 1.4));
      case "fall":
        return hi - (hi - lo) * Math.pow(t, between(r, 0.7, 1.4));
      case "peak":
        return lo + (hi - lo) * Math.sin(t * Math.PI);
      case "dip":
        return hi - (hi - lo) * Math.sin(t * Math.PI);
      default:
        return (lo + hi) / 2;
    }
  };
  const span = max - min;
  return Array.from({ length: steps }, (_, i) => {
    const v = at(i / (steps - 1)) + between(r, -span * 0.04, span * 0.04);
    const clamped = Math.min(max, Math.max(min, v));
    const f = Math.pow(10, decimals);
    return Math.round(clamped * f) / f;
  });
}

function toPoints(labels: string[], columns: number[][]): SeriesPoint[] {
  return labels.map((label, i) => ({ label, values: columns.map((c) => c[i]) }));
}

const LINE_TOPICS = [
  { subject: "the percentage of households with internet access", unit: "% of households", min: 4, max: 97, group: "country" },
  { subject: "the proportion of electricity generated from renewable sources", unit: "% of electricity generated", min: 3, max: 72, group: "country" },
  { subject: "the number of cars owned per 1,000 people", unit: "cars per 1,000 people", min: 40, max: 640, group: "country" },
  { subject: "average annual coffee consumption per person", unit: "kg per person per year", min: 0.4, max: 9.5, group: "country", decimals: 1 },
  { subject: "the unemployment rate among three age groups", unit: "% of the age group", min: 2, max: 24, group: "age", decimals: 1 },
  { subject: "the number of international students enrolled at university", unit: "students (thousands)", min: 5, max: 210, group: "country" },
  { subject: "the average price of a litre of petrol", unit: "US cents per litre", min: 45, max: 185, group: "country" },
] as const;

const BAR_TOPICS = [
  { subject: "average monthly household spending by category", unit: "USD per month", categories: ["Housing", "Food", "Transport", "Education", "Leisure"], min: 60, max: 900, cmp: "year" },
  { subject: "the amount of household waste produced", unit: "million tonnes", categories: [...CITIES].slice(0, 4), min: 0.6, max: 8.4, cmp: "year", decimals: 1 },
  { subject: "the number of hours spent on leisure activities each week", unit: "hours per week", categories: ["Watching TV", "Sport", "Socialising", "Reading", "Gaming"], min: 1, max: 16, cmp: "gender", decimals: 1 },
  { subject: "the number of students choosing each subject", unit: "students (thousands)", categories: ["Engineering", "Medicine", "Business", "Arts", "Computing"], min: 3, max: 64, cmp: "year" },
  { subject: "the proportion of journeys made by each form of transport", unit: "% of all journeys", categories: ["Car", "Bus", "Train", "Bicycle", "Walking"], min: 3, max: 48, cmp: "year" },
] as const;

const PIE_TOPICS = [
  { subject: "how an average household spends its monthly income", unit: "% of monthly income", slices: ["Housing", "Food", "Transport", "Education", "Other"] },
  { subject: "the sources of energy used to generate electricity", unit: "% of electricity generated", slices: ["Coal", "Gas", "Nuclear", "Hydro", "Wind and solar"] },
  { subject: "the reasons people give for moving to a large city", unit: "% of respondents", slices: ["Work", "Study", "Family", "Healthcare", "Other"] },
  { subject: "the types of waste sent for recycling", unit: "% of recycled waste", slices: ["Paper", "Glass", "Plastic", "Metal", "Garden waste"] },
] as const;

const PROCESSES: { title: string; subject: string; steps: { title: string; detail: string }[] }[] = [
  {
    title: "How glass bottles are recycled",
    subject: "the process by which glass bottles are recycled",
    steps: [
      { title: "Collection", detail: "Used bottles are collected from homes and bottle banks." },
      { title: "Sorting", detail: "Glass is separated by colour and contaminants are removed." },
      { title: "Crushing", detail: "Clean glass is crushed into small pieces called cullet." },
      { title: "Melting", detail: "Cullet is melted in a furnace at around 1,400 °C." },
      { title: "Moulding", detail: "Molten glass is poured into moulds to form new bottles." },
      { title: "Distribution", detail: "New bottles are filled and returned to shops." },
    ],
  },
  {
    title: "How instant coffee is produced",
    subject: "the process by which instant coffee is produced",
    steps: [
      { title: "Harvesting", detail: "Ripe coffee cherries are picked from the plants." },
      { title: "Drying", detail: "Cherries are dried in the sun and the outer skin is removed." },
      { title: "Roasting", detail: "The green beans are roasted at about 200 °C." },
      { title: "Grinding", detail: "Roasted beans are ground into a coarse powder." },
      { title: "Brewing", detail: "Hot water passes through the grounds to make a concentrate." },
      { title: "Freeze-drying", detail: "The concentrate is frozen, broken up and dried into granules." },
      { title: "Packing", detail: "Granules are sealed in jars and sent to shops." },
    ],
  },
  {
    title: "How rainwater is treated for drinking",
    subject: "the process by which rainwater is collected and treated for drinking",
    steps: [
      { title: "Collection", detail: "Rainwater runs off rooftops into a gutter system." },
      { title: "Screening", detail: "A mesh filter removes leaves and large debris." },
      { title: "Storage", detail: "Water is held in an underground tank." },
      { title: "Filtration", detail: "It passes through sand and carbon filters." },
      { title: "Disinfection", detail: "Ultraviolet light kills remaining bacteria." },
      { title: "Supply", detail: "Clean water is pumped to taps in the house." },
    ],
  },
  {
    title: "How a hydroelectric dam produces electricity",
    subject: "the way in which a hydroelectric dam produces electricity",
    steps: [
      { title: "Reservoir", detail: "River water is held behind the dam wall." },
      { title: "Intake", detail: "A gate releases water into a large pipe called a penstock." },
      { title: "Turbine", detail: "Falling water spins the blades of a turbine." },
      { title: "Generator", detail: "The turbine drives a generator that produces electricity." },
      { title: "Transformer", detail: "Voltage is raised for long-distance transmission." },
      { title: "Outflow", detail: "Used water returns to the river downstream." },
    ],
  },
];

const SHAPES: Shape[] = ["rise", "fall", "peak", "dip", "rise", "fall"];

function yearLabels(r: () => number, count: number): { labels: string[]; first: number; last: number } {
  const step = pick(r, [5, 5, 10, 2]);
  const last = 2025 - Math.floor(r() * 3) * 5;
  const first = last - step * (count - 1);
  return { labels: Array.from({ length: count }, (_, i) => String(first + i * step)), first, last };
}

function makeLine(r: () => number): { visual: Visual; prompt: string; title: string; tags: string[] } {
  const topic = pick(r, LINE_TOPICS);
  const names = topic.group === "age" ? [...AGE_GROUPS] : pickMany(r, COUNTRIES, 3);
  const { labels, first, last } = yearLabels(r, pick(r, [5, 5, 6]));
  const decimals = "decimals" in topic ? topic.decimals : 0;
  const columns = names.map(() => series(r, pick(r, SHAPES), topic.min, topic.max, labels.length, decimals));
  return {
    title: topic.subject.replace(/^the /, "").replace(/^average /, "Average ").slice(0, 60),
    prompt: `The line graph below shows ${topic.subject} in ${topic.group === "age" ? "one country" : "three countries"} between ${first} and ${last}.`,
    tags: ["data", "trends"],
    visual: { kind: "line", unit: topic.unit, series: names, points: toPoints(labels, columns) },
  };
}

function makeBar(r: () => number): { visual: Visual; prompt: string; title: string; tags: string[] } {
  const topic = pick(r, BAR_TOPICS);
  const decimals = "decimals" in topic ? topic.decimals : 0;
  const cmp =
    topic.cmp === "gender" ? ["Men", "Women"] : (() => {
      const { first, last } = yearLabels(r, 2);
      return [String(first), String(last)];
    })();
  const categories = [...topic.categories];
  const columns = cmp.map(() => categories.map(() => Math.round(between(r, topic.min, topic.max) * Math.pow(10, decimals)) / Math.pow(10, decimals)));
  return {
    title: topic.subject.replace(/^the /, "").slice(0, 60),
    prompt: `The bar chart below shows ${topic.subject}${topic.cmp === "gender" ? " for men and women in one country" : ` in ${cmp[0]} and ${cmp[1]}`}.`,
    tags: ["data", "comparison"],
    visual: { kind: "bar", unit: topic.unit, series: cmp, points: toPoints(categories, columns) },
  };
}

/** Percentages that actually add up to 100 — examiners check this, so we do too. */
function shares(r: () => number, n: number): number[] {
  const raw = Array.from({ length: n }, () => between(r, 6, 40));
  const total = raw.reduce((a, b) => a + b, 0);
  const rounded = raw.map((v) => Math.max(3, Math.round((v / total) * 100)));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  const biggest = rounded.indexOf(Math.max(...rounded));
  rounded[biggest] += drift;
  return rounded;
}

function makePie(r: () => number): { visual: Visual; prompt: string; title: string; tags: string[] } {
  const topic = pick(r, PIE_TOPICS);
  const byCountry = r() < 0.4;
  const groups = byCountry ? pickMany(r, COUNTRIES, 2) : (() => {
    const { first, last } = yearLabels(r, 2);
    return [String(first), String(last)];
  })();
  const slices = [...topic.slices];
  return {
    title: topic.subject.replace(/^the /, "").slice(0, 60),
    prompt: `The pie charts below show ${topic.subject} in ${groups[0]} and ${groups[1]}.`,
    tags: ["data", "proportion"],
    visual: {
      kind: "pie",
      unit: topic.unit,
      groups: groups.map((label) => ({ label, slices: shares(r, slices.length).map((value, i) => ({ label: slices[i], value })) })),
    },
  };
}

function makeTable(r: () => number): { visual: Visual; prompt: string; title: string; tags: string[] } {
  const kind = pick(r, ["museums", "regions", "digital"] as const);
  if (kind === "regions") {
    const regions = pickMany(r, CITIES, 4);
    return {
      title: "Population and income by region",
      prompt: "The table below gives information about the population, area and average income of four regions in one country.",
      tags: ["data", "society"],
      visual: {
        kind: "table",
        columns: ["Region", "Population (thousands)", "Area (km²)", "Average income (USD per year)"],
        rows: regions.map((name) => [name, Math.round(between(r, 120, 2400)), Math.round(between(r, 400, 9800)), Math.round(between(r, 6, 48)) * 1000]),
      },
    };
  }
  if (kind === "digital") {
    const names = pickMany(r, COUNTRIES, 4);
    return {
      title: "Internet use in four countries",
      prompt: "The table below shows internet use, mobile phone ownership and online shopping in four countries in one year.",
      tags: ["data", "technology"],
      visual: {
        kind: "table",
        columns: ["Country", "Internet users (% of population)", "Mobile phones per 100 people", "Shopped online in the last month (%)"],
        rows: names.map((name) => [name, Math.round(between(r, 22, 96)), Math.round(between(r, 55, 145)), Math.round(between(r, 9, 78))]),
      },
    };
  }
  const museums = pickMany(r, ["City History Museum", "National Art Gallery", "Science Centre", "Maritime Museum", "Natural History Museum"], 3);
  return {
    title: "Visitors to three museums",
    prompt: "The table below gives information about visitor numbers and ticket prices at three museums in one year.",
    tags: ["data", "travel"],
    visual: {
      kind: "table",
      columns: ["Museum", "Visitors (thousands)", "Average ticket (USD)", "Share of overseas visitors"],
      rows: museums.map((name) => [name, Math.round(between(r, 90, 1100)), Math.round(between(r, 4, 22)), `${Math.round(between(r, 8, 62))}%`]),
    },
  };
}

function makeProcess(r: () => number): { visual: Visual; prompt: string; title: string; tags: string[] } {
  const p = pick(r, PROCESSES);
  return {
    title: p.title,
    prompt: `The diagram below shows ${p.subject}.`,
    tags: ["process", "description"],
    visual: { kind: "process", steps: p.steps },
  };
}

const BUILDERS = [makeLine, makeBar, makeTable, makePie, makeProcess, makeLine, makeBar, makePie];

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

/** A complete, self-contained Task 1 question for the given seed. */
export function randomTask1(seed: number): WritingTask {
  const r = rng(seed);
  const built = pick(r, BUILDERS)(r);
  return {
    id: `t1-rand-${seed}`,
    type: "task1",
    title: built.title,
    prompt: built.prompt,
    rubric: built.visual.kind === "process" ? PROCESS_RUBRIC : T1_RUBRIC,
    tags: built.tags,
    visual: built.visual,
    generated: true,
  };
}

/** `t1-rand-123` → that exact task again. */
export function randomTaskFromId(id: string): WritingTask | undefined {
  const m = /^t1-rand-(\d+)$/.exec(id);
  return m ? randomTask1(Number(m[1])) : undefined;
}
