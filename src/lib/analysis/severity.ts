// ============================================================
// Severity and confidence mappings
//
// Deterministic findings get hardcoded severity + confidence 1.0
// LLM findings get category-based severity + conservative confidence
//
// These defaults will be refined when the production prompt is
// updated to include severity/confidence from the LLM itself.
// ============================================================

import type { FindingCategory, Severity, FindingSource } from "./schema";

/**
 * Default severity by category.
 * "high"   = directly affects academic integrity or grade
 * "medium" = weakens the paper but not catastrophic
 * "low"    = formatting / style issue
 */
export const SEVERITY_MAP: Record<FindingCategory, Severity> = {
  "citation-missing": "medium",
  "citation-orphan": "high",
  "bibliography-orphan": "medium",
  "generic-paragraph": "medium",
  "structural-issue": "low",
};

/**
 * Default confidence by source.
 * Deterministic = 1.0 (regex match is certain)
 * LLM = 0.7 (conservative default until prompt asks for self-rating)
 */
export const DEFAULT_CONFIDENCE: Record<FindingSource, number> = {
  deterministic: 1.0,
  llm: 0.7,
};