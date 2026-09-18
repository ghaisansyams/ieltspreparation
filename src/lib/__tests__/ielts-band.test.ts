import { describe, expect, it } from "vitest";
import { countWords, criteria, lengthPenalty, overallBand, toHalfBand } from "@/lib/ielts/band";

describe("IELTS band scoring", () => {
  it("uses the official criteria names per task", () => {
    expect(criteria("task1").map((c) => c.abbr)).toEqual(["TA", "CC", "LR", "GRA"]);
    expect(criteria("task2")[0].name).toBe("Task Response");
    expect(criteria("task1")[0].name).toBe("Task Achievement");
  });

  it("averages the four criteria and rounds to the nearest half band", () => {
    // 6+6+6+6 = 6.0
    expect(overallBand({ task: 6, coherence: 6, lexical: 6, grammar: 6 })).toBe(6);
    // 7+6+6+6 = 6.25 → rounds up to 6.5
    expect(overallBand({ task: 7, coherence: 6, lexical: 6, grammar: 6 })).toBe(6.5);
    // 7+7+7+6 = 6.75 → rounds up to 7
    expect(overallBand({ task: 7, coherence: 7, lexical: 7, grammar: 6 })).toBe(7);
    // 6.5+6+6+6 = 6.125 → nearest half is 6.0
    expect(overallBand({ task: 6.5, coherence: 6, lexical: 6, grammar: 6 })).toBe(6);
    // 6.5+6.5+6.5+6 = 6.375 → nearest half is 6.5
    expect(overallBand({ task: 6.5, coherence: 6.5, lexical: 6.5, grammar: 6 })).toBe(6.5);
    // 8+7.5+7+7 = 7.375 → 7.5
    expect(overallBand({ task: 8, coherence: 7.5, lexical: 7, grammar: 7 })).toBe(7.5);
  });

  it("keeps bands inside 0–9 in half steps", () => {
    expect(toHalfBand(9.7)).toBe(9);
    expect(toHalfBand(-2)).toBe(0);
    expect(toHalfBand(6.3)).toBe(6.5);
    expect(toHalfBand(6.2)).toBe(6);
  });

  it("counts words the way IELTS does", () => {
    expect(countWords("The chart shows well-being in 2020.")).toBe(6);
    expect(countWords("  ")).toBe(0);
    expect(countWords("Don't — really, don't!")).toBe(3);
  });

  it("flags responses under the word limit", () => {
    expect(lengthPenalty("task2", 200)).toMatchObject({ under: true, missing: 50 });
    expect(lengthPenalty("task2", 260).under).toBe(false);
    expect(lengthPenalty("task1", 120).note).toContain("Task Achievement");
    expect(lengthPenalty("task2", 120).note).toContain("Task Response");
  });
});
