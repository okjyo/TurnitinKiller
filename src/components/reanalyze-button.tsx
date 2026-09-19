// ============================================================
// ReanalyzeButton — two re-analyze modes:
//
//   1. Re-analyze — re-runs on stored text (confirmation only)
//   2. Edit & Re-analyze — opens a textarea modal to revise
//      the paper text before re-running
//
// Both POST to the same /api/reanalyze/:id endpoint.
// Mode 2 sends { rawText, bibliographyText? } in the body.
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
  rawText: string;
  bibliographyText: string;
}

export default function ReanalyzeButton({
  documentId,
  rawText,
  bibliographyText,
}: Props) {
  const router = useRouter();

  // Simple re-analyze (confirmation dialog)
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit & re-analyze (editor modal)
  const [showEditor, setShowEditor] = useState(false);
  const [editText, setEditText] = useState(rawText);
  const [editBiblio, setEditBiblio] = useState(bibliographyText);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Quick re-analyze (same text) ──
  async function handleReanalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reanalyze/${documentId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Edit & re-analyze (new text) ──
  async function handleEditReanalyze() {
    if (!editText.trim()) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/reanalyze/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: editText,
          bibliographyText: editBiblio || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setShowEditor(false);
      router.refresh();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <>
      {/* ── Two action buttons ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition"
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
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          Re-analyze
        </button>
        <button
          onClick={() => {
            setEditText(rawText);
            setEditBiblio(bibliographyText);
            setShowEditor(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
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
              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
            />
          </svg>
          Edit &amp; Re-analyze
        </button>
      </div>

      {/* ── Confirmation dialog (quick re-analyze) ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Re-analyze this paper?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              This will replace your current report with a new analysis of the
              same text. This cannot be undone.
            </p>
            {error && (
              <p className="mt-3 rounded-md bg-red-50 p-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setError(null);
                }}
                disabled={loading}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReanalyze}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
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
                    Analyzing…
                  </>
                ) : (
                  "Yes, re-analyze"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit & re-analyze modal ── */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-lg bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit &amp; Re-analyze
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  Paste your revised paper text below, then re-run analysis.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditError(null);
                }}
                className="rounded-md p-1 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 sm:px-6 sm:py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paper text
                </label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={10}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-y font-mono"
                  placeholder="Paste your revised paper text here…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bibliography{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={editBiblio}
                  onChange={(e) => setEditBiblio(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-y font-mono"
                  placeholder="Leave blank to auto-detect from the text above"
                />
              </div>
              {editError && (
                <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                  {editError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t px-4 py-3 sm:px-6 sm:py-4">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditError(null);
                }}
                disabled={editLoading}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleEditReanalyze}
                disabled={editLoading || !editText.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 transition disabled:opacity-50"
              >
                {editLoading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
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
                    Analyzing…
                  </>
                ) : (
                  "Save & Re-analyze"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}