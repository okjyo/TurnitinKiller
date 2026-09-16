// ============================================================
// File text extraction — .docx, .pdf, .txt
// Runs server-side only (API routes)
//
// Each extractor returns text with paragraph boundaries preserved
// as double-newline (\n\n) separators. The caller does NOT need
// to re-normalize paragraph structure.
// ============================================================

import { normalizeText, normalizePdfText } from "./normalize-text";

// ─────────────────────────────────────────────
// Minimum viable text length after extraction.
// Anything shorter likely indicates a parsing failure,
// not an actual short document.
// ─────────────────────────────────────────────
const MIN_TEXT_LENGTH = 50;

/**
 * Extract text from an uploaded file buffer.
 * @param buffer - Raw file bytes
 * @param filename - Original filename (used to detect extension)
 * @param logContext - Optional metadata for extraction failure logging
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  logContext?: { userId?: string; documentId?: string }
): Promise<string> {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "";

  let raw: string;

  try {
    switch (ext) {
      case "txt":
        raw = extractFromTxt(buffer);
        break;

      case "docx":
        raw = await extractFromDocx(buffer);
        break;

      case "pdf":
        raw = await extractFromPdf(buffer);
        break;

      case "":
        throw new Error(
          "The file has no extension. Please upload a .txt, .docx, or .pdf file."
        );

      default:
        throw new Error(
          `Unsupported file type: .${ext}. Please upload a .txt, .docx, or .pdf file.`
        );
    }
  } catch (err) {
    // Log extraction failures for monitoring
    logExtractionFailure(filename, ext, err, logContext);
    throw err;
  }

  // Post-extraction validation
  if (raw.length < MIN_TEXT_LENGTH) {
    const tooShortErr = new Error(
      `Only ${raw.length} characters were extracted from this file. ` +
        "It may be empty, corrupted, or in an unsupported format. " +
        "Try pasting the text directly instead."
    );
    logExtractionFailure(filename, ext, tooShortErr, logContext);
    throw tooShortErr;
  }

  return raw;
}

/**
 * Log extraction failures with context for monitoring/debugging.
 * Structured as JSON so it's grep-friendly in production logs.
 */
function logExtractionFailure(
  filename: string,
  extension: string,
  err: unknown,
  context?: { userId?: string; documentId?: string }
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level: "error",
    event: "extraction_failed",
    filename,
    extension,
    userId: context?.userId ?? "unknown",
    documentId: context?.documentId,
    error: err instanceof Error ? err.message : String(err),
    // Include stack trace in non-production for debugging
    ...(process.env.NODE_ENV !== "production" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  };
  console.error(JSON.stringify(entry));
}

// ─────────────────────────────────────────────
// .txt — plain text with encoding handling
// ─────────────────────────────────────────────

function extractFromTxt(buffer: Buffer): string {
  // Check for BOM to detect encoding
  let text: string;

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    // UTF-8 BOM
    text = buffer.toString("utf-8").slice(1); // strip the BOM char
  } else if (
    buffer.length >= 2 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xfe
  ) {
    // UTF-16 LE BOM — decode via TextDecoder
    text = new TextDecoder("utf-16le").decode(buffer);
  } else if (
    buffer.length >= 2 &&
    buffer[0] === 0xfe &&
    buffer[1] === 0xff
  ) {
    // UTF-16 BE BOM
    text = new TextDecoder("utf-16be").decode(buffer);
  } else {
    // No BOM — assume UTF-8
    text = buffer.toString("utf-8");
  }

  // Normalize: fix line endings, trim lines, collapse excessive blank lines
  return normalizeText(text);
}

// ─────────────────────────────────────────────
// .docx — Word documents via mammoth
// ─────────────────────────────────────────────

async function extractFromDocx(buffer: Buffer): Promise<string> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new Error(
      "DOCX processing library could not be loaded. Please try converting to .txt or .pdf."
    );
  }

  // Use mammoth's HTML conversion to preserve paragraph structure,
  // then strip HTML tags. This gives us proper paragraph boundaries
  // that extractRawText() loses.
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;

    // Log conversion warnings (images lost, tracked changes, etc.)
    if (result.messages.length > 0) {
      const warnings = result.messages.filter(
        (m) => m.type === "warning"
      );
      if (warnings.length > 0) {
        console.warn(
          "DOCX conversion warnings:",
          warnings.map((m) => m.message).join("; ")
        );
      }
    }
  } catch {
    throw new Error(
      "Could not read this .docx file. It may be corrupted or password-protected."
    );
  }

  if (!html || !html.trim()) {
    throw new Error("The document appears to be empty.");
  }

  // Strip HTML tags while preserving paragraph boundaries, lists, headings
  const text = htmlToPlainText(html);

  if (text.length < MIN_TEXT_LENGTH) {
    throw new Error("The document appears to be empty.");
  }

  return text;
}

