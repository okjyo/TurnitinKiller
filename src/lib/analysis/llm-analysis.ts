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
      maxTokens: 16384,
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
    // Last resort: try to salvage a truncated JSON response
    // (happens when finish_reason is "length" — output cut off mid-stream)
    const salvaged = trySalvageTruncatedJSON(raw);
    if (salvaged) {
      console.warn(
        `[LLM] Salvaged truncated JSON response (attempt ${attempt + 1}). ` +
          `Recovered ${salvaged.findings.length} findings.`
      );
      return salvaged;
    }

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
    "source-match",
    "paraphrase-risk",
    "style-inconsistency",
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

  // Extract recommendations if present
  const VALID_PRIORITIES = new Set(["high", "medium", "low"]);
  let recommendations: RawLLMResponse["recommendations"] | undefined;

  if (Array.isArray(obj.recommendations)) {
    const recs = obj.recommendations
      .filter((r: unknown) => r && typeof r === "object")
      .map((r: Record<string, unknown>) => ({
        title: String(r.title || "").slice(0, 200),
        description: String(r.description || "").slice(0, 1000),
        priority: VALID_PRIORITIES.has(String(r.priority))
          ? (String(r.priority) as "high" | "medium" | "low")
          : ("medium" as const),
      }))
      .filter((r) => r.title.length > 0 && r.description.length > 0);

    if (recs.length > 0) {
      recommendations = recs;
    }
  }

  const summary =
    typeof obj.summary === "string" && obj.summary.trim()
      ? obj.summary.trim()
      : "Analysis complete. Review the findings below to strengthen your paper.";

  return { findings, recommendations, summary };
}

// ─────────────────────────────────────────────
// Truncation salvage — recover partial findings
// from a response that was cut off mid-JSON
// ─────────────────────────────────────────────

const VALID_CATEGORIES_SALVAGE = new Set([
  "citation-missing",
  "citation-orphan",
  "bibliography-orphan",
  "generic-paragraph",
  "structural-issue",
  "source-match",
  "paraphrase-risk",
  "style-inconsistency",
]);

/**
 * Try to salvage findings from a truncated JSON response.
 * When finish_reason is "length", the model's output gets cut off
 * mid-JSON. This function extracts whatever complete finding objects
 * it can from the partial output.
 */
function trySalvageTruncatedJSON(raw: string): RawLLMResponse | null {
  // Find the findings array start
  const findingsStart = raw.indexOf('"findings"');
  if (findingsStart === -1) return null;

  // Find the opening bracket of the array
  const arrayStart = raw.indexOf("[", findingsStart);
  if (arrayStart === -1) return null;

  // Extract complete JSON objects from the array by tracking brace depth
  const raw_findings: Array<{
    flaggedText: string;
    issue: string;
    suggestedFix: string;
    category: RawLLMResponse["findings"][number]["category"];
  }> = [];

  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = arrayStart + 1; i < raw.length; i++) {
    const ch = raw[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        // Try to parse this complete object
        try {
          const obj = JSON.parse(raw.slice(objStart, i + 1)) as Record<string, unknown>;
          if (
            typeof obj.flaggedText === "string" &&
            obj.flaggedText.trim().length > 0 &&
            typeof obj.issue === "string" &&
            obj.issue.trim().length > 0
          ) {
            raw_findings.push({
              flaggedText: obj.flaggedText.trim().slice(0, 500),
              issue: String(obj.issue).slice(0, 1000),
              suggestedFix: String(obj.suggestedFix || "").slice(0, 1000),
              category: VALID_CATEGORIES_SALVAGE.has(String(obj.category))
                ? (String(obj.category) as RawLLMResponse["findings"][number]["category"])
                : "structural-issue",
            });
          }
        } catch {
          // Skip malformed object
        }
        objStart = -1;
      }
    }
  }

  if (raw_findings.length === 0) return null;

  return {
    findings: raw_findings,
    summary: "Analysis complete. Some findings may have been truncated due to document length.",
  };
}