// ============================================================
// Report section — expandable card grouping findings by category
// ============================================================

"use client";

import { useState } from "react";
import type { Finding } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "@/lib/constants";
import FindingCard from "./finding-card";

interface Props {
  category: string;
  findings: Finding[];
}

export default function ReportSection({ category, findings }: Props) {
  const [expanded, setExpanded] = useState(true);
  const label = CATEGORY_LABELS[category] || category;
  const description = CATEGORY_DESCRIPTIONS[category] || "";

  // Category-specific icon color
  const colorMap: Record<string, string> = {
    "citation-missing": "bg-amber-100 text-amber-700",
    "citation-orphan": "bg-orange-100 text-orange-700",
    "bibliography-orphan": "bg-purple-100 text-purple-700",
    "generic-paragraph": "bg-blue-100 text-blue-700",
    "structural-issue": "bg-gray-100 text-gray-700",
  };

  const dotColorMap: Record<string, string> = {
    "citation-missing": "bg-amber-500",
    "citation-orphan": "bg-orange-500",
    "bibliography-orphan": "bg-purple-500",
    "generic-paragraph": "bg-blue-500",
    "structural-issue": "bg-gray-500",
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${colorMap[category] || "bg-gray-100 text-gray-700"}`}
          >
            {findings.length}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Findings list */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {findings.map((finding, i) => (
            <FindingCard
              key={i}
              finding={finding}
              dotColor={dotColorMap[category] || "bg-gray-500"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
