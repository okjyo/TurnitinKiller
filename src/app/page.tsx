// ============================================================
// Landing page — editorial hero + weighted report preview
//
// Visual direction: academic/editorial, "considered writing tool"
// not "generic AI startup". Warm cream background, paper texture,
// forest green accents, serif-heavy typography.
// ============================================================

import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

export default async function HomePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen paper-texture">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-serif text-xl font-bold text-brand-900">
          {APP_NAME}
        </span>
        <div className="flex items-center gap-5">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-brand-700 hover:text-brand-900 transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ─────────────────────────────────────────────
          HERO
          ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 lg:pt-32">
        <div className="grid items-start gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Left: editorial copy */}
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              Writing coach
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.1] tracking-tight text-brand-900 sm:text-5xl lg:text-[3.5rem]">
              Know your writing
              <br />
              is truly yours.
            </h1>
            <p className="mt-7 text-lg leading-relaxed text-gray-600">
              {APP_TAGLINE}. Upload your draft and get specific, actionable
              coaching on citations, source use, and argument strength.
            </p>

            <div className="mt-11 flex items-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="rounded-md bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-900/20 hover:bg-brand-700 transition"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-md bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-900/20 hover:bg-brand-700 transition"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-brand-700 hover:text-brand-900 transition"
                  >
                    Already have an account?
                  </Link>
                </>
              )}
            </div>

            {/* Editorial trust signals */}
            <div className="mt-14 flex items-center gap-6 border-t border-brand-100 pt-7">
              <div>
                <p className="font-serif text-lg font-bold text-brand-800">No&nbsp;AI&nbsp;scores</p>
                <p className="text-xs text-gray-500">We coach, not judge</p>
              </div>
              <div className="h-8 w-px bg-brand-100" />
              <div>
                <p className="font-serif text-lg font-bold text-brand-800">3-phase&nbsp;analysis</p>
                <p className="text-xs text-gray-500">Pattern + writing + merge</p>
              </div>
              <div className="h-8 w-px bg-brand-100" />
              <div>
                <p className="font-serif text-lg font-bold text-brand-800">Private</p>
                <p className="text-xs text-gray-500">Your drafts stay yours</p>
              </div>
            </div>

            {/* Core positioning line — do not soften */}
            <p className="mt-10 text-base text-gray-500 italic">
              Not a score. Not a percentage. Just clear guidance on what to fix
              and how.
            </p>
          </div>

          {/* Right: weighted mock report card */}
          <div className="hidden lg:block">
            <MockReportCard />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          HOW IT WORKS
          ───────────────────────────────────────────── */}
      <section className="border-t border-brand-100 bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              How it works
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Three checks, one clear report.
            </h2>
          </div>

          <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-16">
            {/* Step 1 */}
            <div className="flex flex-col">
              <span className="font-serif text-5xl font-bold text-brand-200">1</span>
              <h3 className="mt-4 font-serif text-xl font-bold text-brand-900">
                Deterministic Citation Check
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray-600">
                Exact-match citation and bibliography cross-referencing. Finds
                orphaned references, unmatched citations, and missing source
                lists — zero guesswork, pure pattern matching.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col">
              <span className="font-serif text-5xl font-bold text-brand-200">2</span>
              <h3 className="mt-4 font-serif text-xl font-bold text-brand-900">
                AI Writing Analysis
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray-600">
                Flags generic phrasing, unsupported claims, and paraphrase
                risk with plain-language reasoning. Every finding explains
                <em> why</em> it matters, not just <em>what</em> to fix.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col">
              <span className="font-serif text-5xl font-bold text-brand-200">3</span>
              <h3 className="mt-4 font-serif text-xl font-bold text-brand-900">
                Coaching Report
              </h3>
              <p className="mt-3 text-base leading-relaxed text-gray-600">
                Every finding comes with a specific suggested fix — add a
                citation, rewrite in your own words, strengthen with evidence.
                Never a score. Never a grade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          FEATURE COMPARISON
          ───────────────────────────────────────────── */}
      <section className="border-t border-brand-100">
        <div className="mx-auto max-w-4xl px-6 py-24 lg:py-32">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              What makes us different
            </p>
            <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Built to help you write better,<br className="hidden sm:block" />
              not just to catch you.
            </h2>
          </div>

          <div className="mt-16 overflow-hidden rounded-lg border border-gray-200">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-200">
              <div className="px-6 py-4" />
              <div className="border-l border-gray-200 px-6 py-4 text-center">
                <span className="font-serif text-base font-bold text-brand-900">
                  {APP_NAME}
                </span>
              </div>
              <div className="border-l border-gray-200 px-6 py-4 text-center">
                <span className="text-base font-medium text-gray-500">
                  Typical AI Detector
                </span>
              </div>
            </div>

            {/* Rows */}
            <ComparisonRow
              feature="Links to the actual source found"
              us={true}
              them={false}
              description="We show the URL we found, so you can verify it yourself."
            />
            <ComparisonRow
              feature="No score to obsess over"
              us={true}
              them={false}
              description="Just clear findings with explanations and fixes."
            />
            <ComparisonRow
              feature="Built to strengthen your argument"
              us={true}
              them={false}
              description="Every finding comes with a suggested fix, not just a flag."
            />
            <ComparisonRow
              feature="Honest about its own limits"
              us={true}
              them={false}
              description="Our disclaimer is always visible, not buried in a tooltip."
            />
            <ComparisonRow
              feature="Shows exact sentences with reasoning"
              us={true}
              them={true}
              description="Both surface the text — but we explain why it matters."
              last
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          FOOTER
          ───────────────────────────────────────────── */}
      <footer className="border-t border-brand-100 bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="font-serif text-sm font-bold text-brand-800">
              {APP_NAME}
            </span>
            <p className="text-xs text-gray-500">
              A writing coaching tool. Not a plagiarism detector, not an AI
              checker, not a grade.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────
