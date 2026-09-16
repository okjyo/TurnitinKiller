// ============================================================
// Finding card — displays a single analysis finding
// Shows: flagged text (quoted), issue explanation, suggested fix
// ============================================================

"use client";

import { useState } from "react";
import type { Finding } from "@/lib/types";

interface Props {
  finding: Finding;
  dotColor: string;
}

export default function FindingCard({ finding, dotColor }: Props) {
  const [showFix, setShowFix] = useState(false);

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
      {/* Flagged text — quoted from the student's document */}
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <blockquote className="border-l-2 border-gray-300 pl-3 text-sm text-gray-700 italic">
            &ldquo;{finding.flaggedText}&rdquo;
          </blockquote>

          {/* Issue explanation */}
          <p className="mt-2 text-sm text-gray-600">{finding.issue}</p>

          {/* Suggested fix — collapsible */}
          {finding.suggestedFix && (
            <div className="mt-3">
              <button
                onClick={() => setShowFix(!showFix)}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 transition"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showFix ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
                {showFix ? "Hide suggestion" : "Show suggestion"}
              </button>
              {showFix && (
                <div className="mt-2 rounded-md bg-brand-50 p-3 text-sm text-brand-800">
                  <span className="font-medium">Suggestion: </span>
                  {finding.suggestedFix}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
