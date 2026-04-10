import Link from "next/link";
import { Suspense } from "react";
import { ApplicationsWorkspace } from "@/components/dashboard/ApplicationsWorkspace";

export default function ApplicationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">My jobs</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Find ideas above, then track each role below. <strong className="font-medium text-zinc-400">Export CSV</strong>{" "}
        downloads your list for Excel or Google Sheets. Use <strong className="font-medium text-zinc-400">Apply yourself</strong>{" "}
        on the company or LinkedIn site—Daubo never clicks &ldquo;submit&rdquo; for you.
      </p>
      <div className="mt-8 sm:mt-10">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-8 text-sm text-zinc-500">
              Loading…
            </div>
          }
        >
          <ApplicationsWorkspace />
        </Suspense>
      </div>
      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/dashboard#discover" className="text-sm font-semibold text-emerald-400 hover:underline">
          Discover on home ↗
        </Link>
        <Link href="/dashboard" className="text-sm font-semibold text-zinc-400 hover:text-emerald-400 hover:underline">
          ← Dashboard home
        </Link>
      </div>
    </div>
  );
}