/**
 * Convert mammoth's HTML output to clean plain text.
 *
 * - <p>, <div>, <blockquote> → double newline (paragraph break)
 * - <h1>-<h6> → heading text in UPPERCASE + double newline
 * - <li> → "- " bullet prefix + single newline
 * - <ol> items → numbered "1. " prefix + single newline
 * - <br> → single newline
 * - <table> rows → newlines, cells → tab-separated
 * - Everything else → stripped tags, decoded entities
 */
function htmlToPlainText(html: string): string {
  let text = html;

  // ── Tables: row → newline, cell → tab ──
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/t[hd]>/gi, "\t");

  // ── Ordered lists: track counter for numbered items ──
  // Process <ol> blocks: replace <li> inside with numbered prefix
  text = text.replace(
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, inner: string) => {
      let counter = 0;
      const numbered = inner.replace(/<li[^>]*>/gi, () => {
        counter++;
        return `\n${counter}. `;
      });
      return numbered;
    }
  );

  // ── Unordered lists: <li> → "- " bullet ──
  // Replace <li> tags that are NOT inside an already-processed <ol>
  // (the <ol> handler already removed <li> inside it, but catch any remaining)
  text = text.replace(/<li[^>]*>/gi, "\n- ");

  // ── Headings: preserve as UPPERCASE text with paragraph break ──
  // Process closing tags first — convert content between <hN> and </hN>
  text = text.replace(
    /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_match, _level: string, content: string) => {
      // Strip any inner tags from the heading content
      const clean = content.replace(/<[^>]+>/g, "").trim();
      return `\n\n${clean.toUpperCase()}\n\n`;
    }
  );

  // ── Block elements → paragraph break ──
  text = text.replace(/<\/(p|div|blockquote|section|article)>/gi, "\n\n");

  // ── <br> variants → newline ──
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // ── Remove all remaining HTML tags ──
  text = text.replace(/<[^>]+>/g, "");

  // ── Decode common HTML entities ──
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

  // ── Clean up whitespace artifacts from HTML stripping ──
  // Collapse tabs (from table cells)
  text = text.replace(/\t{2,}/g, "\t");

  // Collapse 3+ newlines to 2 (paragraph break)
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim trailing whitespace on each line
  text = text.replace(/[ \t]+$/gm, "");

  return text.trim();
}

// ─────────────────────────────────────────────
// .pdf — PDF documents via pdf-parse
// ─────────────────────────────────────────────

async function extractFromPdf(buffer: Buffer): Promise<string> {
  let pdfParse: (buffer: Buffer, options?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>;
  try {
    const mod = await import("pdf-parse");
    // pdf-parse is a CJS module — dynamic import may wrap it in { default }
    // or expose the function directly depending on the bundler
    pdfParse = (mod as unknown as { default: typeof pdfParse }).default ?? (mod as unknown as typeof pdfParse);
  } catch {
    throw new Error(
      "PDF processing library could not be loaded. Please try converting to .docx or .txt."
    );
  }

  let data: { text: string; numpages: number };
  try {
    data = await pdfParse(buffer, {
      // Disable internal rendering — we just need text
      max: 0, // no page limit
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Specific failure modes
    if (msg.includes("password") || msg.includes("encrypted")) {
      throw new Error(
        "This PDF is password-protected. Please remove the password and try again."
      );
    }

    throw new Error(
      "Could not read this PDF. It may be corrupted or in an unsupported format. Try converting to .docx or .txt."
    );
  }

  const raw = data.text;

  if (!raw || !raw.trim()) {
    // Check if it's a scanned PDF (many pages but no text)
    if (data.numpages > 0) {
      throw new Error(
        `This PDF has ${data.numpages} page(s) but no readable text was found. ` +
          "It may be a scanned image. Try converting to .docx or .txt, or use OCR."
      );
    }
    throw new Error(
      "The PDF appears to contain no readable text. Try converting to .docx or .txt."
    );
  }

  // PDF-specific normalization: metadata stripping + heuristic paragraph detection
  return normalizePdfText(raw);
}
