// ============================================================
// Bibliography detection and extraction
//
// Attempts to find and split a reference list from the body text
// when the user didn't provide a separate bibliography.
// This improves the LLM's citation analysis significantly.
// ============================================================

/** Result of bibliography detection */
export interface BibliographyExtraction {
  /** The body text (everything before the references section) */
  bodyText: string;
  /** The extracted bibliography, or null if none found */
  bibliography: string | null;
  /** Whether a references section was detected and split */
  wasExtracted: boolean;
}

// ─────────────────────────────────────────────
// Headers that commonly introduce a reference list
// Case-insensitive, must appear on their own line
// ─────────────────────────────────────────────

const SECTION_HEADERS = [
  "references",
  "bibliography",
  "works cited",
  "works consulted",
  "literature cited",
  "references cited",
  "cited works",
  "sources",
  "reference list",
];

/**
 * Regex that matches a line containing ONLY a reference-list header
 * (with optional trailing whitespace/colons).
 *
 * Must be on its own line to avoid matching in-text uses like
 * "In the references section..."
 */
function buildHeaderRegex(): RegExp {
  const escaped = SECTION_HEADERS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Match: optional leading whitespace, the header text, optional colon/period,
  // optional trailing whitespace, end of line.
  // Multiline so ^ and $ match line boundaries.
  return new RegExp(
    `^\\s*(${escaped.join("|")})\\s*[:.]?\\s*$`,
    "gim"
  );
}

/**
 * Try to split a reference list from the body text.
 *
 * Returns the body text and bibliography separately. If no
 * reference section is found, returns the original text as-is
 * and null for bibliography.
 *
 * Strategy:
 * 1. Search for a known header on its own line
 * 2. Take everything after that header as the bibliography
 * 3. Take everything before it as the body text
 * 4. If multiple headers match, use the LAST one (some papers
 *    have section headers like "Sources" for data that aren't
 *    the reference list — the real one is typically last)
 */
export function extractBibliography(text: string): BibliographyExtraction {
  const regex = buildHeaderRegex();

  let lastMatch: { matchStart: number; headerEnd: number } | null = null;
  let match: RegExpExecArray | null;

  // Find the last matching header
  while ((match = regex.exec(text)) !== null) {
    lastMatch = {
      matchStart: match.index,
      headerEnd: match.index + match[0].length,
    };
  }

  if (!lastMatch) {
    return { bodyText: text, bibliography: null, wasExtracted: false };
  }

  // Everything after the header line is the bibliography
  const afterHeader = text.slice(lastMatch.headerEnd);

  // Skip leading blank lines after the header
  const bibStart = afterHeader.search(/\S/);
  if (bibStart === -1) {
    // Header found but nothing after it — treat as no bibliography
    return { bodyText: text, bibliography: null, wasExtracted: false };
  }

  const bibliography = afterHeader.slice(bibStart).trim();

  // Everything before the header line is the body text
  const bodyText = text.slice(0, lastMatch.matchStart).trim();

  // Sanity check: bibliography should be at least 50 characters
  // (a real reference list is never just a few words)
  if (bibliography.length < 50) {
    return { bodyText: text, bibliography: null, wasExtracted: false };
  }

  // Sanity check: body should have meaningful content left
  if (bodyText.length < 100) {
    // The "header" was probably near the top — not a real section break
    return { bodyText: text, bibliography: null, wasExtracted: false };
  }

  return { bodyText, bibliography, wasExtracted: true };
}

/**
 * Count approximate number of references in a bibliography string.
 * Used for sanity-checking extraction quality.
 */
export function countReferences(bibliography: string): number {
  // References typically start with an author name or a bracketed number.
  // Count lines that look like reference entries:
  // - Start with a capital letter followed by a comma (APA author format)
  // - Start with a bracketed number [1], [2]
  // - Start with a number and a period (numbered style)
  const lines = bibliography.split("\n").filter((l) => l.trim().length > 0);

  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // APA-style: "Smith, J. (2024)..."
    if (/^[A-Z][a-z]+,/.test(trimmed)) count++;
    // Organization/agency: "IPCC (2023)..." or "UNESCO (2020)..."
    else if (/^[A-Z][A-Z]+\s*\(/.test(trimmed)) count++;
    // Numbered: "[1] ..." or "1. ..."
    else if (/^\[?\d+[.\]]/.test(trimmed)) count++;
    // MLA-style: "Smith, John. "Title...""
    else if (/^[A-Z][a-z]+,\s+[A-Z]/.test(trimmed)) count++;
  }

  return count;
}
