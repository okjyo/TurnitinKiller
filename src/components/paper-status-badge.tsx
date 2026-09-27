// ============================================================
// PaperStatusBadge — client-side status indicator for a paper
//
// Reads checklist state from localStorage to determine whether
// all checklist items are checked. Falls back to the server-
// computed tier (from findings) when no checklist data exists.
// ============================================================

"use client";

import { useState, useEffect } from "react";

const STORAGE_PREFIX = "report-state-";

function getChecklistItems(categories: string[]): string[] {
  const cats = new Set(categories);
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

interface Props {
  reportId: string;
  categories: string[];
  findingCount: number;
  tier: "address" | "review" | "polish" | "clean";
}

export default function PaperStatusBadge({ reportId, categories, findingCount, tier }: Props) {
  const [allChecked, setAllChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${reportId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const checked: Record<number, boolean> = parsed.checklist ?? {};
      const items = getChecklistItems(categories);

      if (items.length > 0 && items.every((_, i) => checked[i])) {
        setAllChecked(true);
      }
    } catch {
      /* ignore */
    }
  }, [reportId, categories]);

  // If all checklist items are checked, override to "clean" tier
  const effectiveTier = allChecked ? "clean" : tier;

  const styles: Record<string, { dot: string; badge: string; label: string }> = {
    address: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700", label: `${findingCount} findings` },
    review:  { dot: "bg-sky-400",   badge: "bg-sky-50 text-sky-700",     label: `${findingCount} findings` },
    polish:  { dot: "bg-gray-300",  badge: "bg-gray-100 text-gray-600",  label: `${findingCount} findings` },
    clean:   { dot: "bg-green-400", badge: "bg-green-50 text-green-700", label: findingCount === 0 ? "Ready to submit" : "Checklist complete" },
  };

  const s = styles[effectiveTier];

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${s.dot}`} />
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.badge}`}>
        {s.label}
      </span>
    </div>
  );
}
