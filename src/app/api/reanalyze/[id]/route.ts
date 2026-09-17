// ============================================================
// POST /api/reanalyze/:id — re-run analysis on an existing document
// Used for both "retry failed" and "re-analyze completed" actions.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runDeterministicAnalysis } from "@/lib/analysis/deterministic";
import { runLLMAnalysis } from "@/lib/analysis/llm-analysis";
import { mergeFindings } from "@/lib/analysis/merge";
import { checkRateLimit } from "@/lib/rate-limit";

// Same rate limit as the analyze endpoint
const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_MS = 10_000;

export async function POST(
  _request: NextRequest,
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
        {
          error: `Please wait ${retryAfterSec} seconds before retrying.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      );
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

    // Only allow retry on failed or completed documents
    if (document.status === "pending") {
      return NextResponse.json(
        { error: "Analysis is still in progress. Please wait." },
        { status: 409 }
      );
    }

    // ── Reset status to pending ──
    await supabase
      .from("documents")
      .update({ status: "pending" })
      .eq("id", document.id);

    // ── Delete existing report (if re-analyzing a completed doc) ──
    await supabase
      .from("reports")
      .delete()
      .eq("document_id", document.id);

    // ── PHASE 1: Deterministic analysis ──
    const deterministicFindings = runDeterministicAnalysis(
      document.raw_text,
      document.bibliography_text || null
    );

    // ── PHASE 2: LLM semantic analysis ──
    let llmResult;
    try {
      llmResult = await runLLMAnalysis({
        text: document.raw_text,
        bibliography: document.bibliography_text || undefined,
      });
    } catch (err) {
      // Mark as failed
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