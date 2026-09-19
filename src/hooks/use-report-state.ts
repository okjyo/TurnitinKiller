// ============================================================
// useReportState — per-report client-side state (localStorage)
//
// Tracks dismissed findings, reviewed findings, and checklist
// progress. All state is per-viewer (localStorage key scoped
// by report ID).
// ============================================================

"use client";

import { useState, useCallback, useMemo } from "react";
import type { Finding } from "@/lib/types";

interface ReportState {
  dismissed: Record<string, boolean>;
  reviewed: Record<string, boolean>;
  checklist: Record<number, boolean>;
}

const STORAGE_PREFIX = "report-state-";

function loadState(reportId: string): ReportState {
  if (typeof window === "undefined") {
    return { dismissed: {}, reviewed: {}, checklist: {} };
  }
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${reportId}`);
    if (!raw) return { dismissed: {}, reviewed: {}, checklist: {} };
    const parsed = JSON.parse(raw);
    return {
      dismissed: parsed.dismissed ?? {},
      reviewed: parsed.reviewed ?? {},
      checklist: parsed.checklist ?? {},
    };
  } catch {
    return { dismissed: {}, reviewed: {}, checklist: {} };
  }
}

function saveState(reportId: string, state: ReportState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${reportId}`, JSON.stringify(state));
  } catch {
    /* quota exceeded — fail silently */
  }
}

export function useReportState(reportId: string) {
  const [state, setState] = useState<ReportState>(() => loadState(reportId));

  const update = useCallback(
    (updater: (prev: ReportState) => ReportState) => {
      setState((prev) => {
        const next = updater(prev);
        saveState(reportId, next);
        return next;
      });
    },
    [reportId]
  );

  const dismiss = useCallback(
    (key: string) => {
      update((prev) => ({
        ...prev,
        dismissed: { ...prev.dismissed, [key]: true },
      }));
    },
    [update]
  );

  const undoDismiss = useCallback(() => {
    update((prev) => ({ ...prev, dismissed: {} }));
  }, [update]);

  const markReviewed = useCallback(
    (key: string) => {
      update((prev) => ({
        ...prev,
        reviewed: { ...prev.reviewed, [key]: true },
      }));
    },
    [update]
  );

  const toggleChecklist = useCallback(
    (index: number) => {
      update((prev) => ({
        ...prev,
        checklist: {
          ...prev.checklist,
          [index]: !prev.checklist[index],
        },
      }));
    },
    [update]
  );

  return {
    dismissed: state.dismissed,
    reviewed: state.reviewed,
    checklist: state.checklist,
    dismiss,
    undoDismiss,
    markReviewed,
    toggleChecklist,
  };
}

// ── Derived helpers (used by ReportContent) ───────────────────

export function filterActiveFindings(
  findings: Finding[],
  dismissed: Record<string, boolean>
): Finding[] {
  return findings.filter((f) => {
    const key = `${f.category}:${f.flaggedText}`;
    return !dismissed[key];
  });
}

export function getSubmissionReadiness(
  findings: Finding[]
): "ready" | "review" | "issues" {
  const high = findings.some((f) => f.severity === "high");
  const medium = findings.some((f) => f.severity === "medium");
  if (high) return "issues";
  if (medium) return "review";
  return "ready";
}

export function getPositiveObservations(findings: Finding[]): string[] {
  const cats = new Set(findings.map((f) => f.category));
  const positives: string[] = [];

  if (!cats.has("citation-missing") && !cats.has("citation-orphan")) {
    positives.push("All in-text citations appear properly matched.");
  }
  if (!cats.has("bibliography-orphan")) {
    positives.push("Every bibliography entry is cited in your text.");
  }
  if (!cats.has("generic-paragraph")) {
    positives.push("Paragraphs appear well-supported with specific evidence.");
  }
  if (!cats.has("structural-issue")) {
    positives.push("No structural formatting issues were found.");
  }

  return positives;
}

export function getChecklist(findings: Finding[]): string[] {
  const cats = new Set(findings.map((f) => f.category));
  const items: string[] = [];

  if (cats.has("citation-missing") || cats.has("citation-orphan")) {
    items.push("Fix citation issues flagged in the report");
  }
  if (cats.has("bibliography-orphan")) {
    items.push("Cite unused bibliography entries or remove them");
  }
  if (cats.has("generic-paragraph")) {
    items.push("Strengthen paragraphs flagged as generic");
  }
  if (cats.has("structural-issue")) {
    items.push("Address formatting issues");
  }

  items.push("Read through your final draft before submitting");

  return items;
}