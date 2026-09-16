// ============================================================
// LLM provider factory
//
// Central entry point for getting an LLM provider instance.
// Currently supports OpenAI-compatible only; add more providers
// here as needed.
// ============================================================

import type { LLMProvider, LLMConfig } from "./types";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";

function getLLMConfig(): LLMConfig {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new Error(
      "LLM configuration missing. Set LLM_API_URL, LLM_API_KEY, and LLM_MODEL in .env.local"
    );
  }

  return { apiUrl, apiKey, model };
}

/**
 * Get the configured LLM provider.
 * Add conditional logic here when supporting multiple providers.
 */
export function getLLMProvider(): LLMProvider {
  const config = getLLMConfig();
  return new OpenAICompatibleProvider(config);
}

/** Rough estimate: ~4 chars per token for English text */
const CHARS_PER_TOKEN = 4;

/** Conservative limit leaving room for system prompt + output */
const MAX_INPUT_TOKENS = 120_000;

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export { MAX_INPUT_TOKENS, CHARS_PER_TOKEN };