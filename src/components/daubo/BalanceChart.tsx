"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const frames = ["1W", "1M", "3M", "1Y"];

/** Illustrative series only (not historic metrics). Baseline reflects saved + résumé-match hints. */
const makeData = (savedHint: number | null, matchHint: number | null) => {
  const s = savedHint != null && savedHint > 0 ? savedHint : 0;
  const m = matchHint != null && matchHint > 0 ? matchHint : 0;
  const base = 40 + Math.min(s * 2, 36) + Math.min(m * 1.2, 28);
  return Array.from({ length: 24 }, (_, i) => ({
    t: `${i + 1}`,
    v: base + Math.sin(i / 3) * 8 + i * 1.2,
  }));
};

export type BalanceChartResumeSection = "loading" | "prompt_add_resume" | "metrics";

function resumeMatchBadgeText(
  pending: boolean,
  loading: boolean,
  count: number | null,
): string {
  if (pending) return "matching…";
  if (loading) return "loading";
  if (count === null) return "no run yet";
  if (count === 0) return "last run empty";
  return "from CV";
}

function resumeMatchBadgeTitle(
  pending: boolean,
  loading: boolean,
  count: number | null,
): string {
  if (pending) {
    return "Daubo is queuing or running a résumé match in the background.";
  }
  if (loading) return "Loading latest match.";
  if (count === null) return "No completed auto-match run yet.";
  if (count === 0) {
    return "Last run returned no structured listings—ensure OpenRouter/Adzuna are configured, or try Find role ideas.";
  }
  return "Structured listings from your most recent auto-match run (not yet saved as pipeline rows).";
}

