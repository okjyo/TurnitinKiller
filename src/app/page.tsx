// ============================================================
// Landing page — left-aligned hero + mock report preview
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
    <main className="min-h-screen bg-[#f5f6f8]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-serif text-xl font-bold text-brand-900">
          {APP_NAME}
        </span>
        <div className="flex items-center gap-5">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 transition"
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
                className="rounded-md bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 transition"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero — two columns */}
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-16 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy */}
          <div className="max-w-xl">
            <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-brand-900 sm:text-5xl">
              Know your writing
              <br />
              is truly yours.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-gray-600">
              {APP_TAGLINE}. Upload your draft and get specific, actionable
              coaching on citations, source use, and argument strength.
            </p>
            <p className="mt-3 text-base text-gray-500">
              Not a score. Not a percentage. Just clear guidance on what to fix
              and how.
            </p>

            <div className="mt-8 flex items-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="rounded-md bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-md bg-brand-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 transition"
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
          </div>

          {/* Right: mock report card */}
          <div className="hidden lg:block">
            <MockReportCard />
          </div>
        </div>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Inline mock — a mini report card showing what a finding looks like
// ─────────────────────────────────────────────

function MockReportCard() {
  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-lg shadow-gray-200/60">
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
        <blockquote className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
          &ldquo;Renewable energy adoption has increased by 40% globally since
          2015.&rdquo;
        </blockquote>
        <p className="mt-2 text-sm text-gray-700">
          This is a specific statistic that would benefit from a supporting
          citation. Where did this number come from?
        </p>
        <div className="mt-3 rounded bg-[#f0f4f8] px-3 py-2 text-sm text-brand-800">
          <span className="font-medium">Suggestion:</span> Add a citation after
          the claim, e.g. (IRENA, 2023), and include the full source in your
          reference list.
        </div>
      </div>

      {/* Finding 2 */}
      <div className="border-b border-gray-50 px-5 py-4">
        <blockquote className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
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
        <blockquote className="border-l-2 border-gray-300 pl-3 text-sm italic text-gray-600">
          &ldquo;This trend is expected to continue as organizations
          increasingly&hellip;&rdquo;
        </blockquote>
        <p className="mt-2 text-sm text-gray-500">
          Consider adding specific evidence&hellip;
        </p>
      </div>
    </div>
  );
}
