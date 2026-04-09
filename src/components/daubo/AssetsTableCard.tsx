"use client";

import { Loader2 } from "lucide-react";

export type ApplicationSummary = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  job_url: string | null;
  updated_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready for review",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

function stageLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

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
}: {
  applications: ApplicationSummary[];
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-0">
      {error ? (
        <p className="px-4 py-3 text-xs text-red-400">{error}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading applications…
                  </span>
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No applications yet. Add one on{" "}
                  <a href="/dashboard/applications" className="text-emerald-400 hover:underline">
                    Applications
                  </a>{" "}
                  or run discovery below.
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
                  <td className="px-4 py-3 text-zinc-400">{stageLabel(r.status)}</td>
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
