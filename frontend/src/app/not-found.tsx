import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6FB] dark:bg-slate-700 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0095D9]">FIA Smart ACR / PER</p>
        <h1 className="mt-3 text-2xl font-bold text-[#111827] dark:text-slate-100">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The requested screen is not available in this workspace or the link is no longer valid.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg bg-[#1A1C6E] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2D308F]"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
