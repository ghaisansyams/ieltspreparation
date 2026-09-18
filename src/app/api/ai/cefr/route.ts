import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { CEFR_SYSTEM } from "@/lib/ai/prompts";
import { CefrBatchSchema } from "@/lib/ai/schemas";
import { estimateCefrHeuristic } from "@/lib/cefr";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({
  words: z.array(z.object({ word: z.string().min(1).max(80), partOfSpeech: z.string().max(60).optional(), meaning: z.string().max(300).optional() })).min(1).max(100),
});

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const body = await readBody(req, Body);
  if ("response" in body) return body.response;
  try {
    const provider = getAiProvider();
    if (!provider) {
      return json({
        source: "heuristic",
        items: body.data.words.map((w) => ({ word: w.word, cefr: estimateCefrHeuristic(w.word), confidence: "low" })),
      });
    }
    const result = await provider.generateObject({
      system: CEFR_SYSTEM,
      prompt: body.data.words.map((w) => `- ${w.word}${w.partOfSpeech ? ` (${w.partOfSpeech})` : ""}${w.meaning ? ` — ${w.meaning}` : ""}`).join("\n"),
      schema: CefrBatchSchema,
      schemaName: "cefr estimates",
      effort: "low",
    });
    return json({ source: "ai", items: result.items });
  } catch (error) {
    return errorResponse(error);
  }
}
