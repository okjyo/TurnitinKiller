// ============================================================
// POST /api/reanalyze/:id — re-run analysis on a document
//
// Two modes:
//   1. Retry (no body or empty body) — re-runs on stored text
//   2. Edit & re-analyze (body with rawText) — updates the
//      document's text first, then runs the full pipeline
//
// Body (all optional):
//   { rawText?: string, bibliographyText?: string }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeText } from "@/lib/parsing/normalize-text";
import {
  extractBibliography,
  countReferences,
} from "@/lib/parsing/bibliography";
import { runDeterministicAnalysis } from "@/lib/analysis/deterministic";
import { runLLMAnalysis } from "@/lib/analysis/llm-analysis";
import { mergeFindings } from "@/lib/analysis/merge";
import { SEVERITY_MAP } from "@/lib/analysis/severity";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_MS = 10_000;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pipelineStart = Date.now();

  try {
    // ── Auth ──
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Rate limit ──
    const rateLimit = checkRateLimit(
      `reanalyze:${user.id}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        { error: `Please wait ${retryAfterSec} seconds before retrying.` },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
    }

    // ── Parse optional body ──
    let bodyRawText: string | undefined;
    let bodyBibliographyText: string | undefined;
    try {
      const body = await request.json();
      if (typeof body.rawText === "string" && body.rawText.trim()) {
        bodyRawText = body.rawText;
      }
      if (typeof body.bibliographyText === "string") {
        bodyBibliographyText = body.bibliographyText;
      }
    } catch {
      /* no body or invalid JSON — use stored text */
    }

    // ── Fetch the document ──
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, raw_text, bibliography_text, status")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    if (document.status === "pending") {
      return NextResponse.json(
        { error: "Analysis is still in progress. Please wait." },
        { status: 409 }
      );
    }

    // ── Determine final text ──
    let finalBodyText: string;
    let finalBibliography: string;
    let bibliographyWasAutoDetected = false;

    if (bodyRawText) {
      // Edit & re-analyze mode: use submitted text
      finalBodyText = normalizeText(bodyRawText);
      finalBibliography = bodyBibliographyText?.trim() || "";

      if (!finalBibliography) {
        const extracted = extractBibliography(finalBodyText);
        if (extracted.wasExtracted && extracted.bibliography) {
          finalBodyText = extracted.bodyText;
          finalBibliography = extracted.bibliography;
          bibliographyWasAutoDetected = true;
        }
      }

      if (!finalBodyText || finalBodyText.length === 0) {
        return NextResponse.json(
          { error: "The submitted text appears to be empty." },
          { status: 400 }
        );
      }

      // Update the stored document text
      await supabase
        .from("documents")
        .update({
          raw_text: finalBodyText,
          bibliography_text: finalBibliography || null,
        })
        .eq("id", document.id);
    } else {
      // Retry mode: use stored text as-is
      finalBodyText = document.raw_text;
      finalBibliography = document.bibliography_text || "";
    }

    // ── Reset status to pending ──
    await supabase
      .from("documents")
      .update({ status: "pending" })
      .eq("id", document.id);

    // ── Delete existing report ──
    await supabase
      .from("reports")
      .delete()
      .eq("document_id", document.id);

    // ── PHASE 1: Deterministic analysis ──
    const deterministicFindings = runDeterministicAnalysis(
      finalBodyText,
      finalBibliography || null
    );

    // ── PHASE 2: LLM semantic analysis ──
    let llmResult;
    try {
      llmResult = await runLLMAnalysis({
        text: finalBodyText,
        bibliography: finalBibliography || undefined,
      });
    } catch (err) {
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);

      const message =
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // ── PHASE 3: Merge ──
    const processingTimeMs = Date.now() - pipelineStart;
    const reportData = mergeFindings(
      deterministicFindings,
      llmResult,
      processingTimeMs
    );

    // Add auto-detected bibliography note if applicable
    if (bibliographyWasAutoDetected && finalBibliography) {
      const refCount = countReferences(finalBibliography);
      reportData.findings.unshift({
        id: crypto.randomUUID(),
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
        severity: SEVERITY_MAP["structural-issue"],
        confidence: 1.0,
        source: "deterministic",
      });
    }

    // ── Save the report ──
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        document_id: document.id,
        report_data: reportData,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      console.error("Report insert error on reanalyze:", reportError);
      await supabase
        .from("documents")
        .update({ status: "failed" })
        .eq("id", document.id);
      return NextResponse.json(
        { error: "Analysis ran but we couldn't save the report." },
        { status: 500 }
      );
    }

    // ── Mark as completed ──
    await supabase
      .from("documents")
      .update({ status: "completed" })
      .eq("id", document.id);

    return NextResponse.json({ reportId: report.id });
  } catch (err) {
    console.error("Unexpected reanalyze error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}