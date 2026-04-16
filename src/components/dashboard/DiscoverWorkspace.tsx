"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JobDiscoverPanel, type DiscoverResult } from "@/components/dashboard/JobDiscoverPanel";
import { ResumeMatchHighlightsCard } from "@/components/dashboard/ResumeMatchHighlightsCard";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { dauboBffUrl } from "@/lib/daubo-api";

type MatchSnapshot = {
  count: number;
  highFit: number;
  avgFit: number | null;
};

function snapshotFromRun(run: DiscoverResult | null): MatchSnapshot {
  const listings = run?.result?.parsed_listings ?? [];
  const scores = listings
    .map((listing) => (typeof listing.fit_score === "number" ? listing.fit_score : null))
    .filter((score): score is number => score != null);
  return {
    count: listings.length,
    highFit: scores.filter((score) => score >= 4).length,
    avgFit: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  };
}

function MetricCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-[22px] border border-zinc-200 bg-[#f1f0e9] px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-[2rem] font-semibold leading-none text-zinc-950">{value}</p>
      <p className="mt-2 text-sm text-zinc-600">{caption}</p>
    </div>
  );
}

export function DiscoverWorkspace() {
  const { stats, reload: reloadStats } = useDashboardStats();
  const [latestRun, setLatestRun] = useState<DiscoverResult | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
      if (!r.ok) {
        setLatestRun(null);
        return;
      }
      const j = (await r.json()) as { run: DiscoverResult | null };
      setLatestRun(j.run ?? null);
    } catch {
      setLatestRun(null);
    }
  }, []);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const metrics = useMemo(() => snapshotFromRun(latestRun), [latestRun]);
  const applied = stats?.career?.applied_or_interview ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(24,24,27,0.04)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-zinc-950">Job discovery</h1>
            <p className="mt-1 text-lg text-zinc-700">
              AI-matched roles based on your resume and preferences
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/resume"
              className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
            >
              Update resume
            </Link>
            <Link
              href="/dashboard/pipeline"
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Open pipeline
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Evaluated"
            value={String(metrics.count)}
            caption="recent matched opportunities"
          />
          <MetricCard
            label="High fit ≥4.0"
            value={String(metrics.highFit)}
            caption="ready to review"
          />
          <MetricCard
            label="Avg fit score"
            value={metrics.avgFit == null ? "—" : metrics.avgFit.toFixed(1)}
            caption="across all roles"
          />
          <MetricCard label="Applied" value={String(applied)} caption="awaiting response" />
        </div>
      </section>

      <ResumeMatchHighlightsCard
        onPipelineUpdated={() => {
          void reloadStats();
          void loadLatest();
        }}
      />

      <JobDiscoverPanel
        onDiscoveryComplete={() => {
          void reloadStats();
          void loadLatest();
        }}
        onAddedToPipeline={() => {
          void reloadStats();
        }}
      />
    </div>
  );
}
