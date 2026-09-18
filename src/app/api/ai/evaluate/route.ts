import { z } from "zod";
import { getAiProvider, AiNotConfiguredError } from "@/lib/ai";
import { EVALUATE_SYSTEM } from "@/lib/ai/prompts";
import { EvaluationSchema } from "@/lib/ai/schemas";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 60;

const Body = z.object({
  word: z.string().min(1).max(80),
  meaning: z.string().max(400).optional(),
  task: z.string().max(600),
  category: z.string().max(40),
  sentence: z.string().trim().min(3).max(1200),
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
    const evaluation = await provider.generateObject({
      system: EVALUATE_SYSTEM,
      prompt: [
        `IELTS focus: ${b.category}`,
        `Task: ${b.task}`,
        `Target word: ${b.word}${b.meaning ? ` (learner's meaning: ${b.meaning})` : ""}`,
        `Learner's sentence: """${b.sentence}"""`,
      ].join("\n"),
      schema: EvaluationSchema,
      schemaName: "evaluation",
      effort: "medium",
    });
    return json({ evaluation });
  } catch (error) {
    return errorResponse(error);
  }
}
