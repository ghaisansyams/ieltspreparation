import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import { GENERATE_SYSTEM } from "@/lib/ai/prompts";
import { GeneratedVocabSchema } from "@/lib/ai/schemas";
import { generatedToDraft } from "@/lib/ai/to-draft";
import { dictionaryDraft } from "@/lib/server/dictionary";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({ word: z.string().trim().min(1).max(60) });

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const body = await readBody(req, Body);
  if ("response" in body) return body.response;
  const { word } = body.data;

  try {
    const provider = getAiProvider();
    if (!provider) {
      const draft = await dictionaryDraft(word);
      if (!draft) {
        return json({ error: "No AI provider is configured and the public dictionary had no entry. Fill the form manually.", code: "ai_not_configured" }, 503);
      }
      return json({ source: "dictionary", draft });
    }
    const generated = await provider.generateObject({
      system: GENERATE_SYSTEM,
      prompt: `Create a complete vocabulary entry for: "${word}"`,
      schema: GeneratedVocabSchema,
      schemaName: "vocabulary entry",
      effort: "medium",
    });
    return json({ source: "ai", provider: provider.name, draft: generatedToDraft(generated) });
  } catch (error) {
    return errorResponse(error);
  }
}
