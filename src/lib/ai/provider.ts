import "server-only";
import type { z } from "zod";

// Provider-agnostic AI layer. Route handlers depend ONLY on this interface,
// so Claude can be swapped for another vendor without touching features.

export type Effort = "low" | "medium" | "high";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** An image the model should look at, base64-encoded (no data: prefix). */
export interface ImageInput {
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
}

export interface ObjectRequest<T> {
  /** Stable instructions — cached where the provider supports it. */
  system: string;
  prompt: string;
  /** Sent before the prompt text, so the model reads the picture then the task. */
  images?: ImageInput[];
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  effort?: Effort;
}

export interface TextStreamRequest {
  system: string;
  /** Large, stable context (e.g. the vocabulary index), cached separately. */
  context?: string;
  messages: ChatTurn[];
  maxTokens?: number;
  effort?: Effort;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  isConfigured(): boolean;
  generateObject<T>(req: ObjectRequest<T>): Promise<T>;
  streamText(req: TextStreamRequest): AsyncIterable<string>;
}

export class AiNotConfiguredError extends Error {
  constructor(message = "No AI provider is configured. Add ANTHROPIC_API_KEY (or an OpenAI-compatible key) to .env.local.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputError";
  }
}
