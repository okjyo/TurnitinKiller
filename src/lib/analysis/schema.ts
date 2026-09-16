// ============================================================
// Zod schemas for the analysis pipeline
//
// These schemas validate data at pipeline boundaries and
// infer TypeScript types so schema + type are always in sync.
// ============================================================

import { z } from "zod";

// ─────────────────────────────────────────────
// Finding categories (must match existing constants.ts labels)
// ─────────────────────────────────────────────

export const FindingCategorySchema = z.enum([
  "citation-missing",
  "citation-orphan",
  "bibliography-orphan",
  "generic-paragraph",
  "structural-issue",
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

// ─────────────────────────────────────────────
// Severity — how much this affects the paper
// ─────────────────────────────────────────────

export const SeveritySchema = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ─────────────────────────────────────────────
// Source — where this finding came from
// ─────────────────────────────────────────────

export const FindingSourceSchema = z.enum(["deterministic", "llm"]);
export type FindingSource = z.infer<typeof FindingSourceSchema>;

// ─────────────────────────────────────────────
// Full finding (pipeline output)
// ─────────────────────────────────────────────

export const FindingSchema = z.object({
  id: z.string().uuid(),
  flaggedText: z.string().min(1).max(500),
  issue: z.string().min(1).max(1000),
  suggestedFix: z.string().min(1).max(1000),
  category: FindingCategorySchema,
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  source: FindingSourceSchema,
});
export type Finding = z.infer<typeof FindingSchema>;

// ─────────────────────────────────────────────
// Raw LLM finding (what the LLM returns — no id/severity/confidence/source)
// Used for Zod validation of LLM response before enrichment
// ─────────────────────────────────────────────

export const RawLLMFindingSchema = z.object({
  flaggedText: z.string().min(1),
  issue: z.string().min(1),
  suggestedFix: z.string().min(1),
  category: FindingCategorySchema,
});
export type RawLLMFinding = z.infer<typeof RawLLMFindingSchema>;

export const RawLLMResponseSchema = z.object({
  findings: z.array(RawLLMFindingSchema),
  summary: z.string().min(1),
});
export type RawLLMResponse = z.infer<typeof RawLLMResponseSchema>;

// ─────────────────────────────────────────────
// Report data (the final output stored in the DB)
// ─────────────────────────────────────────────

export const ReportMetaSchema = z.object({
  deterministicFindings: z.number().int().min(0),
  llmFindings: z.number().int().min(0),
  processingTimeMs: z.number().int().min(0),
});
export type ReportMeta = z.infer<typeof ReportMetaSchema>;

export const ReportDataSchema = z.object({
  findings: z.array(FindingSchema),
  summary: z.string().min(1).max(2000),
  analyzedAt: z.string().datetime(),
  meta: ReportMetaSchema,
});
export type ReportData = z.infer<typeof ReportDataSchema>;

// ─────────────────────────────────────────────
// Lenient reader for old reports (pre-architecture-overhaul)
// Fills defaults for fields that didn't exist before
// ─────────────────────────────────────────────

export interface LegacyFinding {
  flaggedText: string;
  issue: string;
  suggestedFix: string;
  category: string;
  // These may be absent in old reports:
  id?: string;
  severity?: string;
  confidence?: number;
  source?: string;
}

export interface LegacyReportData {
  findings: LegacyFinding[];
  summary: string;
  analyzedAt?: string;
  meta?: ReportMeta;
}

const VALID_CATEGORIES: FindingCategory[] = [
  "citation-missing",
  "citation-orphan",
  "bibliography-orphan",
  "generic-paragraph",
  "structural-issue",
];

const VALID_SEVERITIES: Severity[] = ["low", "medium", "high"];

/**
 * Parse a report from the DB that may be in old format (no id/severity/etc.)
 * or new format. Always returns a valid ReportData.
 */
export function parseReportData(raw: unknown): ReportData {
  if (!raw || typeof raw !== "object") {
    return {
      findings: [],
      summary: "No analysis data found.",
      analyzedAt: new Date().toISOString(),
      meta: { deterministicFindings: 0, llmFindings: 0, processingTimeMs: 0 },
    };
  }

  const data = raw as LegacyReportData;

  const findings: Finding[] = (data.findings ?? [])
    .filter((f) => f && typeof f.flaggedText === "string" && f.flaggedText.trim())
    .map((f) => ({
      id: typeof f.id === "string" ? f.id : crypto.randomUUID(),
      flaggedText: f.flaggedText.trim(),
      issue: typeof f.issue === "string" ? f.issue : "",
      suggestedFix: typeof f.suggestedFix === "string" ? f.suggestedFix : "",
      category: VALID_CATEGORIES.includes(f.category as FindingCategory)
        ? (f.category as FindingCategory)
        : "structural-issue",
      severity: VALID_SEVERITIES.includes(f.severity as Severity)
        ? (f.severity as Severity)
        : "medium",
      confidence:
        typeof f.confidence === "number" && f.confidence >= 0 && f.confidence <= 1
          ? f.confidence
          : 0.7,
      source: f.source === "deterministic" ? "deterministic" : "llm",
    }));

  return {
    findings,
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary
        : "Analysis complete.",
    analyzedAt:
      typeof data.analyzedAt === "string"
        ? data.analyzedAt
        : new Date().toISOString(),
    meta: data.meta ?? {
      deterministicFindings: 0,
      llmFindings: findings.length,
      processingTimeMs: 0,
    },
  };
}