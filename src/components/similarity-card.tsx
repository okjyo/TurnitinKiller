// ============================================================
// Similarity card — displays a single similarity / originality finding
//
// Similar to FindingCard but with:
// - "Possible Source Match" / "Paraphrase Risk" / "Style Shift" labels
// - Clickable source URL (for exact matches)
// - Different color scheme (red for exact, yellow for paraphrase, gray for style)
//
// FRAMING: coaching language, never accusatory.
// ============================================================

"use client";

import { useState } from "react";
import type { Finding } from "@/lib/types";

interface Props {
  finding: Finding;
  dismissed: boolean;
  reviewed: boolean;
  onDismiss: () => void;
  onReviewed: () => void;
}

const CATEGORY_STYLES: Record<
  string,
  { bg: string; border: string; text: string; label: string; icon: string }
> = {
  "source-match": {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    label: "Possible Source Match",
    icon: "🔗",
  },
  "paraphrase-risk": {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-800",
    label: "Paraphrase Risk",
    icon: "📝",
  },
  "style-inconsistency": {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-700",
    label: "Style Shift",
    icon: "✏️",
  },
};

const SEVERITY_STYLES: Record<
  string,
  { bg: string; text: string; label: string; matterText: string }
> = {
  high: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    label: "Address first",
    matterText:
      "This passage closely matches a public source. Please verify and add a citation if you used it.",
  },
  medium: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    label: "Worth reviewing",
    matterText:
      "This passage may be too close to a source. Consider rewriting in your own words.",
  },
  low: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: "Optional polish",
    matterText:
      "This is a minor style inconsistency — review it to make sure it's your own writing.",
  },
};

export default function SimilarityCard({
  finding,
  dismissed,
  reviewed,
  onDismiss,
  onReviewed,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  const category = CATEGORY_STYLES[finding.category] ?? CATEGORY_STYLES["source-match"];
  const severity = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium;

  if (dismissed) return null;

  return (
    <div
      className={`rounded-md border p-4 transition ${
        reviewed
          ? "border-gray-100 bg-gray-50/50 opacity-70"
          : `${category.border} ${category.bg}`
      }`}
    >
      {/* Header: expand toggle + actions */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">{category.icon}</span>
        <div className="flex-1 min-w-0">
          {/* Clickable header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-start justify-between gap-2 text-left"
          >
            <blockquote className="border-l-2 border-gray-300 pl-3 text-sm text-gray-700 italic break-words overflow-hidden">
              &ldquo;{finding.flaggedText}&rdquo;
            </blockquote>
            <svg
              className={`mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {/* Expanded content */}
          {expanded && (
            <div className="mt-3 space-y-3">
              {/* Category badge */}
              <div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${category.bg} ${category.text} border ${category.border}`}
                >
                  {category.label}
                </span>
              </div>

              {/* Why we flagged this */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Why we flagged this
                </h4>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                  {finding.issue}
                </p>
              </div>

              {/* Source link (for exact matches) */}
              {finding.sourceUrl && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Source found
                  </h4>
                  <a
                    href={finding.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    <svg
                      className="h-3.5 w-3.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                    {finding.sourceUrl}
                  </a>
                </div>
              )}

              {/* Why this matters */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Why this matters
                </h4>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {severity.matterText}
                </p>
              </div>

              {/* Suggested fix */}
              {finding.suggestedFix && (
                <div className="rounded-md bg-brand-50 border border-brand-100 p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                    Suggested fix
                  </h4>
                  <p className="mt-1 text-sm text-brand-800 leading-relaxed">
                    {finding.suggestedFix}
                  </p>
                </div>
              )}

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${severity.bg} ${severity.text}`}
                >
                  {severity.label}
                </span>
              </div>
            </div>
          )}

          {/* Action buttons — always visible */}
          <div className="mt-3 flex items-center gap-2">
            {!reviewed ? (
              <button
                onClick={onReviewed}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition"
                title="Mark as reviewed"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Mark reviewed
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
                Reviewed
              </span>
            )}
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
              title="Dismiss this finding"
            >
              <svg
                className="h-3.5 w-3.5"
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
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
