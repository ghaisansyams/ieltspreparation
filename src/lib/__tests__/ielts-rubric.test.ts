import { describe, expect, it } from "vitest";
import { overallBand, type CriterionKey, type TaskType } from "@/lib/ielts/band";
import { band1Evaluation, isBand1Length, normaliseBands } from "@/lib/ielts/hard-rules";
import { randomTask1 } from "@/lib/ielts/random-task";
import { HARD_RULES, RUBRIC, rubricPrompt } from "@/lib/ielts/rubric";
import { describeVisual } from "@/lib/ielts/describe";

const TASKS: TaskType[] = ["task1", "task2"];
const KEYS: CriterionKey[] = ["task", "coherence", "lexical", "grammar"];

describe("official band descriptors", () => {
  it("covers bands 9 down to 1 for every criterion of both tasks", () => {
    for (const task of TASKS) {
      for (const key of KEYS) {
        const bands = RUBRIC[task][key].map((d) => d.band);
        expect(bands, `${task}/${key}`).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
        for (const d of RUBRIC[task][key]) expect(d.positive.length, `${task}/${key}/${d.band}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps the descriptors for Task Achievement and Task Response distinct", () => {
    expect(RUBRIC.task1.task[2].positive.join(" ")).toContain("overview");
    expect(RUBRIC.task2.task[2].positive.join(" ")).toContain("position");
    expect(RUBRIC.task1.task).not.toEqual(RUBRIC.task2.task);
    // Shared criteria really are shared.
    expect(RUBRIC.task1.lexical).toBe(RUBRIC.task2.lexical);
  });

  it("marks the limiting (negative) features so the prompt can cap a band", () => {
    const limiting = RUBRIC.task2.task.find((d) => d.band === 5)?.limiting ?? [];
    expect(limiting.join(" ")).toContain("incompletely addressed");
    const prompt = rubricPrompt("task2");
    expect(prompt).toContain("TASK RESPONSE");
    expect(prompt).toContain("LIMITING (caps the band)");
    expect(rubricPrompt("task1")).toContain("TASK ACHIEVEMENT");
    for (const name of ["COHERENCE AND COHESION", "LEXICAL RESOURCE", "GRAMMATICAL RANGE AND ACCURACY"]) {
      expect(prompt).toContain(name);
    }
  });
});

describe("rules applied in code, not by the model", () => {
  it("rates 20 words or fewer at band 1", () => {
    expect(HARD_RULES.band1MaxWords).toBe(20);
    expect(isBand1Length(20)).toBe(true);
    expect(isBand1Length(21)).toBe(false);
    expect(isBand1Length(0)).toBe(false);

    const evaluation = band1Evaluation("task2", 14);
    expect(evaluation.criteria.task.band).toBe(1);
    expect(overallBand({ task: 1, coherence: 1, lexical: 1, grammar: 1 })).toBe(1);
    expect(evaluation.overallComment).toContain("20 words or fewer");
    expect(evaluation.criteria.task.summary).toContain("14 words");
  });

  it("clamps whatever the model returns to legal half bands", () => {
    const raw = band1Evaluation("task1", 10);
    const tampered = {
      ...raw,
      criteria: {
        task: { ...raw.criteria.task, band: 11 },
        coherence: { ...raw.criteria.coherence, band: -3 },
        lexical: { ...raw.criteria.lexical, band: 6.3 },
        grammar: { ...raw.criteria.grammar, band: 6.8 },
      },
    };
    const fixed = normaliseBands(tampered);
    expect(fixed.criteria.task.band).toBe(9);
    expect(fixed.criteria.coherence.band).toBe(0);
    expect(fixed.criteria.lexical.band).toBe(6.5);
    expect(fixed.criteria.grammar.band).toBe(7);
  });
});

describe("random Task 1 stimuli", () => {
  it("is reproducible from its seed and readable as text", () => {
    const a = randomTask1(12345);
    const b = randomTask1(12345);
    expect(a).toEqual(b);
    expect(a.id).toBe("t1-rand-12345");
    expect(a.type).toBe("task1");
    expect(a.prompt.length).toBeGreaterThan(30);
    expect(a.visual).toBeTruthy();
    expect(describeVisual(a.visual!).length).toBeGreaterThan(20);
  });

  it("produces every stimulus type across seeds, with usable data", () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const task = randomTask1(seed);
      const v = task.visual!;
      kinds.add(v.kind);
      expect(task.prompt).not.toContain("undefined");
      if (v.kind === "line" || v.kind === "bar") {
        expect(v.series.length).toBeGreaterThanOrEqual(2);
        for (const p of v.points) {
          expect(p.values).toHaveLength(v.series.length);
          for (const n of p.values) expect(Number.isFinite(n)).toBe(true);
        }
      }
      if (v.kind === "pie") {
        for (const g of v.groups) {
          // Examiners check that proportions add up; so does the generator.
          expect(g.slices.reduce((a, s) => a + s.value, 0)).toBe(100);
        }
      }
      if (v.kind === "table") expect(v.rows.every((r) => r.length === v.columns.length)).toBe(true);
    }
    expect([...kinds].sort()).toEqual(["bar", "line", "pie", "process", "table"]);
  });
});
