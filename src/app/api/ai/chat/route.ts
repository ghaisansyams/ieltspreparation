import { z } from "zod";
import { getAiProvider, AiNotConfiguredError } from "@/lib/ai";
import { TUTOR_SYSTEM } from "@/lib/ai/prompts";
import { errorResponse, guard, readBody } from "@/lib/server/http";

export const maxDuration = 120;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).min(1).max(30),
  /** Compact index of the learner's library, one word per line. */
  vocabulary: z.string().max(400_000),
  today: z.string().max(20),
});

export async function POST(req: Request) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const body = await readBody(req, Body);
  if ("response" in body) return body.response;

  try {
    const provider = getAiProvider();
    if (!provider) throw new AiNotConfiguredError();
    const { messages, vocabulary, today } = body.data;
    // Keep the conversation strictly alternating and starting with the user.
    const turns = messages.slice(messages.findIndex((m) => m.role === "user"));

    const iterator = provider.streamText({
      system: TUTOR_SYSTEM,
      context: `THE LEARNER'S VOCABULARY (word | type | estimated CEFR | meanings | synonyms | added on):\n${vocabulary}`,
      messages: [
        ...turns.slice(0, -1),
        { role: "user", content: `(Today is ${today}.)\n\n${turns[turns.length - 1].content}` },
      ],
      maxTokens: 6000,
      effort: "medium",
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of iterator) controller.enqueue(encoder.encode(chunk));
        } catch (error) {
          console.error("[chat]", error);
          controller.enqueue(encoder.encode("\n\n_The tutor was interrupted. Please try again._"));
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
