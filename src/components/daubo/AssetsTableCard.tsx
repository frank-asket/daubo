"use client";

import { Loader2 } from "lucide-react";
import { jobStageLabel } from "@/lib/job-stages";

export type ApplicationSummary = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  job_url: string | null;
  updated_at: string;
};

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diffSec < 45) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  return d.toLocaleDateString();
}

export function AssetsTableCard({
  applications,
  loading,
  error,
  onRetry,
  title = "Saved roles",
}: {
  applications: ApplicationSummary[];
  loading?: boolean;
  error?: string | null;
  /** Shown as “Try again” when `error` is set */
  onRetry?: () => void;
  /** Card heading — job pipeline, not financial assets */
  title?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-0">
      <div className="border-b border-zinc-800/80 px-4 py-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">Recent rows from My jobs (same data as the full list)</p>
      </div>
      {error ? (
        <div
          className="flex flex-col gap-2 border-b border-amber-500/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="text-xs text-amber-200/95">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={() => onRetry()}
              className="shrink-0 self-start rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/20 sm:self-auto"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading jobs…
                  </span>
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-zinc-300">No jobs on your list yet</p>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500">
                    Use <strong className="text-zinc-400">Discover</strong> on the home page, or open{" "}
                    <a href="/dashboard/applications" className="font-semibold text-emerald-400 hover:underline">
                      My jobs
                    </a>{" "}
                    and add a title, company, and optional posting link—takes under a minute.
                  </p>
                </td>
              </tr>
            ) : (
              applications.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/80 last:border-0">
                  <td className="px-4 py-3 font-semibold text-white">
                    {r.job_url ? (
                      <a
                        href={r.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-400 hover:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      r.title
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{r.company}</td>
                  <td className="px-4 py-3 text-zinc-500">{r.location ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{jobStageLabel(r.status)}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatUpdated(r.updated_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
