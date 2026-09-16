// ============================================================
// POST /api/analyze — accepts a document, runs LLM analysis,
// saves the report, and returns the report ID
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/parsing/extract-text";
import { normalizeText } from "@/lib/parsing/normalize-text";
import {
  extractBibliography,
  countReferences,
} from "@/lib/parsing/bibliography";
import { analyzeDocument } from "@/lib/llm/analyzer";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";

// ─────────────────────────────────────────────
// MIME type allowlist — validates actual content type,
// not just the file extension
// ─────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  // Some browsers/tools use these for .txt files
  "text/plain; charset=utf-8",
  "text/plain; charset=UTF-8",
]);

// ─────────────────────────────────────────────
// Rate limit: 1 request per 10 seconds per user
// ─────────────────────────────────────────────

const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_MS = 10_000;

// ─────────────────────────────────────────────
// MIME normalization — strip charset suffixes for
// comparison since our set uses bare types
// ─────────────────────────────────────────────

function isAllowedMimeType(type: string): boolean {
  if (ALLOWED_MIME_TYPES.has(type)) return true;
  // Strip charset and re-check
  const bare = type.split(";")[0].trim();
  return ALLOWED_MIME_TYPES.has(bare);
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Rate limit ──────────────────────────────
    const rateLimit = checkRateLimit(
      `analyze:${user.id}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: `You're submitting analyses too quickly. Please wait ${retryAfterSec} seconds and try again.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    // ── Parse form data ─────────────────────────
    const formData = await request.formData();
    const titleRaw = formData.get("title");
    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    const rawText =
      typeof formData.get("rawText") === "string"
        ? (formData.get("rawText") as string)
        : "";
    const bibliographyRaw =
      typeof formData.get("bibliographyText") === "string"
        ? (formData.get("bibliographyText") as string)
        : "";
    const file = formData.get("file");

    const hasPastedText = rawText.trim().length > 0;
    const hasFile = file instanceof File && file.size > 0;

    // ── Title validation ────────────────────────
    if (!title) {
      return NextResponse.json(
        { error: "Please provide a title for this paper." },
        { status: 400 }
      );
    }

    // ── Content source validation ───────────────
    if (!hasPastedText && !hasFile) {
      return NextResponse.json(
        {
          error:
            "Please provide assignment text — either paste it or upload a file.",
        },
        { status: 400 }
      );
    }

    // Reject conflicting inputs
    if (hasPastedText && hasFile) {
      return NextResponse.json(
        {
          error:
            "You provided both pasted text and an uploaded file. Please use only one — remove the file to use pasted text, or clear the text box to use the file.",
        },
        { status: 400 }
      );
    }

    // ── File validation + extraction ────────────
    let assignmentText: string;

    if (hasFile) {
      const uploaded = file as File;

      // Size check
      const maxSizeMB = Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024);
      if (uploaded.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `File is too large (${(uploaded.size / 1024 / 1024).toFixed(1)} MB). Maximum size is ${maxSizeMB} MB.`,
          },
          { status: 400 }
        );
      }

      // MIME type check
      if (uploaded.type && !isAllowedMimeType(uploaded.type)) {
        return NextResponse.json(
          {
            error: `File type "${uploaded.type}" is not supported. Please upload a .txt, .docx, or .pdf file.`,
          },
          { status: 400 }
        );
      }

      try {
        const arrayBuffer = await uploaded.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        assignmentText = await extractTextFromFile(buffer, uploaded.name, {
          userId: user.id,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Could not read the uploaded file.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else {
      // Normalize pasted text (fix line endings, collapse whitespace)
      assignmentText = normalizeText(rawText);
    }

    if (!assignmentText || assignmentText.length === 0) {
      return NextResponse.json(
        {
          error:
            "The uploaded file appears to be empty. Please check the file and try again.",
        },
        { status: 400 }
      );
    }

    // ── Bibliography handling ───────────────────
    // Priority:
    // 1. User provided a separate bibliography → use it directly
    // 2. No separate bibliography → try to auto-detect a References
    //    section in the main text and split it out
    let finalBodyText = assignmentText;
    let finalBibliography = bibliographyRaw.trim() || "";
    let bibliographyWasAutoDetected = false;

    if (!finalBibliography) {
      const extracted = extractBibliography(assignmentText);

      if (extracted.wasExtracted && extracted.bibliography) {
        finalBodyText = extracted.bodyText;
        finalBibliography = extracted.bibliography;
        bibliographyWasAutoDetected = true;

        const refCount = countReferences(finalBibliography);
        console.log(
          `Auto-detected bibliography: ~${refCount} references, ` +
            `${finalBibliography.length} chars`
        );
      }
    }

    // ── Save the document ───────────────────────
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        title,
        raw_text: finalBodyText,
        bibliography_text: finalBibliography || null,
      })
      .select("id")
      .single();

    if (docError || !document) {
      console.error("Document insert error:", docError);
      return NextResponse.json(
        { error: "Failed to save your document. Please try again." },
        { status: 500 }
      );
    }

    // ── Run the LLM analysis ───────────────────
    let reportData;
    try {
      reportData = await analyzeDocument({
        text: finalBodyText,
        bibliography: finalBibliography || undefined,
      });
    } catch (err) {
      // analyzer.ts already sanitizes errors — pass the message through
      const message =
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // If we auto-detected the bibliography, add a structural finding
    // so the student knows it was found and can verify it
    if (bibliographyWasAutoDetected && finalBibliography) {
      const refCount = countReferences(finalBibliography);
      reportData.findings.unshift({
        flaggedText: "(Reference list detected automatically)",
        issue:
          `We found a reference list in your paper with approximately ${refCount} ` +
          "entries. It was split from your main text for cross-referencing. " +
          "If this was incorrect, you can paste your text and bibliography separately next time.",
        suggestedFix:
          "Verify that the reference list was correctly identified. " +
          "If your paper has multiple sections with source lists, consider pasting " +
          "the bibliography separately for more accurate analysis.",
        category: "structural-issue",
      });
    }

    // ── Save the report ────────────────────────
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        document_id: document.id,
        report_data: reportData,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      console.error("Report insert error:", reportError);
      return NextResponse.json(
        {
          error:
            "Analysis ran but we couldn't save the report. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ reportId: report.id });
  } catch (err) {
    console.error("Unexpected analysis error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
