import Link from "next/link";
import { Suspense } from "react";
import { ApplicationsBoard } from "@/components/dashboard/ApplicationsBoard";

export default function ApplicationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">My jobs</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Track each role from interest to applied. <strong className="font-medium text-zinc-400">Export CSV</strong>{" "}
        downloads your list for Excel or Google Sheets. Use <strong className="font-medium text-zinc-400">Apply yourself</strong>{" "}
        to open the real posting and submit on the company or LinkedIn site—Daubo never clicks
        &ldquo;submit&rdquo; for you.
      </p>
      <div className="mt-8 sm:mt-10">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-8 text-sm text-zinc-500">
              Loading your jobs…
            </div>
          }
        >
          <ApplicationsBoard />
        </Suspense>
      </div>
      <Link
        href="/dashboard"
        className="mt-10 inline-flex text-sm font-semibold text-emerald-400 hover:underline"
      >
        ← Back to home
      </Link>
    </div>
  );
}
