// ============================================================
// Dashboard — lists uploaded documents + "New Analysis" button
// ============================================================

import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import DeleteDocumentButton from "@/components/delete-document-button";
import RetryAnalysisButton from "@/components/retry-analysis-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch documents with their report status
  const { data: documents, error: fetchError } = await supabase
    .from("documents")
    .select("id, title, created_at, status, reports(id)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">My Papers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review your past analyses or start a new one.
          </p>
        </div>
        <Link
          href="/analyze"
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
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
        <div className="mt-6 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
          {documents.map((doc) => {
            const hasReport =
              Array.isArray(doc.reports) && doc.reports.length > 0;
            const reportId = hasReport
              ? (doc.reports as { id: string }[])[0]?.id
              : null;
            const status = doc.status as string;

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    {doc.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Uploaded{" "}
                    {new Date(doc.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {status === "completed" && reportId ? (
                    <Link
                      href={`/report/${reportId}`}
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
                      Analysis pending
                    </span>
                  )}
                  <DeleteDocumentButton documentId={doc.id} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-12 text-center">
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
          <h2 className="mt-4 text-lg font-medium text-gray-900">
            No papers yet
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload your first assignment to get personalized coaching feedback.
          </p>
          <Link
            href="/analyze"
            className="mt-4 inline-block rounded-md bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
          >
            Start Your First Analysis
          </Link>
        </div>
      )}
    </div>
  );
}
