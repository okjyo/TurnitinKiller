// ============================================================
// SimilaritySection — Originality check section on the report page
//
// Contains:
// - Disclaimer banner (always visible, not in tooltip)
// - "Check originality" button (or loading state)
// - Similarity findings list
//
// This is a SEPARATE step from the main analysis.
// Students opt-in by clicking the button.
// ============================================================

"use client";

import { useState, useCallback } from "react";
import type { Finding } from "@/lib/types";
import SimilarityCard from "@/components/similarity-card";

// ─────────────────────────────────────────────
// Colors for similarity finding categories
// ─────────────────────────────────────────────

const SIMILARITY_DOT_COLORS: Record<string, string> = {
  "source-match": "bg-red-500",
  "paraphrase-risk": "bg-yellow-500",
  "style-inconsistency": "bg-gray-400",
};

// ─────────────────────────────────────────────
// Disclaimer banner (always visible)
// ─────────────────────────────────────────────

function DisclaimerBanner() {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
          />
        </svg>
        <div>
          <h3 className="text-sm font-semibold text-blue-800">
            About this check
          </h3>
          <p className="mt-1 text-sm text-blue-700 leading-relaxed">
            This checks your text against public web content only. It is not
            connected to Turnitin or your university&apos;s plagiarism database,
            and results may differ from your institution&apos;s official check.
            This check is strongest at catching verbatim or lightly-reworded
            copying. It is not designed to catch every form of paraphrasing.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

interface Props {
  documentId: string;
  similarityFindings: Finding[];
  dismissed: Record<string, boolean>;
  reviewed: Record<string, boolean>;
  dismiss: (key: string) => void;
  markReviewed: (key: string) => void;
}

export default function SimilaritySection({
  documentId,
  similarityFindings,
  dismissed,
  reviewed,
  dismiss,
  markReviewed,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(similarityFindings.length > 0);
  const [searchQueriesUsed, setSearchQueriesUsed] = useState(0);
  const [searchAvailable, setSearchAvailable] = useState(true);

  const handleCheck = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/similarity/${documentId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Originality check failed.");
      }

      const data = await response.json();
      setChecked(true);
      setSearchQueriesUsed(data.searchQueriesUsed ?? 0);
      setSearchAvailable(data.searchAvailable ?? true);

      // Reload the page to show the new findings
      window.location.reload();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Separate similarity findings by category
  const sourceMatchFindings = similarityFindings.filter(
    (f) => f.category === "source-match"
  );
  const paraphraseRiskFindings = similarityFindings.filter(
    (f) => f.category === "paraphrase-risk"
  );
  const styleFindings = similarityFindings.filter(
    (f) => f.category === "style-inconsistency"
  );

  const totalActive = similarityFindings.filter(
    (f) => !dismissed[`${f.category}:${f.flaggedText}`]
  ).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Originality Check
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Check your text against public web content for potential source matches.
          </p>
        </div>
        {!checked && (
          <button
            onClick={handleCheck}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Checking...
              </>
            ) : (
              <>
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
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                Check originality
              </>
            )}
          </button>
        )}
      </div>

      {/* Disclaimer (always visible) */}
      <div className="mt-4">
        <DisclaimerBanner />
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results (after check completes) */}
      {checked && (
        <div className="mt-4 space-y-4">
          {/* Summary */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              {similarityFindings.length === 0
                ? "No obvious source matches found. This doesn't guarantee originality — it only checks public web content."
                : `Found ${totalActive} item${totalActive === 1 ? "" : "s"} to review.`}
              {searchAvailable && searchQueriesUsed > 0
                ? ` ${searchQueriesUsed} search ${searchQueriesUsed === 1 ? "query" : "queries"} were used.`
                : ""}
            </p>
            {!searchAvailable && (
              <p className="mt-1 text-xs text-gray-500">
                Web search was not available for this check. Only LLM-based analysis was performed.
              </p>
            )}
          </div>

          {/* Source match findings */}
          {sourceMatchFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-800 mb-2">
                🔗 Possible Source Matches
              </h3>
              <div className="space-y-3">
                {sourceMatchFindings.map((f) => {
                  const key = `${f.category}:${f.flaggedText}`;
                  return (
                    <SimilarityCard
                      key={key}
                      finding={f}
                      dismissed={!!dismissed[key]}
                      reviewed={!!reviewed[key]}
                      onDismiss={() => dismiss(key)}
                      onReviewed={() => markReviewed(key)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Paraphrase risk findings */}
          {paraphraseRiskFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                📝 Paraphrase Risk
              </h3>
              <div className="space-y-3">
                {paraphraseRiskFindings.map((f) => {
                  const key = `${f.category}:${f.flaggedText}`;
                  return (
                    <SimilarityCard
                      key={key}
                      finding={f}
                      dismissed={!!dismissed[key]}
                      reviewed={!!reviewed[key]}
                      onDismiss={() => dismiss(key)}
                      onReviewed={() => markReviewed(key)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Style inconsistency findings */}
          {styleFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                ✏️ Style Shifts
              </h3>
              <div className="space-y-3">
                {styleFindings.map((f) => {
                  const key = `${f.category}:${f.flaggedText}`;
                  return (
                    <SimilarityCard
                      key={key}
                      finding={f}
                      dismissed={!!dismissed[key]}
                      reviewed={!!reviewed[key]}
                      onDismiss={() => dismiss(key)}
                      onReviewed={() => markReviewed(key)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
