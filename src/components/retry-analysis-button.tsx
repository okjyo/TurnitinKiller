// ============================================================
// Retry analysis button — client component for failed documents
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  documentId: string;
}

export default function RetryAnalysisButton({ documentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reanalyze/${documentId}`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Retry failed. Please try again.");
        setLoading(false);
        return;
      }

      // Success — refresh the dashboard to show new status
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition disabled:opacity-50"
      >
        {loading ? "Retrying…" : "Retry Analysis"}
      </button>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}