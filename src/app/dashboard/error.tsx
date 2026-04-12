"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">Daubo workspace</p>
        <h1 className="text-xl font-semibold tracking-tight text-white">Something went wrong</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          This page couldn&apos;t load. Your sign-in is still safe—try again, or go back to the dashboard home.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left font-mono text-[11px] text-red-300/90">
            {error.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
        >
          Dashboard home
        </Link>
      </div>
    </div>
  );
}
