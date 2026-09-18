import { z } from "zod";
import { AiNotConfiguredError, getAiProvider } from "@/lib/ai";
import { writingSystem } from "@/lib/ai/prompts";
import { WritingEvaluationSchema } from "@/lib/ai/schemas";
import { countWords, MIN_WORDS } from "@/lib/ielts/band";
import { band1Evaluation, isBand1Length, normaliseBands } from "@/lib/ielts/hard-rules";
import { errorResponse, guard, json, readBody } from "@/lib/server/http";

export const maxDuration = 120;

/** ~3.5 MB of base64 ≈ a 2.6 MB image; the client downscales well below this. */
const MAX_IMAGE_CHARS = 3_500_000;

const Body = z.object({
  taskType: z.enum(["task1", "task2"]),
  prompt: z.string().max(1200),
  rubric: z.string().max(400),
  /** Text description of the chart/table/process a Task 1 answer must report. */
  visual: z.string().max(4000).optional(),
  /** The learner's own Task 1 stimulus, for the model to read directly. */
  image: z
    .object({
      mediaType: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
      data: z.string().max(MAX_IMAGE_CHARS),
    })
    .optional(),
  response: z.string().trim().min(1).max(12000),
  /** Words from the learner's library, so the examiner can comment on their use. */
  targetWords: z.array(z.string().max(80)).max(200).optional(),
});

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const body = await readBody(req, Body);
  if ("response" in body) return body.response;

  const b = body.data;
  const words = countWords(b.response);

  // The descriptors settle this one without a model: 20 words or fewer = band 1.
  if (isBand1Length(words)) return json({ evaluation: band1Evaluation(b.taskType, words), words });

  try {
    const provider = getAiProvider();
    if (!provider) throw new AiNotConfiguredError();
    const min = MIN_WORDS[b.taskType];

    const evaluation = await provider.generateObject({
      system: writingSystem(b.taskType, { fromImage: !!b.image }),
      images: b.image ? [{ mediaType: b.image.mediaType, data: b.image.data }] : undefined,
      prompt: [
        `TASK TYPE: ${b.taskType === "task1" ? "Academic Writing Task 1" : "Academic Writing Task 2"} (minimum ${min} words)`,
        `QUESTION: ${b.prompt}`,
        `RUBRIC: ${b.rubric}`,
        b.image ? "THE STIMULUS IS THE ATTACHED IMAGE. Read it yourself and judge the report against it." : "",
        b.visual ? `WHAT THE VISUAL SHOWS (the candidate saw this as a chart/table/diagram):\n${b.visual}` : "",
        `WORD COUNT: ${words}${words < min ? ` — UNDER the ${min}-word minimum by ${min - words}` : ""}`,
        b.targetWords?.length ? `THE LEARNER'S SAVED VOCABULARY (comment only on those they actually used): ${b.targetWords.join(", ")}` : "",
        `CANDIDATE'S RESPONSE:\n"""\n${b.response}\n"""`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      schema: WritingEvaluationSchema,
      schemaName: "writing evaluation",
      effort: "high",
      maxTokens: 16000,
    });

    return json({ evaluation: normaliseBands(evaluation), words });
  } catch (error) {
    return errorResponse(error);
  }
}
