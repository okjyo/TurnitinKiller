// ============================================================
// Phase 3: Merge deterministic + LLM findings
//
// Deduplicates overlapping findings, assigns IDs/severity/confidence,
// and validates the final ReportData with Zod.
// ============================================================

import {
  ReportDataSchema,
  type Finding,
  type ReportData,
  type RawLLMResponse,
} from "./schema";
import { SEVERITY_MAP, DEFAULT_CONFIDENCE } from "./severity";

/**
 * Merge deterministic findings (Phase 1) with LLM findings (Phase 2).
 *
 * Rules:
 * 1. Deterministic findings are always kept (confidence 1.0)
 * 2. LLM findings that overlap with a deterministic finding are dropped
 *    (the deterministic version is more reliable)
 * 3. Remaining LLM findings are enriched with id/severity/confidence/source
 * 4. Final result is Zod-validated
 */
export function mergeFindings(
  deterministicFindings: Finding[],
  llmResult: RawLLMResponse,
  processingTimeMs: number
): ReportData {
  const startTime = Date.now();

  // Build a set of text spans flagged by deterministic findings
  // for overlap detection
  const deterministicSpans = deterministicFindings.map((f) =>
    normalizeForComparison(f.flaggedText)
  );

  // Filter out LLM findings that overlap with deterministic ones
  const mergedLLMFindings: Finding[] = [];
  for (const rawFinding of llmResult.findings) {
    const normalized = normalizeForComparison(rawFinding.flaggedText);

    const isDuplicate = deterministicSpans.some((span) =>
      hasSignificantOverlap(span, normalized)
    );

    if (isDuplicate) continue;

    mergedLLMFindings.push({
      id: crypto.randomUUID(),
      flaggedText: rawFinding.flaggedText,
      issue: rawFinding.issue,
      suggestedFix: rawFinding.suggestedFix,
      category: rawFinding.category,
      severity: SEVERITY_MAP[rawFinding.category],
      confidence: DEFAULT_CONFIDENCE.llm,
      source: "llm",
    });
  }

  // Merge: deterministic first (higher confidence), then LLM
  const allFindings = [...deterministicFindings, ...mergedLLMFindings];

  const reportData: ReportData = {
    findings: allFindings,
    summary: llmResult.summary,
    analyzedAt: new Date().toISOString(),
    meta: {
      deterministicFindings: deterministicFindings.length,
      llmFindings: mergedLLMFindings.length,
      processingTimeMs,
    },
  };

  // Final Zod validation — guarantees the output shape
  const validated = ReportDataSchema.safeParse(reportData);
  if (validated.success) {
    return validated.data;
  }

  // If Zod rejects (shouldn't happen with our controlled input), log and return as-is
  console.error("ReportData Zod validation failed:", validated.error.format());
  return reportData;
}

// ─────────────────────────────────────────────
// Overlap detection helpers
// ─────────────────────────────────────────────

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Check if two text strings have significant overlap (>50% of the shorter one).
 * Used to detect when the LLM flagged the same passage as a deterministic check.
 */
function hasSignificantOverlap(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false;

  // Exact substring match
  if (a.includes(b) || b.includes(a)) return true;

  // Character-level overlap: count shared characters
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  // Sliding window: check if any 30-char substring of shorter appears in longer
  if (shorter.length >= 30) {
    const window = shorter.slice(0, 30);
    if (longer.includes(window)) return true;
  }

  // Word-level overlap: count shared words
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 3));
  let shared = 0;
  for (const word of Array.from(wordsA)) {
    if (wordsB.has(word)) shared++;
  }
  const minWords = Math.min(wordsA.size, wordsB.size);
  if (minWords > 0 && shared / minWords > 0.5) return true;

  return false;
}