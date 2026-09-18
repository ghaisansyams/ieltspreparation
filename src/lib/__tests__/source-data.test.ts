import { describe, expect, it } from "vitest";
import { SOURCE_ROWS, ENRICHMENT } from "@/data/source";
import { sourceDrafts } from "@/lib/vocab/source-import";
import { examples, meanings, synonyms } from "@/lib/vocab/fields";
import { makeCloze } from "@/lib/vocab/word-forms";

describe("source vocabulary (Jay's Vocabulary PDF)", () => {
  const drafts = sourceDrafts();

  it("contains every numbered row 1–148 exactly once, in order", () => {
    expect(SOURCE_ROWS).toHaveLength(148);
    expect(SOURCE_ROWS.map((r) => r.n)).toEqual(Array.from({ length: 148 }, (_, i) => i + 1));
  });

  it("has enrichment for every row", () => {
    for (const r of SOURCE_ROWS) expect(ENRICHMENT[r.n], `row ${r.n}`).toBeDefined();
  });

  it("preserves the rich structure instead of flattening to word + meaning", () => {
    const distinct = drafts[0];
    expect(distinct.word).toBe("Distinct");
    expect(distinct.pronunciation).toBe("/dɪˈstɪŋkt/");
    expect(distinct.partOfSpeech).toBe("Adjective");
    expect(meanings(distinct)).toEqual(["Berbeda", "Jelas"]);
    expect(synonyms(distinct)).toEqual(["Different (Berbeda)", "Clear (Jelas)"]);
    expect(examples(distinct)).toHaveLength(3);
    expect(distinct.example1Translation).toMatch(/^Si kembar/);
    expect(distinct.sourceNumber).toBe(1);
  });

  it("reads CEFR written in the source and labels everything else as estimated", () => {
    const multitude = drafts.find((d) => d.word === "Multitude")!;
    expect(multitude.cefr).toBe("C1");
    expect(multitude.cefrSource).toBe("source");
    expect(multitude.aiFields).not.toContain("cefr");
    const distinct = drafts[0];
    expect(distinct.cefrSource).toBe("estimated");
    expect(distinct.aiFields).toContain("cefr");
  });

  it("flags incomplete rows as Needs Review instead of inventing data", () => {
    const flagged = drafts.filter((d) => d.needsReview).map((d) => d.sourceNumber);
    expect(flagged).toEqual(expect.arrayContaining([16, 44, 55, 67, 108, 111, 122]));
    const inconclusive = drafts.find((d) => d.sourceNumber === 111)!;
    expect(meanings(inconclusive)).toEqual([]);
    expect(examples(inconclusive)).toEqual([]);
    expect(inconclusive.pronunciation).toBe("");
  });

  it("can build a cloze from at least one example of almost every word", () => {
    const missing = drafts
      .filter((d) => examples(d).length > 0)
      .filter((d) => !examples(d).some((e) => makeCloze(e.en, d.word)))
      .map((d) => d.word);
    // Undergone → "underwent" is covered by the irregular table; the misspelt
    // headword "Potrayals" legitimately never appears in its own examples.
    expect(missing).toEqual(["Potrayals"]);
  });
});
