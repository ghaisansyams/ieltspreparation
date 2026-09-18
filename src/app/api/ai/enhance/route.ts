import { z } from "zod";
import { getAiProvider, AiNotConfiguredError } from "@/lib/ai";
import { ENHANCE_SYSTEM } from "@/lib/ai/prompts";
import { EnhancementSchema } from "@/lib/ai/schemas";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({
  word: z.string().min(1).max(80),
  partOfSpeech: z.string().max(60),
  meanings: z.array(z.string().max(300)).max(3),
  synonyms: z.array(z.string().max(200)).max(3),
  examples: z.array(z.string().max(500)).max(3),
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
    const enhancement = await provider.generateObject({
      system: ENHANCE_SYSTEM,
      prompt: [
        `Word: ${b.word}`,
        `Part of speech (learner's note): ${b.partOfSpeech || "—"}`,
        `Learner's meanings: ${b.meanings.join(" | ") || "—"}`,
        `Learner's synonyms: ${b.synonyms.join(" | ") || "—"}`,
        `Learner's examples:\n${b.examples.map((e) => `- ${e}`).join("\n") || "—"}`,
      ].join("\n"),
      schema: EnhancementSchema,
      schemaName: "enhancement",
      effort: "medium",
    });
    return json({ enhancement });
  } catch (error) {
    return errorResponse(error);
  }
}
