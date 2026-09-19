// ============================================================
// Not-found boundary for /report/[id]
//
// Shown when the report doesn't exist or belongs to another user.
// Same class of problem as the stuck-pending bug — the student
// needs to know what happened and what to do next, not a generic
// 404.
// ============================================================

import Link from "next/link";

export default function ReportNotFound() {
  return (
    <main className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-6 w-6 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
        </div>
        <h1 className="font-serif text-xl text-brand-900">Report not found</h1>
        <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
          This report doesn&apos;t exist or may still be processing. If you
          recently uploaded a document, check the dashboard for its status.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition"
          >
            Back to dashboard
          </Link>
          <Link
            href="/upload"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Upload a paper
          </Link>
        </div>
      </div>
    </main>
  );
}