// ============================================================
// POST /api/similarity/:id — run originality / similarity check
//
// This is a SEPARATE step from the main analysis (Phase 1-3).
// It's slower (multiple search + LLM calls) and more expensive,
// so students opt-in by clicking "Check originality" on the report.
//
// Returns similarity findings that are stored in the report's
// report_data alongside the main findings.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runSimilarityAnalysis } from "@/lib/analysis/similarity";
import { isSearchConfigured } from "@/lib/search";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Finding } from "@/lib/analysis/schema";

// ─────────────────────────────────────────────
// Rate limit: 1 request per 30 seconds per user
// (slower than main analysis because it's more expensive)
// ─────────────────────────────────────────────

const RATE_LIMIT_MAX = 1;
const RATE_LIMIT_WINDOW_MS = 30_000;

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
      `similarity:${user.id}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      const retryAfterSec = Math.ceil(rateLimit.retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: `Please wait ${retryAfterSec} seconds before running another originality check.`,
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
      .select("id, raw_text, user_id, status")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404 }
      );
    }

    if (document.status !== "completed") {
      return NextResponse.json(
        {
          error:
            "Please run the main analysis first before checking originality.",
        },
        { status: 409 }
      );
    }

    // ── Fetch the existing report ──
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, report_data")
      .eq("document_id", document.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError || !report) {
      return NextResponse.json(
        { error: "No analysis report found. Please run the main analysis first." },
        { status: 404 }
      );
    }

    // ── Run similarity analysis ──
    const result = await runSimilarityAnalysis(document.raw_text, document.id);

    // ── Merge similarity findings into the report ──
    const existingData = report.report_data as Record<string, unknown>;
    const existingFindings = Array.isArray(existingData.findings)
      ? (existingData.findings as Finding[])
      : [];
    const existingMeta = (existingData.meta as Record<string, unknown>) || {};

    // Separate similarity findings from main findings
    const mainFindings = existingFindings.filter(
      (f) =>
        f.category !== "source-match" &&
        f.category !== "paraphrase-risk" &&
        f.category !== "style-inconsistency"
    );

    // Merge: main findings + new similarity findings
    const mergedFindings = [...mainFindings, ...result.findings];

    const updatedData = {
      ...existingData,
      findings: mergedFindings,
      meta: {
        ...existingMeta,
        similarityFindings: result.findings.length,
        similaritySearchQueries: result.searchQueriesUsed,
        similarityCheckedAt: new Date().toISOString(),
      },
    };

    // ── Save updated report ──
    const { error: updateError } = await supabase
      .from("reports")
      .update({ report_data: updatedData })
      .eq("id", report.id);

    if (updateError) {
      console.error("Failed to update report with similarity findings:", updateError);
      return NextResponse.json(
        { error: "Similarity analysis ran but we couldn't save the results." },
        { status: 500 }
      );
    }

    const elapsed = Date.now() - pipelineStart;
    console.log(
      `[Similarity] Complete for document ${document.id}: ` +
        `${result.findings.length} findings, ${result.searchQueriesUsed} queries, ` +
        `${elapsed}ms`
    );

    return NextResponse.json({
      similarityFindings: result.findings.length,
      searchQueriesUsed: result.searchQueriesUsed,
      searchAvailable: result.searchAvailable,
    });
  } catch (err) {
    console.error("Unexpected similarity analysis error:", err);
    return NextResponse.json(
      { error: "Something went wrong during the originality check. Please try again." },
      { status: 500 }
    );
  }
}
