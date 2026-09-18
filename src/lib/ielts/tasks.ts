// Practice tasks in the shape of IELTS Academic Writing.
// The data and questions are invented for this app; only the standard rubric
// wording follows the real test so the practice feels authentic.

import type { TaskType } from "./band";

export interface SeriesPoint {
  label: string;
  values: number[];
}

export interface PieSlice {
  label: string;
  /** Percentage of the whole; slices in a group add up to 100. */
  value: number;
}

export type Visual =
  | { kind: "line"; unit: string; series: string[]; points: SeriesPoint[] }
  | { kind: "bar"; unit: string; series: string[]; points: SeriesPoint[] }
  | { kind: "table"; columns: string[]; rows: (string | number)[][]; unit?: string }
  | { kind: "pie"; unit: string; groups: { label: string; slices: PieSlice[] }[] }
  | { kind: "process"; steps: { title: string; detail: string }[] };

export interface WritingTask {
  id: string;
  type: TaskType;
  /** Short label for the picker. */
  title: string;
  /** The question as the candidate reads it. */
  prompt: string;
  rubric: string;
  visual?: Visual;
  /** Vocabulary themes this task rewards — used to suggest words from the library. */
  tags: string[];
  /** Built by the random generator rather than written by hand. */
  generated?: boolean;
}

const T1_RUBRIC = "Summarise the information by selecting and reporting the main features, and make comparisons where relevant.";
const T2_RUBRIC = "Give reasons for your answer and include any relevant examples from your own knowledge or experience.";

export const TASK1: WritingTask[] = [
  {
    id: "t1-internet",
    type: "task1",
    title: "Households with internet access",
    prompt: "The line graph below shows the percentage of households with internet access in three countries between 2005 and 2025.",
    rubric: T1_RUBRIC,
    tags: ["data", "technology"],
    visual: {
      kind: "line",
      unit: "% of households",
      series: ["Indonesia", "Japan", "Brazil"],
      points: [
        { label: "2005", values: [6, 57, 13] },
        { label: "2010", values: [12, 78, 27] },
        { label: "2015", values: [31, 91, 51] },
        { label: "2020", values: [62, 94, 71] },
        { label: "2025", values: [84, 96, 82] },
      ],
    },
  },
  {
    id: "t1-spending",
    type: "task1",
    title: "Household spending by category",
    prompt: "The bar chart below shows average monthly household spending in one city, by category, in 2015 and 2025.",
    rubric: T1_RUBRIC,
    tags: ["data", "economy"],
    visual: {
      kind: "bar",
      unit: "USD per month",
      series: ["2015", "2025"],
      points: [
        { label: "Housing", values: [420, 610] },
        { label: "Food", values: [310, 395] },
        { label: "Transport", values: [180, 150] },
        { label: "Education", values: [90, 165] },
        { label: "Leisure", values: [120, 140] },
      ],
    },
  },
  {
    id: "t1-museums",
    type: "task1",
    title: "Visitors to three museums",
    prompt: "The table below gives information about visitor numbers and average ticket prices at three museums in 2023.",
    rubric: T1_RUBRIC,
    tags: ["data", "travel"],
    visual: {
      kind: "table",
      columns: ["Museum", "Visitors (thousands)", "Average ticket (USD)", "Share of overseas visitors"],
      rows: [
        ["City History Museum", 412, 8, "24%"],
        ["National Art Gallery", 968, 15, "51%"],
        ["Science Centre", 745, 12, "18%"],
      ],
    },
  },
  {
    id: "t1-recycling",
    type: "task1",
    title: "How glass bottles are recycled",
    prompt: "The diagram below shows the process by which glass bottles are recycled.",
    rubric: "Summarise the information by selecting and reporting the main features.",
    tags: ["process", "environment"],
    visual: {
      kind: "process",
      steps: [
        { title: "Collection", detail: "Used bottles are collected from homes and bottle banks." },
        { title: "Sorting", detail: "Glass is separated by colour and contaminants are removed." },
        { title: "Crushing", detail: "Clean glass is crushed into small pieces called cullet." },
        { title: "Melting", detail: "Cullet is melted in a furnace at around 1,400 °C." },
        { title: "Moulding", detail: "Molten glass is poured into moulds to form new bottles." },
        { title: "Distribution", detail: "New bottles are filled and returned to shops." },
      ],
    },
  },
];

export const TASK2: WritingTask[] = [
  {
    id: "t2-technology-education",
    type: "task2",
    title: "Technology in education",
    prompt: "Some people believe that technology has made learning easier and more effective, while others argue that it distracts students and weakens basic skills. Discuss both views and give your own opinion.",
    rubric: T2_RUBRIC,
    tags: ["education", "technology"],
  },
  {
    id: "t2-remote-work",
    type: "task2",
    title: "Working from home",
    prompt: "In many countries, more people now work from home. Do the advantages of this development outweigh the disadvantages?",
    rubric: T2_RUBRIC,
    tags: ["work", "society"],
  },
  {
    id: "t2-city-transport",
    type: "task2",
    title: "Traffic in cities",
    prompt: "Traffic congestion is becoming a serious problem in many large cities. What are the causes of this problem, and what measures could governments take to solve it?",
    rubric: T2_RUBRIC,
    tags: ["urban", "government"],
  },
  {
    id: "t2-social-media",
    type: "task2",
    title: "Social media and young people",
    prompt: "Some people think social media has a mainly negative effect on young people's confidence and relationships. To what extent do you agree or disagree?",
    rubric: T2_RUBRIC,
    tags: ["media", "society"],
  },
  {
    id: "t2-environment-cost",
    type: "task2",
    title: "Cost of protecting the environment",
    prompt: "Governments should spend money on protecting the environment even when this slows economic growth. To what extent do you agree or disagree?",
    rubric: T2_RUBRIC,
    tags: ["environment", "economy"],
  },
  {
    id: "t2-language-learning",
    type: "task2",
    title: "Learning foreign languages",
    prompt: "Some people argue that children should start learning a foreign language in primary school, while others believe it is better to wait until secondary school. Discuss both views and give your own opinion.",
    rubric: T2_RUBRIC,
    tags: ["education", "language"],
  },
  {
    id: "t2-public-health",
    type: "task2",
    title: "Preventing illness",
    prompt: "Many health problems could be prevented rather than treated. Why do people still focus on treatment, and what could be done to encourage prevention?",
    rubric: T2_RUBRIC,
    tags: ["health", "government"],
  },
  {
    id: "t2-tourism",
    type: "task2",
    title: "Mass tourism",
    prompt: "Mass tourism brings money to local communities, but it can also damage historic places and the environment. Do the benefits outweigh the drawbacks?",
    rubric: T2_RUBRIC,
    tags: ["travel", "environment"],
  },
];

export const ALL_TASKS = [...TASK1, ...TASK2];

export function tasksFor(type: TaskType): WritingTask[] {
  return type === "task1" ? TASK1 : TASK2;
}

export function taskById(id: string): WritingTask | undefined {
  return ALL_TASKS.find((t) => t.id === id);
}
