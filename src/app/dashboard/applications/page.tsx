import Link from "next/link";
import { Suspense } from "react";
import { ApplicationsBoard } from "@/components/dashboard/ApplicationsBoard";

export default function ApplicationsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">Applications</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Track stages from discovery through apply. Use <strong className="font-medium text-zinc-400">Human apply</strong> to
        open drafts and complete submissions on the employer&apos;s or LinkedIn&apos;s official site—nothing
        sends without your action.
      </p>
      <div className="mt-8 sm:mt-10">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-8 text-sm text-zinc-500">
              Loading pipeline…
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
        ← Back to overview
      </Link>
    </div>
  );
}
