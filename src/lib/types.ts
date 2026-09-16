// ============================================================
// Shared types for the Originality Assistant
//
// Re-exports from analysis/schema.ts so existing imports
// continue to work. The canonical type definitions live in
// analysis/schema.ts — this file is a compatibility shim.
// ============================================================

export type {
  Finding,
  FindingCategory,
  ReportData,
  ReportMeta,
  Severity,
  FindingSource,
} from "./analysis/schema";

export { parseReportData } from "./analysis/schema";

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
  report_data: import("./analysis/schema").ReportData;
}