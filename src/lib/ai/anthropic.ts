import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiNotConfiguredError, AiOutputError, type AiProvider, type ObjectRequest, type TextStreamRequest } from "./provider";

// Claude via the official SDK.
// - Structured outputs (output_config.format) guarantee schema-shaped JSON.
// - Streaming + finalMessage() avoids HTTP timeouts on long extractions.
// - Server-side fallbacks ("default") re-run a declined request on Anthropic's
//   recommended fallback model instead of failing the user's action.
// - Stable instructions carry cache_control so repeated calls reuse the prefix.

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  get model(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5";
  }

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
  }

  private client(): Anthropic {
    if (!this.isConfigured()) throw new AiNotConfiguredError();
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...(req.images ?? []).map(
        (img): Anthropic.Beta.BetaImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.data },
        }),
      ),
      { type: "text", text: req.prompt },
    ];
    const stream = this.client().beta.messages.stream({
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: req.effort ?? "medium", format: betaZodOutputFormat(req.schema) },
      messages: [{ role: "user", content }],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new AiOutputError("The AI declined this request.");
    }
    if (message.stop_reason === "max_tokens") {
      throw new AiOutputError("The AI response was cut off before it finished. Try a smaller input.");
    }
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiOutputError("The AI returned malformed JSON.");
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) throw new AiOutputError(`The AI response did not match the expected shape (${req.schemaName}).`);
    return parsed.data;
  }

  async *streamText(req: TextStreamRequest): AsyncIterable<string> {
    const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: req.system }];
    if (req.context) system.push({ type: "text", text: req.context, cache_control: { type: "ephemeral" } });

    const stream = this.client().beta.messages.stream({
      model: this.model,
      max_tokens: req.maxTokens ?? 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system,
      output_config: { effort: req.effort ?? "medium" },
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\n_I can't help with that request._";
    }
  }
}
