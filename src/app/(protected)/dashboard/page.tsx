// ============================================================
// Dashboard — lists uploaded documents + "New Analysis" button
// ============================================================

import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import DeleteDocumentButton from "@/components/delete-document-button";
import RetryAnalysisButton from "@/components/retry-analysis-button";
import PaperStatusBadge from "@/components/paper-status-badge";
import type { ReportData } from "@/lib/analysis/schema";

export const dynamic = "force-dynamic";

/** Severity tier — matches the report page's "Address first / Worth reviewing / Optional polish" language */
type SeverityTier = "address" | "review" | "polish" | "clean";

function getReportSummary(reportData: unknown): {
  findingCount: number;
  categories: string[];
  tier: SeverityTier;
} | null {
  if (!reportData || typeof reportData !== "object") return null;
  const data = reportData as Partial<ReportData>;
  if (!Array.isArray(data.findings)) return null;

  const findings = data.findings;
  const categories = findings.map((f) => f.category);
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;

  if (findings.length === 0) {
    return { findingCount: 0, categories, tier: "clean" };
  }
  if (highCount > 0) {
    return { findingCount: findings.length, categories, tier: "address" };
  }
  if (mediumCount > 0) {
    return { findingCount: findings.length, categories, tier: "review" };
  }
  return { findingCount: findings.length, categories, tier: "polish" };
}

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch documents with their latest report (for finding counts)
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, title, created_at, status, reports(id, report_data)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
            Dashboard
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-brand-900 sm:text-3xl">
            My Papers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review your past analyses or start a new one.
          </p>
        </div>
        <Link
          href="/analyze"
          className="inline-flex items-center justify-center rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
        >
          + New Analysis
        </Link>
      </div>

      {fetchError ? (
        <div className="mt-8 rounded-md bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Could not load your papers.</p>
          <p className="mt-1 text-red-600">
            Please refresh the page. If this keeps happening, try signing out and back in.
          </p>
        </div>
      ) : documents && documents.length > 0 ? (
        <>
          {/* Severity legend */}
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Status:</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Address first
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
              Worth reviewing
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
              Optional polish
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
              Ready to submit
            </span>
          </div>

          {/* Paper cards */}
          <div className="mt-4 space-y-3">
            {documents.map((doc) => {
              const status = doc.status as string;
              const reports = doc.reports as unknown;
              const latestReport = Array.isArray(reports) ? reports[0] : reports;
              const reportData = latestReport && typeof latestReport === "object"
                ? (latestReport as { report_data?: unknown }).report_data
                : undefined;
              const summary = getReportSummary(reportData);
              // Extract the actual report UUID (not the document UUID)
              const reportId = latestReport && typeof latestReport === "object"
                ? (latestReport as { id?: string }).id
                : undefined;

              return (
                <div
                  key={doc.id}
                  className="group rounded-lg border border-gray-200 bg-white px-5 py-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-gray-900 group-hover:text-brand-800 transition">
                        {doc.title}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-3">
                        <p className="text-xs text-gray-500">
                          {new Date(doc.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {status === "completed" && summary && reportId && (
                          <PaperStatusBadge
                            reportId={reportId}
                            categories={summary.categories}
                            findingCount={summary.findingCount}
                            tier={summary.tier}
                          />
                        )}
                        {status === "failed" && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                              Analysis failed
                            </span>
                          </span>
                        )}
                        {status !== "completed" && status !== "failed" && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300 animate-pulse" />
                            <span className="text-xs text-gray-400">Analyzing…</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-[18px] sm:pl-0 sm:gap-3">
                      {status === "completed" ? (
                        <Link
                          href={`/report/${doc.id}`}
                          className="rounded-md bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition"
                        >
                          View Report
                        </Link>
                      ) : status === "failed" ? (
                        <RetryAnalysisButton documentId={doc.id} />
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-gray-400">
                          <svg
                            className="h-3 w-3 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Analyzing
                        </span>
                      )}
                      <DeleteDocumentButton documentId={doc.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <svg
              className="h-6 w-6 text-brand-700"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
          <h2 className="mt-4 font-serif text-lg font-bold text-brand-900">
            No papers yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload your first assignment to get personalized coaching feedback.
          </p>
          <Link
            href="/analyze"
            className="mt-6 inline-block rounded-md bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
          >
            Start Your First Analysis
          </Link>
        </div>
      )}
    </div>
  );
}
