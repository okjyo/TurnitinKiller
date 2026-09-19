// ============================================================
// Protected layout — nav bar + session check
// ============================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/constants";
import LogoutButton from "@/components/logout-button";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          {/* Top row: app name + logout (always visible) */}
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="font-serif text-base font-bold text-brand-900 sm:text-lg">
              {APP_NAME}
            </Link>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-gray-500 sm:inline">{user.email}</span>
              <LogoutButton />
            </div>
          </div>
          {/* Bottom row: nav links + email (mobile-friendly) */}
          <div className="mt-2 flex items-center gap-4 sm:mt-0 sm:hidden">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              My Papers
            </Link>
            <Link
              href="/analyze"
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              New Analysis
            </Link>
            <span className="ml-auto truncate text-xs text-gray-400">{user.email}</span>
          </div>
          {/* Desktop: inline nav links */}
          <div className="hidden items-center gap-5 sm:flex">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              My Papers
            </Link>
            <Link
              href="/analyze"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              New Analysis
            </Link>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
