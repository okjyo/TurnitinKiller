// ============================================================
// Auth layout — centered card for login/signup
// ============================================================

import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Link href="/" className="mb-8 font-serif text-2xl font-bold text-brand-900">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-md rounded-md border border-gray-200 bg-white p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}
