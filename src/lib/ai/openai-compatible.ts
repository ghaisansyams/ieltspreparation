import "server-only";
import { z } from "zod";
import { AiNotConfiguredError, AiOutputError, type AiProvider, type ObjectRequest, type TextStreamRequest } from "./provider";

// Any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, Groq,
// Ollama, …). Uses JSON mode with the schema described in the prompt — the
// broadest-compatible option — and validates the result with the same Zod
// schema as every other provider.

export class OpenAICompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";

  get model(): string {
    return process.env.OPENAI_COMPATIBLE_MODEL?.trim() || "gpt-4o-mini";
  }
  private get baseUrl(): string {
    return (process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  }
  private get apiKey(): string {
    return process.env.OPENAI_COMPATIBLE_API_KEY?.trim() ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async post(body: Record<string, unknown>): Promise<Response> {
    if (!this.isConfigured()) throw new AiNotConfiguredError();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, ...body }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AiOutputError(`AI request failed (${res.status}). ${detail.slice(0, 200)}`);
    }
    return res;
  }

  async generateObject<T>(req: ObjectRequest<T>): Promise<T> {
    const schema = JSON.stringify(z.toJSONSchema(req.schema));
    const res = await this.post({
      temperature: 0.3,
      max_tokens: req.maxTokens ?? 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${req.system}\n\nRespond with ONLY one JSON object (no prose, no code fences) that conforms to this JSON Schema:\n${schema}` },
        {
          role: "user",
          content: req.images?.length
            ? [
                ...req.images.map((img) => ({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
                { type: "text", text: req.prompt },
              ]
            : req.prompt,
        },
      ],
    });
    const data = (await res.json()) as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new AiOutputError("The AI response was cut off before it finished.");
    const raw = choice?.message?.content ?? "";
    let json: unknown;
    try {
      json = JSON.parse(extractJson(raw));
    } catch {
      throw new AiOutputError("The AI returned malformed JSON.");
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) throw new AiOutputError(`The AI response did not match the expected shape (${req.schemaName}).`);
    return parsed.data;
  }

  async *streamText(req: TextStreamRequest): AsyncIterable<string> {
    const res = await this.post({
      stream: true,
      temperature: 0.5,
      max_tokens: req.maxTokens ?? 4000,
      messages: [
        { role: "system", content: req.context ? `${req.system}\n\n${req.context}` : req.system },
        ...req.messages,
      ],
    });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const delta = (JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Partial or keep-alive line — ignore.
        }
      }
    }
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
}
