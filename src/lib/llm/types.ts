// ============================================================
// LLM module types
// ============================================================

export interface AnalysisInput {
  /** The student's assignment text */
  text: string;
  /** Optional bibliography/reference list */
  bibliography?: string;
}

export interface RawLLMFinding {
  flaggedText: string;
  issue: string;
  suggestedFix: string;
  category: string;
}

export interface LLMAnalysisResponse {
  findings: RawLLMFinding[];
  summary: string;
}
