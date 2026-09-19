// ============================================================
// Report page — thin server shell that fetches data + delegates
// all interactive UI to <ReportContent />.
//
// URL param is the DOCUMENT id (not report id), so reanalyze
// (which deletes + recreates the report) doesn't break the URL.
// ============================================================

import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { ReportData } from "@/lib/types";
import { parseReportData } from "@/lib/analysis/schema";
import ReportContent from "@/components/report-content";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: Props) {
  const documentId = (await params).id;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          /* read-only page */
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch the document first (ownership check)
  const { data: document } = await supabase
    .from("documents")
    .select("id, user_id, title, created_at, status, raw_text, bibliography_text")
    .eq("id", documentId)
    .single();

  if (!document || document.user_id !== user.id) notFound();

  // Fetch the latest report for this document
  const { data: report, error } = await supabase
    .from("reports")
    .select("id, report_data")
    .eq("document_id", document.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !report) notFound();

  const parsed: ReportData = parseReportData(report.report_data);

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          Originality report
        </p>
        <h1 className="mt-1 font-serif text-xl text-brand-900 sm:text-2xl">
          {document.title}
        </h1>
        <p className="text-sm text-gray-500">
          {new Date(document.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* All interactive UI delegated here */}
      <ReportContent
        reportId={report.id}
        documentId={document.id}
        summary={parsed.summary}
        findings={parsed.findings}
        rawText={document.raw_text}
        bibliographyText={document.bibliography_text ?? ""}
      />
    </>
  );
}