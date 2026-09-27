// ============================================================
// Recommendations section — high-level coaching advice
//
// Shows 2-4 prioritized recommendations that summarize
// the most important patterns across all findings.
// ============================================================

import type { Recommendation } from "@/lib/analysis/schema";

const PRIORITY_STYLES: Record<
  Recommendation["priority"],
  { badge: string; border: string; icon: string }
> = {
  high: {
    badge: "bg-red-50 text-red-700",
    border: "border-l-red-400",
    icon: "!",
  },
  medium: {
    badge: "bg-amber-50 text-amber-700",
    border: "border-l-amber-400",
    icon: "!",
  },
  low: {
    badge: "bg-blue-50 text-blue-700",
    border: "border-l-blue-400",
    icon: "i",
  },
};

export function Recommendations({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🎯</span>
        <h3 className="font-serif text-lg font-bold text-brand-900">
          Priority Recommendations
        </h3>
      </div>
      <p className="text-sm text-gray-600 mb-5">
        Based on the overall patterns in your paper, here are the most impactful
        changes you can make.
      </p>

      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <RecommendationCard key={i} recommendation={rec} />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const styles = PRIORITY_STYLES[recommendation.priority];

  return (
    <div
      className={`rounded-md border-l-4 ${styles.border} bg-gray-50 px-4 py-3`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${styles.badge} mt-0.5`}
        >
          {styles.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {recommendation.title}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {recommendation.description}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles.badge}`}
        >
          {recommendation.priority}
        </span>
      </div>
    </div>
  );
}