// ============================================================
// OpenAI-compatible LLM provider
//
// Works with OpenAI, Groq, Together, Anyscale, and any
// provider that exposes /v1/chat/completions.
// ============================================================

import type { LLMProvider, LLMConfig } from "../types";

// ─────────────────────────────────────────────
// Retry + timeout configuration
// ─────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
// Error sanitization — strip provider internals
// ─────────────────────────────────────────────

function sanitizeError(err: unknown): Error {
  // Log the actual error for debugging — the user-facing message is generic
  console.error("[LLM] Raw error before sanitization:", err);

  if (err instanceof Error) {
    if (err.name === "AbortError") {
      return new Error(
        "The analysis is taking longer than expected. Try with a shorter document, or try again in a moment."
      );
    }
    if (err.message.startsWith("LLM API error")) {
      const statusMatch = err.message.match(/\((\d+)\)/);
      const status = statusMatch ? statusMatch[1] : "unknown";
      return new Error(
        `The analysis service returned an error (status ${status}). Please try again.`
      );
    }
    if (err.message.startsWith("LLM returned empty")) {
      return new Error(err.message);
    }
  }
  return new Error("Something went wrong during analysis. Please try again.");
}

// ─────────────────────────────────────────────
// Provider implementation
// ─────────────────────────────────────────────

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";
  private readonly config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async complete(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    responseFormat?: { type: "json_object" };
  }): Promise<string> {
    const { apiUrl, apiKey, model } = this.config;
    const {
      systemPrompt,
      userPrompt,
      temperature = 0.3,
      maxTokens = 4096,
      responseFormat,
    } = params;

    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const body: Record<string, unknown> = {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
        };
        if (responseFormat) {
          body.response_format = responseFormat;
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text();
          const err = new Error(`LLM API error (${response.status}): ${errorBody}`);

          if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
            lastError = err;
            continue;
          }

          throw sanitizeError(err);
        }

        const data = await response.json();
        const message = data.choices?.[0]?.message;
        let content = message?.content;

        // Some reasoning models (e.g., mimo-v2.5-pro) put the actual output
        // in reasoning_content when content is empty. Fall back to that.
        if (!content && message?.reasoning_content) {
          console.warn("[LLM] content field empty, falling back to reasoning_content");
          content = message.reasoning_content;
        }

        if (!content) {
          // Log what the model actually returned — helps debug reasoning models
          // that may put output in reasoning_content instead of content
          console.error(
            "[LLM] Empty content field. Raw message keys:",
            Object.keys(message ?? {}),
            "reasoning_content length:",
            message?.reasoning_content?.length ?? 0,
            "finish_reason:",
            data.choices?.[0]?.finish_reason
          );
          throw new Error("LLM returned empty response. Please try again.");
        }

        return content;
      } catch (err) {
        clearTimeout(timeout);

        if (err instanceof Error && err.name === "AbortError") {
          lastError = err;
          if (attempt < MAX_RETRIES) {
            console.warn(`[LLM] Request timed out on attempt ${attempt + 1}/${MAX_RETRIES + 1}, retrying.`);
            continue;
          }
        }

        // Already-sanitized errors (from the !content or !response.ok paths) pass through
        if (err instanceof Error && (
          err.message.startsWith("LLM returned empty") ||
          err.message.startsWith("The analysis") ||
          err.message.startsWith("Something went wrong")
        )) {
          throw err;
        }

        throw sanitizeError(err);
      }
    }

    throw sanitizeError(lastError);
  }
}