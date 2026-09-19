// ============================================================
// Report section — expandable card grouping findings by category
//
// Accepts children (rendered inside the section body) so the
// parent can pass whatever card layout it needs.
// ============================================================

"use client";

import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  count: number;
  icon: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  children: ReactNode;
}

export default function ReportSection({
  title,
  description,
  count,
  icon,
  bgClass,
  borderClass,
  textClass,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`rounded-md border ${borderClass} bg-white shadow-sm`}>
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold ${bgClass} ${textClass}`}
          >
            {count}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {icon} {title}
            </h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${
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

      {/* Section body */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">{children}</div>
      )}
    </div>
  );
}