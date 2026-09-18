import "server-only";
import { AnthropicProvider } from "./anthropic";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AiProvider } from "./provider";

export * from "./provider";

// Add a vendor by implementing AiProvider and registering it here.
const registry: Record<string, AiProvider> = {
  anthropic: new AnthropicProvider(),
  "openai-compatible": new OpenAICompatibleProvider(),
};

/**
 * AI_PROVIDER set → that provider (null if it has no key, so the UI can say so).
 * AI_PROVIDER unset → the first provider that has a key.
 */
export function getAiProvider(): AiProvider | null {
  const selected = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (selected) {
    const p = registry[selected];
    return p?.isConfigured() ? p : null;
  }
  return Object.values(registry).find((p) => p.isConfigured()) ?? null;
}
