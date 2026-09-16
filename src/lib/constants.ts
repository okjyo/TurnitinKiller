// ============================================================
// App-wide constants
// ============================================================

export const APP_NAME = "Originality Assistant";
export const APP_TAGLINE = "Understand and strengthen your writing before you submit";

/**
 * Max file size for uploads. Default 10 MB.
 * Override via NEXT_PUBLIC_MAX_FILE_SIZE_MB env var (in MB).
 * Clamped to [1, 50] to prevent absurd values.
 */
const DEFAULT_MAX_FILE_SIZE_MB = 10;
const envSizeMB = Number(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB);
const clampedSizeMB =
  Number.isFinite(envSizeMB) && envSizeMB > 0
    ? Math.min(Math.max(Math.round(envSizeMB), 1), 50)
    : DEFAULT_MAX_FILE_SIZE_MB;
export const MAX_FILE_SIZE_BYTES = clampedSizeMB * 1024 * 1024;

/** Accepted file extensions for upload */
export const ACCEPTED_FILE_EXTENSIONS = [".txt", ".docx", ".pdf"] as const;

/** Finding category display labels (coaching tone, never accusatory) */
export const CATEGORY_LABELS: Record<string, string> = {
  "citation-missing": "Citation Needed",
  "citation-orphan": "Unmatched Citation",
  "bibliography-orphan": "Unused Source",
  "generic-paragraph": "Strengthen This Paragraph",
  "structural-issue": "Formatting Check",
};

/** Finding category descriptions */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "citation-missing": "These passages contain claims that would benefit from a supporting citation.",
  "citation-orphan": "These in-text citations don't match any entry in your bibliography.",
  "bibliography-orphan": "These bibliography entries aren't cited anywhere in your text.",
  "generic-paragraph": "These paragraphs could be stronger with specific evidence or examples.",
  "structural-issue": "Basic structural checks to make sure your paper follows consistent conventions.",
};
