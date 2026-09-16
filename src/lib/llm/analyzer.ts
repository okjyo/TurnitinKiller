// ============================================================
// LLM Analysis Engine
//
// This is the SINGLE file to edit when swapping LLM providers.
// Current implementation: OpenAI-compatible API (works with
// OpenAI, Anthropic via proxy, Groq, Together, etc.)
//
// The prompt templates live in ./prompts.ts — edit those to
// tune the analysis behavior without touching provider code.
// ============================================================

import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import type { AnalysisInput, LLMAnalysisResponse, RawLLMFinding } from "./types";
import type { Finding, FindingCategory, ReportData } from "@/lib/types";

// ─────────────────────────────────────────────
// Provider configuration (swap this section for a different provider)
// ─────────────────────────────────────────────

interface LLMConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

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

// ─────────────────────────────────────────────
// Input length estimation
// ─────────────────────────────────────────────

/** Rough estimate: ~4 chars per token for English text */
const CHARS_PER_TOKEN = 4;

/** Conservative limit leaving room for system prompt + output */
const MAX_INPUT_TOKENS = 120_000;

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─────────────────────────────────────────────
// Error sanitization — strip provider internals before
// surfacing to the client
// ─────────────────────────────────────────────

function sanitizeError(err: unknown): Error {
  if (err instanceof Error) {
    // Timeout
    if (err.name === "AbortError") {
      return new Error(
        "The analysis is taking longer than expected. Try with a shorter document, or try again in a moment."
      );
    }
    // Already user-friendly messages from our own code
    if (
      err.message.startsWith("LLM configuration") ||
      err.message.startsWith("LLM returned empty") ||
      err.message.startsWith("Could not parse") ||
      err.message.startsWith("LLM response missing") ||
      err.message.startsWith("Document is too long")
    ) {
      return err;
    }
    // LLM API errors — strip internal details
    if (err.message.startsWith("LLM API error")) {
      const statusMatch = err.message.match(/\((\d+)\)/);
      const status = statusMatch ? statusMatch[1] : "unknown";
      return new Error(
        `The analysis service returned an error (status ${status}). Please try again.`
      );
    }
  }
  return new Error("Something went wrong during analysis. Please try again.");
}

// ─────────────────────────────────────────────
// LLM API call — OpenAI-compatible chat completions
// with timeout + retry
// ─────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 60_000; // 60s per attempt
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 2_000; // 2s, doubles each retry

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const { apiUrl, apiKey, model } = getLLMConfig();

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3, // Low temp for consistent, focused analysis
          max_tokens: 4096,
          response_format: { type: "json_object" }, // Request JSON output where supported
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();
        const err = new Error(`LLM API error (${response.status}): ${errorBody}`);

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          lastError = err;
          continue; // retry
        }

        throw sanitizeError(err);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("LLM returned empty response. Please try again.");
      }

      return content;
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof Error && err.name === "AbortError") {
        lastError = err;
        if (attempt < MAX_RETRIES) continue; // retry on timeout
      }

      // Non-retryable error — sanitize and throw
      throw sanitizeError(err);
    }
  }

  // All retries exhausted
  throw sanitizeError(lastError);
}

// ─────────────────────────────────────────────
// Response parsing with fallback
// ─────────────────────────────────────────────

const VALID_CATEGORIES: FindingCategory[] = [
  "citation-missing",
  "citation-orphan",
  "bibliography-orphan",
  "generic-paragraph",
  "structural-issue",
];

function parseAndValidateResponse(raw: string): LLMAnalysisResponse {
  let parsed: unknown;

  // Try direct parse first
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      throw new Error("Could not parse LLM response as JSON. Please try again.");
    }
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.findings)) {
    throw new Error("LLM response missing 'findings' array. Please try again.");
  }

  const findings: RawLLMFinding[] = obj.findings.map((f: Record<string, unknown>) => ({
    flaggedText: String(f.flaggedText || ""),
    issue: String(f.issue || ""),
    suggestedFix: String(f.suggestedFix || ""),
    category: String(f.category || "structural-issue"),
  }));

  const summary =
    typeof obj.summary === "string"
      ? obj.summary
      : "Analysis complete. Review the findings below to strengthen your paper.";

  return { findings, summary };
}

// ─────────────────────────────────────────────
// Main entry point — call this from API routes
// ─────────────────────────────────────────────

export async function analyzeDocument(input: AnalysisInput): Promise<ReportData> {
  // Estimate input size before calling the LLM
  const fullPrompt = SYSTEM_PROMPT + buildUserPrompt(input.text, input.bibliography);
  const estimatedTokens = estimateTokenCount(fullPrompt);

  if (estimatedTokens > MAX_INPUT_TOKENS) {
    throw new Error(
      `Document is too long for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens, ` +
        `limit is ${Math.round(MAX_INPUT_TOKENS / 1000)}k). Try submitting a shorter section of your paper.`
    );
  }

  const userPrompt = buildUserPrompt(input.text, input.bibliography);
  const rawResponse = await callLLM(SYSTEM_PROMPT, userPrompt);
  const parsed = parseAndValidateResponse(rawResponse);

  // Normalize findings: validate categories, trim text
  const findings: Finding[] = parsed.findings
    .filter((f) => f.flaggedText.trim() && f.issue.trim())
    .map((f) => ({
      flaggedText: f.flaggedText.trim(),
      issue: f.issue.trim(),
      suggestedFix: f.suggestedFix.trim(),
      category: VALID_CATEGORIES.includes(f.category as FindingCategory)
        ? (f.category as FindingCategory)
        : "structural-issue",
    }));

  return {
    findings,
    summary: parsed.summary,
    analyzedAt: new Date().toISOString(),
  };
}
