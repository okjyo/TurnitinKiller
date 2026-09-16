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

  // ── Call LLM ──
  const userPrompt = buildUserPrompt(input.text, input.bibliography);
  const rawResponse = await provider.complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
    maxTokens: 4096,
    responseFormat: { type: "json_object" },
  });

  // ── Parse + validate ──
  return parseLLMResponse(rawResponse);
}

/**
 * Parse the LLM's raw text response into a validated RawLLMResponse.
 * Handles direct JSON, markdown-wrapped JSON, and validation failures.
 */
function parseLLMResponse(raw: string): RawLLMResponse {
  let parsed: unknown;

  // Try direct JSON parse
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      throw new Error("Could not parse LLM response as JSON. Please try again.");
    }
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