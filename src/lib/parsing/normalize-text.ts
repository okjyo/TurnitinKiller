// ============================================================
// Text normalization pipeline
// ============================================================

/**
 * General-purpose text normalization.
 * - Strips BOM and zero-width Unicode characters
 * - Normalizes Unicode to NFC
 * - Normalizes line endings to LF
 * - Collapses multiple spaces within lines (preserving intentional newlines)
 * - Collapses runs of 3+ blank lines into exactly 2 (one paragraph break)
 * - Trims trailing whitespace per line and the whole document
 */
export function normalizeText(raw: string): string {
  let text = raw;

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Strip zero-width characters (ZWSP, ZWNJ, ZWJ, word joiner, soft hyphen)
  text = text.replace(/[​‌‍⁠­]/g, "");

  // NFC normalize
  text = text.normalize("NFC");

  // Line endings → LF
  text = text.replace(/\r\n?/g, "\n");

  // Trim trailing whitespace per line
  text = text.replace(/[ \t]+$/gm, "");

  // Collapse multiple spaces within a line to a single space
  text = text.replace(/ {2,}/g, " ");

  // Collapse runs of 3+ blank lines into exactly 2 (one paragraph break)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim the whole document
  text = text.trim();

  return text;
}

/**
 * Strip pdf-parse metadata headers from extracted text.
 *
 * pdf-parse prepends a header block like:
 *   Author: ...
 *   Creator: ...
 *   Producer: ...
 *   CreationDate: ...
 *
 * This strips those lines so the student's actual text starts clean.
 */
export function stripPdfMetadata(raw: string): string {
  const metadataPattern =
    /^\s*(?:Author|Creator|Producer|Title|Subject|CreationDate|ModDate|Pages|Tagged|Form|Encrypted|Page size|File size|Optimized|PDF version)\s*:.*\n?/gim;
  let text = raw.replace(metadataPattern, "");

  // Strip any leading blank lines left after metadata removal
  text = text.replace(/^\n+/, "");

  return text;
}

/**
 * PDF-specific normalization.
 * PDFs dump text with hard line breaks inside paragraphs, hyphenation
 * artifacts, layout spacing, and metadata headers. This function
 * reconstructs readable paragraphs.
 *
 * Strategy:
 * 1. Strip pdf-parse metadata headers
 * 2. First pass: basic cleanup (multiple spaces, trim lines)
 * 3. Second pass: join lines that are likely mid-sentence continuations
 *    - If a line ends with a lowercase letter or comma and the next line
 *      starts with a lowercase letter → join with a space
 *    - If a line ends with a hyphen and the next line starts with a letter →
 *      de-hyphenate and join (e.g., "informa-\ntion" → "information")
 *    - If a line ends mid-sentence (no terminal punctuation) and the next
 *      line is a short orphan fragment → join to prevent dangling words
 * 4. Preserve lines that start with uppercase as potential paragraph breaks
 * 5. Collapse excessive whitespace
 */
export function normalizePdfText(raw: string): string {
  // Strip pdf-parse metadata first
  let text = stripPdfMetadata(raw);

  // Basic normalization (BOM, NFC, line endings, etc.)
  text = normalizeText(text);

  // Split into lines for line-by-line processing
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i + 1 < lines.length ? lines[i + 1] : null;

    // Skip empty lines (preserve them as paragraph breaks)
    if (line.trim() === "") {
      result.push("");
      continue;
    }

    if (nextLine === null || nextLine.trim() === "") {
      // Last line or followed by blank — keep as-is
      result.push(line);
      continue;
    }

    const trimmedCurrent = line.trimEnd();
    const trimmedNext = nextLine.trimStart();
    const lastChar = trimmedCurrent[trimmedCurrent.length - 1];
    const firstCharNext = trimmedNext[0];

    // De-hyphenate: "informa-\ntion" → "information"
    if (lastChar === "-" && firstCharNext && /[a-z]/.test(firstCharNext)) {
      const withoutHyphen = trimmedCurrent.slice(0, -1);
      result.push(withoutHyphen + trimmedNext);
      i++; // Skip next line since we joined it
      continue;
    }

    // Join mid-sentence: ends with lowercase/comma, next starts with lowercase
    if (
      lastChar &&
      /[a-z,]/.test(lastChar) &&
      firstCharNext &&
      /[a-z]/.test(firstCharNext)
    ) {
      result.push(trimmedCurrent + " " + trimmedNext);
      i++; // Skip next line
      continue;
    }

    // Join orphan words: current line has no terminal punctuation and
    // the next line is very short (< 40 chars, likely a wrapped fragment)
    // Prevents lines like "The results showed a\nsignificant" from staying split
    if (
      lastChar &&
      /[a-z,;:]/.test(lastChar) &&
      !/[.!?]/.test(lastChar) &&
      trimmedNext.length < 40 &&
      firstCharNext &&
      /[a-z]/.test(firstCharNext)
    ) {
      result.push(trimmedCurrent + " " + trimmedNext);
      i++; // Skip next line
      continue;
    }

    // Otherwise keep the line (potential paragraph break)
    result.push(line);
  }

  return normalizeText(result.join("\n"));
}
