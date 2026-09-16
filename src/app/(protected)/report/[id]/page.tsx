// ============================================================
// Report page — displays the full analysis report
// Shows each of the 4 feature sections as expandable cards
// ============================================================

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Finding, FindingCategory } from "@/lib/types";
import { parseReportData } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import ReportSection from "@/components/report-section";

const CATEGORY_ORDER: FindingCategory[] = [
  "citation-missing",
  "citation-orphan",
  "bibliography-orphan",
  "generic-paragraph",
  "structural-issue",
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  // Await params for Next.js 15 compatibility (safe as a no-op on 14.x)
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // Fetch the report with its document (RLS ensures ownership)
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, created_at, report_data, documents(id, title, user_id)")
    .eq("id", id)
    .single();

  if (reportError || !report || !report.documents) {
    notFound();
  }

  // Extract the joined document safely (Supabase returns it as a JSON object)
  const doc = report.documents as unknown as {
    id: string;
    title: string;
    user_id: string;
  };

  if (!doc || doc.user_id !== user.id) {
    notFound();
  }

  // Parse report data (handles both old and new format)
  const reportData = parseReportData(report.report_data);
  const findings = reportData.findings;
  const summary = reportData.summary;

  // Group findings by category
  const grouped: Record<string, Finding[]> = {};
  for (const f of findings) {
    if (!grouped[f.category]) grouped[f.category] = [];
    grouped[f.category].push(f);
  }

  // Sort categories by our defined order, then any extras
  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => (grouped[c]?.length ?? 0) > 0),
    ...Object.keys(grouped).filter(
      (c) => !CATEGORY_ORDER.includes(c as FindingCategory)
    ),
  ];

  const totalFindings = findings.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Back to My Papers
          </Link>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-900">
            {doc.title}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Analyzed on{" "}
            {new Date(report.created_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mt-6 rounded-md border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-sm font-semibold text-brand-800">
            Overall Assessment
          </h2>
          <p className="mt-2 text-sm text-brand-700 leading-relaxed">
            {summary}
          </p>
        </div>
      )}

      {/* Stats bar */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="rounded-md bg-white border border-gray-200 px-4 py-2">
          <span className="text-lg font-semibold text-gray-900">
            {totalFindings}
          </span>
          <span className="ml-1.5 text-sm text-gray-500">
            {totalFindings === 1 ? "finding" : "findings"}
          </span>
        </div>
        {sortedCategories.map((cat) => (
          <div
            key={cat}
            className="rounded-md bg-white border border-gray-200 px-3 py-2 text-xs text-gray-600"
          >
            <span className="font-semibold">{grouped[cat].length}</span>{" "}
            {CATEGORY_LABELS[cat] || cat}
          </div>
        ))}
      </div>

      {/* Report sections */}
      {sortedCategories.length > 0 ? (
        <div className="mt-6 space-y-4">
          {sortedCategories.map((cat) => (
            <ReportSection
              key={cat}
              category={cat}
              findings={grouped[cat]}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
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
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-gray-900">
            Looking good!
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            The analysis didn&apos;t find any significant issues. Your paper is
            well-structured and properly cited.
          </p>
        </div>
      )}
    </div>
  );
}
