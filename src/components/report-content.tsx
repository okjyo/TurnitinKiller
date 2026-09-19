// ============================================================
// ReportContent — main interactive report UI (client component)
//
// Owns all client-side state: submission readiness, positive
// observations, checklist, localStorage dismiss/review.
// ============================================================

"use client";

import { useMemo } from "react";
import type { Finding, Severity, FindingCategory } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS } from "@/lib/constants";
import {
  useReportState,
  filterActiveFindings,
  getSubmissionReadiness,
  getPositiveObservations,
  getChecklist,
} from "@/hooks/use-report-state";
import FindingCard from "@/components/finding-card";
import ReportSection from "@/components/report-section";
import ReanalyzeButton from "@/components/reanalyze-button";
import Link from "next/link";

// ── colours per severity (used for top-level summary badges) ───
const SEVERITY_BADGE: Record<Severity, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-amber-50 text-amber-800 border-amber-200", text: "", label: "Address first" },
  medium: { bg: "bg-sky-50 text-sky-800 border-sky-200", text: "", label: "Worth reviewing" },
  low: { bg: "bg-gray-100 text-gray-600 border-gray-200", text: "", label: "Optional polish" },
};

const DOT_COLORS: Record<Severity, string> = {
  high: "bg-amber-500",
  medium: "bg-sky-500",
  low: "bg-gray-400",
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "citation-missing": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  "citation-orphan": { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800" },
  "bibliography-orphan": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800" },
  "generic-paragraph": { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  "structural-issue": { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" },
};

const CATEGORY_ICONS: Record<string, string> = {
  "citation-missing": "📚",
  "citation-orphan": "🔗",
  "bibliography-orphan": "📖",
  "generic-paragraph": "💬",
  "structural-issue": "🏗️",
};

// ── Readiness banner ──────────────────────────────────────────
function ReadinessBanner({ level }: { level: "ready" | "review" | "issues" }) {
  const configs = {
    ready: {
      bg: "bg-green-50 border-green-200",
      text: "text-green-800",
      heading: "Likely ready to submit",
      detail: "No high-priority issues were found. Review optional polish if you'd like.",
    },
    review: {
      bg: "bg-sky-50 border-sky-200",
      text: "text-sky-800",
      heading: "A few things to review",
      detail: "Nothing urgent, but addressing these will strengthen your paper.",
    },
    issues: {
      bg: "bg-amber-50 border-amber-200",
      text: "text-amber-800",
      heading: "Some items to address",
      detail: "Please address the high-priority findings before submitting.",
    },
  };
  const c = configs[level];
  return (
    <div className={`rounded-lg border p-4 ${c.bg}`}>
      <h2 className={`text-base font-semibold ${c.text}`}>{c.heading}</h2>
      <p className={`mt-1 text-sm ${c.text} opacity-80`}>{c.detail}</p>
    </div>
  );
}

// ── Positive observations ─────────────────────────────────────
function PositiveObservations({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <h3 className="text-sm font-semibold text-green-800">What you did well</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-green-700">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Submission checklist ──────────────────────────────────────
function SubmissionChecklist({
  items,
  checked,
  onToggle,
}: {
  items: string[];
  checked: Record<number, boolean>;
  onToggle: (i: number) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-800">Final checklist</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked[i] ?? false}
                onChange={() => onToggle(i)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span
                className={`text-sm ${
                  checked[i]
                    ? "text-gray-400 line-through"
                    : "text-gray-700 group-hover:text-gray-900"
                }`}
              >
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
interface Props {
  reportId: string;
  documentId: string;
  summary: string;
  findings: Finding[];
  rawText: string;
  bibliographyText: string;
}

export default function ReportContent({
  reportId,
  documentId,
  summary,
  findings,
  rawText,
  bibliographyText,
}: Props) {
  const {
    dismissed,
    reviewed,
    checklist,
    dismiss,
    undoDismiss,
    markReviewed,
    toggleChecklist,
  } = useReportState(reportId);

  // ── Derived data ──────────────────────────────────────────────
  const activeFindings = useMemo(
    () => filterActiveFindings(findings, dismissed),
    [findings, dismissed]
  );

  const readiness = useMemo(
    () => getSubmissionReadiness(activeFindings),
    [activeFindings]
  );

  const positives = useMemo(
    () => getPositiveObservations(activeFindings),
    [activeFindings]
  );

  const checklistItems = useMemo(
    () => getChecklist(activeFindings),
    [activeFindings]
  );

  // ── Group active findings by category ─────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, Finding[]>();
    for (const f of activeFindings) {
      if (!map.has(f.category)) {
        map.set(f.category, []);
      }
      map.get(f.category)!.push(f);
    }
    return map;
  }, [activeFindings]);

  const totalDismissed = findings.length - activeFindings.length;

  return (
    <div className="space-y-6">
      {/* ── Submission readiness ─────────────────────────────────── */}
      <ReadinessBanner level={readiness} />

      {/* ── Overall summary ──────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800">Summary</h3>
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">{summary}</p>
      </div>

      {/* ── Severity quick-reference ─────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {(["high", "medium", "low"] as Severity[]).map((sev) => {
          const count = activeFindings.filter((f) => f.severity === sev).length;
          const badge = SEVERITY_BADGE[sev];
          return count > 0 ? (
            <span
              key={sev}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.bg}`}
            >
              {count} {badge.label}
            </span>
          ) : null;
        })}
      </div>

      {/* ── Positive observations ────────────────────────────────── */}
      <PositiveObservations items={positives} />

      {/* ── Findings by category (or explicit empty state) ───────── */}
      {activeFindings.length === 0 ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-5 w-5 text-green-600"
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
          </div>
          <h3 className="text-base font-semibold text-green-800">
            No issues found — nice work
          </h3>
          <p className="mt-1 text-sm text-green-700">
            {findings.length === 0
              ? "Your paper looks good. Review the checklist below before submitting."
              : `All ${findings.length} finding${findings.length === 1 ? " was" : "s were"} dismissed. You can restore them with the button below.`}
          </p>
        </div>
      ) : (
      <div className="space-y-4">
        {(
          [
            "citation-missing",
            "citation-orphan",
            "bibliography-orphan",
            "generic-paragraph",
            "structural-issue",
          ] as string[]
        ).map(
          (catId) => {
            const items = grouped.get(catId);
            if (!items || items.length === 0) return null;
            const colors = CATEGORY_COLORS[catId] ?? {
              bg: "bg-gray-50",
              border: "border-gray-200",
              text: "text-gray-700",
            };
            return (
              <ReportSection
                key={catId}
                title={CATEGORY_LABELS[catId]}
                description={CATEGORY_DESCRIPTIONS[catId]}
                count={items.length}
                icon={CATEGORY_ICONS[catId]}
                bgClass={colors.bg}
                borderClass={colors.border}
                textClass={colors.text}
              >
                <div className="space-y-3">
                  {items.map((f) => {
                    const key = `${f.category}:${f.flaggedText}`;
                    return (
                      <FindingCard
                        key={key}
                        finding={f}
                        dismissed={!!dismissed[key]}
                        reviewed={!!reviewed[key]}
                        onDismiss={() => dismiss(key)}
                        onReviewed={() => markReviewed(key)}
                        dotColor={DOT_COLORS[f.severity]}
                      />
                    );
                  })}
                </div>
              </ReportSection>
            );
          }
        )}
      </div>
      )}

      {/* ── Submission checklist ─────────────────────────────────── */}
      <SubmissionChecklist
        items={checklistItems}
        checked={checklist}
        onToggle={toggleChecklist}
      />

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-gray-100">
        <ReanalyzeButton
          documentId={documentId}
          rawText={rawText}
          bibliographyText={bibliographyText}
        />
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Back to dashboard
        </Link>
        {totalDismissed > 0 && (
          <button
            onClick={undoDismiss}
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition"
          >
            Show {totalDismissed} dismissed
          </button>
        )}
      </div>
    </div>
  );
}