export function BalanceChart({
  compact,
  trackedRoles,
  resumeMatchListings,
  resumeMatchLoading,
  resumeMatchPending = false,
  resumeSection = "prompt_add_resume",
}: {
  compact?: boolean;
  /** Rows in My jobs (pipeline) */
  trackedRoles?: number | null;
  /** Listings count from latest résumé auto-match run; null = no run */
  resumeMatchListings?: number | null;
  resumeMatchLoading?: boolean;
  /** True while POST trigger + poll is looking for a new match after an empty/missing run */
  resumeMatchPending?: boolean;
  /** loading: stats not ready; prompt_add_resume: no CV; metrics: show match counts */
  resumeSection?: BalanceChartResumeSection;
}) {
  const [range, setRange] = useState("1Y");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const matchHintForCurve =
    resumeSection === "metrics"
      ? resumeMatchPending
        ? Math.max(resumeMatchListings ?? 0, 1)
        : resumeMatchListings ?? null
      : null;
  const data = makeData(trackedRoles ?? null, matchHintForCurve);
  const h = compact ? 160 : 220;
  const gradId = useId().replace(/:/g, "");

  const showMatchMetrics = resumeSection === "metrics";
  const showResumePrompt = resumeSection === "prompt_add_resume";
  const showResumeLoading = resumeSection === "loading";

  const badgeText = resumeMatchBadgeText(
    resumeMatchPending,
    resumeMatchLoading ?? false,
    resumeMatchListings ?? null,
  );
  const badgeTitle = resumeMatchBadgeTitle(
    resumeMatchPending,
    resumeMatchLoading ?? false,
    resumeMatchListings ?? null,
  );

  // Recharts measures the DOM on mount; defer chart. Keep SSR + first client paint aligned (no #418).
  if (!mounted) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500">Pipeline overview</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Saved in My jobs
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {trackedRoles != null
                      ? `${trackedRoles} job${trackedRoles === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      trackedRoles != null ? "text-zinc-500" : "text-emerald-400/90"
                    }`}
                    title={
                      trackedRoles != null
                        ? "Rows in your pipeline (same as My jobs)"
                        : "Save roles under My jobs to populate this count"
                    }
                  >
                    {trackedRoles != null ? "pipeline" : "none yet"}
                  </span>
                </div>
              </div>
              {showResumeLoading ? (
                <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-3 sm:mt-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Latest résumé match
                  </p>
                  <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-zinc-800/60" aria-hidden />
                </div>
              ) : null}
              {showMatchMetrics ? (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Latest résumé match
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {resumeMatchLoading
                        ? "…"
                        : resumeMatchListings != null
                          ? `${resumeMatchListings} role${resumeMatchListings === 1 ? "" : "s"}`
                          : "—"}
                    </span>
                    <span
                      className={`text-xs font-medium ${resumeMatchPending ? "text-emerald-400/90" : "text-zinc-500"}`}
                      title={badgeTitle}
                    >
                      {badgeText}
                    </span>
                  </div>
                  {resumeMatchPending ? (
                    <p className="mt-1 text-[10px] leading-snug text-emerald-400/90">
                      Matching your résumé in the background—this count updates when a run finishes.
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                      Add matches to <span className="text-zinc-500">My jobs</span> to grow the saved count.
                      The curve below is illustrative, not a historical chart.
                    </p>
                  )}
                </div>
              ) : null}
              {showResumePrompt ? (
                <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-2 sm:mt-0">
                  <p className="text-[10px] leading-snug text-zinc-500">
                    <a href="/dashboard/resume" className="font-medium text-emerald-400/90 hover:underline">
                      Add a résumé
                    </a>{" "}
                    to run auto-match and see listing counts here.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex rounded-full border border-zinc-800 bg-black/40 p-0.5" aria-hidden>
            {frames.map((f) => (
              <span
                key={f}
                className="rounded-full px-3 py-1 text-[11px] font-semibold text-zinc-500"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-zinc-900/50" style={{ height: h }} aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-500">Pipeline overview</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Saved in My jobs
              </p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {trackedRoles != null
                    ? `${trackedRoles} job${trackedRoles === 1 ? "" : "s"}`
                    : "—"}
                </span>
                <span
                  className={`text-xs font-medium ${
                    trackedRoles != null ? "text-zinc-500" : "text-emerald-400/90"
                  }`}
                  title={
                    trackedRoles != null
                      ? "Rows in your pipeline (same as My jobs)"
                      : "Save roles under My jobs to populate this count"
                  }
                >
                  {trackedRoles != null ? "pipeline" : "none yet"}
                </span>
              </div>
            </div>
            {showResumeLoading ? (
              <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-3 sm:mt-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Latest résumé match
                </p>
                <div className="mt-2 h-8 w-24 animate-pulse rounded-md bg-zinc-800/60" aria-hidden />
              </div>
            ) : null}
            {showMatchMetrics ? (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Latest résumé match
                </p>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    {resumeMatchLoading
                      ? "…"
                      : resumeMatchListings != null
                        ? `${resumeMatchListings} role${resumeMatchListings === 1 ? "" : "s"}`
                        : "—"}
                  </span>
                  <span
                    className={`text-xs font-medium ${resumeMatchPending ? "text-emerald-400/90" : "text-zinc-500"}`}
                    title={badgeTitle}
                  >
                    {badgeText}
                  </span>
                </div>
                {resumeMatchPending ? (
                  <p className="mt-1 text-[10px] leading-snug text-emerald-400/90">
                    Matching your résumé in the background—this count updates when a run finishes.
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] leading-snug text-zinc-600">
                    Add matches to <span className="text-zinc-500">My jobs</span> to grow the saved count.
                    The curve below is illustrative, not a historical chart.
                  </p>
                )}
              </div>
            ) : null}
            {showResumePrompt ? (
              <div className="rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-2 sm:mt-0">
                <p className="text-[10px] leading-snug text-zinc-500">
                  <a href="/dashboard/resume" className="font-medium text-emerald-400/90 hover:underline">
                    Add a résumé
                  </a>{" "}
                  to run auto-match and see listing counts here.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex rounded-full border border-zinc-800 bg-black/40 p-0.5">
          {frames.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setRange(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                range === f
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div
        className="mt-4 min-h-0 flex-1"
        style={{ height: h }}
        role="img"
        aria-label="Illustrative activity curve based on saved jobs and résumé match counts, not a historical time series"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v: number) => [
                `${v.toFixed(0)} (illustrative — not historic counts)`,
                "Activity",
              ]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#ffffff"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
