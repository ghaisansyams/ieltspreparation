import { z } from "zod";
import { getAiProvider, AiNotConfiguredError } from "@/lib/ai";
import { STORY_SYSTEM } from "@/lib/ai/prompts";
import { StorySchema } from "@/lib/ai/schemas";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({
  words: z.array(z.object({ word: z.string().min(1).max(80), meaning: z.string().max(300).optional() })).min(1).max(15),
  theme: z.string().max(120).optional(),
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
    const story = await provider.generateObject({
      system: STORY_SYSTEM,
      prompt: `${b.theme ? `Theme: ${b.theme}\n` : ""}Target words:\n${b.words.map((w) => `- ${w.word}${w.meaning ? ` (${w.meaning})` : ""}`).join("\n")}`,
      schema: StorySchema,
      schemaName: "story",
      effort: "low",
    });
    return json({ story });
  } catch (error) {
    return errorResponse(error);
  }
}