// Comparison row component
// ─────────────────────────────────────────────

function ComparisonRow({
  feature,
  us,
  them,
  description,
  last = false,
}: {
  feature: string;
  us: boolean;
  them: boolean;
  description: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-3 ${last ? "" : "border-b border-gray-100"}`}
    >
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-900">{feature}</p>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      <div className="border-l border-gray-100 px-6 py-5 flex items-center justify-center">
        {us ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </div>
      <div className="border-l border-gray-100 px-6 py-5 flex items-center justify-center">
        {them ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>
        ) : (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mock report card — elevated, editorial feel
// ─────────────────────────────────────────────

function MockReportCard() {
  return (
    <div className="relative">
      {/* Subtle shadow layer for depth */}
      <div className="absolute -inset-1 rounded-lg bg-brand-900/5 blur-sm" />

      <div className="relative rounded-lg border border-gray-200 bg-white shadow-xl shadow-brand-900/10 overflow-hidden">
        {/* Green accent strip at top */}
        <div className="h-1 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />

        {/* Card header */}
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Citation Needed
            </span>
            <span className="ml-auto rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              3 findings
            </span>
          </div>
        </div>

        {/* Finding 1 */}
        <div className="border-b border-gray-50 px-5 py-4">
          <blockquote className="border-l-2 border-brand-200 pl-3 text-sm italic text-gray-600">
            &ldquo;Renewable energy adoption has increased by 40% globally since
            2015.&rdquo;
          </blockquote>
          <p className="mt-2 text-sm text-gray-700">
            This is a specific statistic that would benefit from a supporting
            citation. Where did this number come from?
          </p>
          <div className="mt-3 rounded bg-brand-50 px-3 py-2 text-sm text-brand-800">
            <span className="font-medium">Suggestion:</span> Add a citation after
            the claim, e.g. (IRENA, 2023), and include the full source in your
            reference list.
          </div>
        </div>

        {/* Finding 2 */}
        <div className="border-b border-gray-50 px-5 py-4">
          <blockquote className="border-l-2 border-brand-200 pl-3 text-sm italic text-gray-600">
            &ldquo;Studies show that remote work improves productivity across most
            industries.&rdquo;
          </blockquote>
          <p className="mt-2 text-sm text-gray-700">
            &ldquo;Studies show&rdquo; implies evidence — which studies? Name them
            so your reader can verify the claim.
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-xs font-medium text-brand-700">
              Show suggestion
            </span>
            <svg
              className="h-3 w-3 text-brand-600"
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
          </div>
        </div>

        {/* Finding 3 — faded teaser */}
        <div className="px-5 py-4 opacity-50">
          <blockquote className="border-l-2 border-brand-200 pl-3 text-sm italic text-gray-600">
            &ldquo;This trend is expected to continue as organizations
            increasingly&hellip;&rdquo;
          </blockquote>
          <p className="mt-2 text-sm text-gray-500">
            Consider adding specific evidence&hellip;
          </p>
        </div>
      </div>
    </div>
  );
}