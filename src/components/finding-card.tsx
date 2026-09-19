// ============================================================
// Finding card — displays a single analysis finding
//
// Sections: flagged text → why flagged → why it matters → fix
// Actions: expand/collapse, mark as reviewed, dismiss
//
// FRAMING: severity reads as "priority to address" not a grade.
// ============================================================

"use client";

import { useState } from "react";
import type { Finding, Severity, FindingSource } from "@/lib/types";

interface Props {
  finding: Finding;
  dismissed: boolean;
  reviewed: boolean;
  onDismiss: () => void;
  onReviewed: () => void;
  dotColor: string;
}

const SEVERITY_STYLES: Record<
  Severity,
  { bg: string; text: string; label: string; matterText: string }
> = {
  high: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    label: "Address first",
    matterText:
      "This is one of the most important things to address before submission.",
  },
  medium: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    label: "Worth reviewing",
    matterText:
      "Addressing this will noticeably strengthen your paper.",
  },
  low: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    label: "Optional polish",
    matterText:
      "This is a minor improvement — your paper reads fine without it, but it's worth considering.",
  },
};

const SOURCE_STYLES: Record<FindingSource, { label: string; title: string }> = {
  deterministic: {
    label: "Pattern match",
    title: "Found by exact citation/reference matching",
  },
  llm: {
    label: "Writing analysis",
    title: "Found by AI review of your writing",
  },
};

export default function FindingCard({
  finding,
  dismissed,
  reviewed,
  onDismiss,
  onReviewed,
  dotColor,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  const severity = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium;
  const source = SOURCE_STYLES[finding.source] ?? SOURCE_STYLES.llm;

  if (dismissed) return null;

  return (
    <div
      className={`rounded-md border p-4 transition ${
        reviewed
          ? "border-gray-100 bg-gray-50/50 opacity-70"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      {/* Header: expand toggle + actions */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`}
        />
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
              {/* Why we flagged this */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Why we flagged this
                </h4>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                  {finding.issue}
                </p>
              </div>

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
                <span
                  className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500 border border-gray-100"
                  title={source.title}
                >
                  {source.label}
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