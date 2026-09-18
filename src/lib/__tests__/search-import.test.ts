import { describe, expect, it } from "vitest";
import { sourceDrafts } from "@/lib/vocab/source-import";
import { searchVocabulary, synonymMatches } from "@/lib/vocab/search";
import { draftsFromRows, draftsFromWordList, splitExampleCell } from "@/lib/import/tabular";
import { isAcceptedAnswer, findWordInSentence } from "@/lib/vocab/word-forms";
import { relationsFor } from "@/lib/vocab/relations";
import { synonymHead } from "@/lib/vocab/fields";
import type { Vocabulary } from "@/lib/types";

const library: Vocabulary[] = sourceDrafts().map((d, i) => ({
  ...d,
  id: `src-${i + 1}`,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
}));

describe("search", () => {
  it("finds words by meaning, synonym and definition — 'reduce'", () => {
    const words = searchVocabulary(library, "reduce").map((h) => h.vocab.word);
    expect(words[0]).toBe("Reduce");
    expect(words).toEqual(expect.arrayContaining(["Dwindle", "Slashing"]));
    const syn = synonymMatches(library, "reduce").map((s) => s.synonym);
    expect(syn).toEqual(expect.arrayContaining(["Decrease", "Diminish", "Lessen"]));
  });

  it("supports inline filters", () => {
    const hits = searchVocabulary(library, "cefr:c1 pos:verb");
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((h) => h.vocab.cefr === "C1" && /verb/i.test(h.vocab.partOfSpeech))).toBe(true);
  });

  it("searches Indonesian meanings", () => {
    expect(searchVocabulary(library, "enggan")[0].vocab.word).toBe("Reluctant");
  });
});

describe("word forms", () => {
  it("matches inflections without over-matching", () => {
    expect(findWordInSentence("The cake consists of flour.", "Consist")?.text).toBe("consists");
    expect(findWordInSentence("His energy dwindled as it went.", "Dwindle")?.text).toBe("dwindled");
    expect(findWordInSentence("The current price is high.", "Cure")).toBeNull();
    expect(findWordInSentence("Several events happened.", "Evenly")).toBeNull();
    expect(isAcceptedAnswer("outweighs", "Outweigh", "outweighs")).toBe("exact");
    expect(isAcceptedAnswer("outweigh", "Outweigh", "outweighs")).toBe("form");
    expect(isAcceptedAnswer("outweight", "Outweigh")).toBe(false);
  });
});

describe("relations", () => {
  it("links Distinct and Distinguish through the word family", () => {
    const distinct = library.find((v) => v.word === "Distinct")!;
    const rel = relationsFor(distinct, library);
    expect(rel.some((r) => r.label === "distinguish" && r.vocabId)).toBe(true);
    expect(rel.some((r) => r.label === "Different" && r.kind === "synonym")).toBe(true);
  });

  it("cleans synonym heads", () => {
    expect(synonymHead("Commit (to) (B2)")).toBe("Commit");
    expect(synonymHead("Emerge (muncul) [untuk menetas]")).toBe("Emerge");
  });
});

describe("tabular import", () => {
  it("maps the original sheet's headers, including duplicate Sinonim columns", () => {
    const rows = [
      ["e", "Vocab", "Pronounciation", "Type", "Means", "Means 2", "Means 3", "Sinonim", "Sinonim", "Sinonim 2", "Example", "Example 2", "Example 3"],
      ["1", "Distinct", "/dɪˈstɪŋkt/", "Adjective", "Berbeda", "Jelas", "-", "Different (Berbeda)", "Clear (Jelas)", "-",
        "The twins have distinct personalities despite looking identical.\n(Si kembar memiliki kepribadian yang berbeda.)",
        "The smell of fresh bread was distinct and filled the room.(Aroma roti segar sangat jelas dan memenuhi ruangan.)",
        "-"],
    ];
    const { drafts } = draftsFromRows(rows);
    expect(drafts).toHaveLength(1);
    const d = drafts[0];
    expect(d.sourceNumber).toBe(1);
    expect([d.meaning1, d.meaning2, d.meaning3]).toEqual(["Berbeda", "Jelas", ""]);
    expect([d.synonym1, d.synonym2, d.synonym3]).toEqual(["Different (Berbeda)", "Clear (Jelas)", ""]);
    expect(d.example1Translation).toBe("Si kembar memiliki kepribadian yang berbeda.");
    expect(d.example2).toBe("The smell of fresh bread was distinct and filled the room.");
    expect(d.example2Translation).toBe("Aroma roti segar sangat jelas dan memenuhi ruangan.");
    expect(d.needsReview).toBe(false);
  });

  it("keeps an untranslatable example intact rather than guessing a split", () => {
    expect(splitExampleCell("She is accustomed to waking up early. Dia sudah terbiasa bangun pagi.").id).toBe("");
  });

  it("parses simple word lists and marks them Needs Review", () => {
    const drafts = draftsFromWordList("ominous - tidak menyenangkan\n2. futile\n");
    expect(drafts.map((d) => d.word)).toEqual(["ominous", "futile"]);
    expect(drafts[0].meaning1).toBe("tidak menyenangkan");
    expect(drafts.every((d) => d.needsReview)).toBe(true);
  });
});
