import { z } from "zod";
import { getAiProvider, AiNotConfiguredError } from "@/lib/ai";
import { CONTEXTS_SYSTEM } from "@/lib/ai/prompts";
import { ContextsSchema } from "@/lib/ai/schemas";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({
  word: z.string().min(1).max(80),
  partOfSpeech: z.string().max(60),
  meanings: z.array(z.string().max(300)).max(3),
});

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const body = await readBody(req, Body);
  if ("response" in body) return body.response;
  try {
    const provider = getAiProvider();
    if (!provider) throw new AiNotConfiguredError();
    const b = body.data;
    const result = await provider.generateObject({
      system: CONTEXTS_SYSTEM,
      prompt: `Word: ${b.word}\nPart of speech: ${b.partOfSpeech || "—"}\nLearner's meanings: ${b.meanings.join(" | ") || "—"}`,
      schema: ContextsSchema,
      schemaName: "usage contexts",
      effort: "low",
    });
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
