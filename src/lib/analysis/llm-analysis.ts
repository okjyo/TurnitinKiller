// ============================================================
// Phase 2: LLM semantic analysis
//
// Calls the LLM provider with the existing production prompt.
// Validates the response with Zod.
// Returns raw findings (no id/severity/confidence/source yet).
// ============================================================

import { getLLMProvider, estimateTokenCount, MAX_INPUT_TOKENS } from "@/lib/llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/llm/prompts";
import { RawLLMResponseSchema, type RawLLMResponse } from "./schema";
import type { AnalysisInput } from "@/lib/llm/types";

/** Maximum retries when the LLM returns unparseable JSON. */
const MAX_PARSE_RETRIES = 2;

/**
 * Run LLM semantic analysis on the document.
 * The production prompt (SYSTEM_PROMPT + buildUserPrompt) is NOT modified.
 *
 * Returns the parsed + Zod-validated LLM response.
 * Throws user-friendly errors on failure.
 */
export async function runLLMAnalysis(input: AnalysisInput): Promise<RawLLMResponse> {
  const provider = getLLMProvider();

  // ── Token check ──
  const fullPrompt = SYSTEM_PROMPT + buildUserPrompt(input.text, input.bibliography);
  const estimatedTokens = estimateTokenCount(fullPrompt);

  if (estimatedTokens > MAX_INPUT_TOKENS) {
    throw new Error(
      `Document is too long for analysis (estimated ${Math.round(estimatedTokens / 1000)}k tokens, ` +
        `limit is ${Math.round(MAX_INPUT_TOKENS / 1000)}k). Try submitting a shorter section of your paper.`
    );
  }

  // ── Call LLM (with retry on malformed JSON) ──
  const userPrompt = buildUserPrompt(input.text, input.bibliography);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    const rawResponse = await provider.complete({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    });

    try {
      return parseLLMResponse(rawResponse, attempt);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_PARSE_RETRIES) {
        console.warn(
          `[LLM] JSON parse failed on attempt ${attempt + 1}/${MAX_PARSE_RETRIES + 1}, retrying. ` +
            `Raw response (first 300 chars): ${rawResponse.slice(0, 300)}`
        );
      }
    }
  }

  throw lastError ?? new Error("LLM analysis failed after retries. Please try again.");
}

/**
 * Parse the LLM's raw text response into a validated RawLLMResponse.
 * Handles direct JSON, markdown-wrapped JSON, and validation failures.
 * @param attempt Which attempt this is (0-indexed, for logging).
 */
function parseLLMResponse(raw: string, attempt = 0): RawLLMResponse {
  let parsed: unknown;

  // Try direct JSON parse
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim());
      } catch {
        // Fall through to log + throw below
      }
    }
  }

  if (parsed === undefined) {
    console.error(
      `[LLM] Failed to parse response as JSON (attempt ${attempt + 1}). ` +
        `Raw response (first 500 chars): ${raw.slice(0, 500)}`
    );
    throw new Error("Could not parse LLM response as JSON. Please try again.");
  }

  // Zod validation
  const result = RawLLMResponseSchema.safeParse(parsed);

  if (!result.success) {
    // Fall back to lenient parsing if Zod rejects
    // (e.g. LLM returned a slightly off category name)
    return lenientParse(parsed);
  }

  return result.data;
}

/**
 * Lenient fallback: extract what we can from a partially valid response.
 * This handles cases where the LLM returns valid JSON but with minor
 * schema violations (wrong category name, missing field, etc.)
 */
function lenientParse(raw: unknown): RawLLMResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("LLM response is not a JSON object. Please try again.");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.findings)) {
    throw new Error("LLM response missing 'findings' array. Please try again.");
  }

  const VALID_CATEGORIES = new Set([
    "citation-missing",
    "citation-orphan",
    "bibliography-orphan",
    "generic-paragraph",
    "structural-issue",
  ]);

  const findings = obj.findings
    .filter((f: unknown) => f && typeof f === "object")
    .map((f: Record<string, unknown>) => ({
      flaggedText: String(f.flaggedText || "").slice(0, 500),
      issue: String(f.issue || "").slice(0, 1000),
      suggestedFix: String(f.suggestedFix || "").slice(0, 1000),
      category: VALID_CATEGORIES.has(String(f.category))
        ? (String(f.category) as RawLLMResponse["findings"][number]["category"])
        : "structural-issue" as const,
    }))
    .filter((f) => f.flaggedText.length > 0 && f.issue.length > 0);

  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : "Analysis complete. Review the findings below to strengthen your paper.";

  return { findings, summary };
}