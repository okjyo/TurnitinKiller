// ============================================================
// Shared types for the Originality Assistant
// ============================================================

/** A single finding from the analysis engine */
export interface Finding {
  /** The exact text passage from the student's document */
  flaggedText: string;
  /** Plain-language explanation of the issue */
  issue: string;
  /** Concrete suggestion to fix the issue (coaching tone) */
  suggestedFix: string;
  /** Category tag for grouping in the UI */
  category: FindingCategory;
}

/** All possible finding categories across the 4 analysis features */
export type FindingCategory =
  | "citation-missing"       // factual claim with no citation nearby
  | "citation-orphan"        // in-text citation with no bibliography match
  | "bibliography-orphan"    // bibliography entry never cited in text
  | "generic-paragraph"      // reads as generic/AI-like, unsupported
  | "structural-issue";      // checklist item (missing refs, mixed styles, etc.)

/** The shape of a full analysis report stored in the DB */
export interface ReportData {
  findings: Finding[];
  summary: string;
  analyzedAt: string;
}

/** A row from the `documents` table */
export interface Document {
  id: string;
  user_id: string;
  title: string;
  raw_text: string;
  bibliography_text: string | null;
  created_at: string;
}

/** A row from the `reports` table */
export interface Report {
  id: string;
  document_id: string;
  created_at: string;
  report_data: ReportData;
}
