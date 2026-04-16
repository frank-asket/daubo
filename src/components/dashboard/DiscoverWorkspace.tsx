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
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-2 text-[2rem] font-semibold leading-none text-white">{value}</p>
      <p className="mt-2 text-sm text-zinc-500">{caption}</p>
    </div>
  );
}

export function DiscoverWorkspace() {
  const { stats, reload: reloadStats } = useDashboardStats();
  const [latestRun, setLatestRun] = useState<DiscoverResult | null>(null);
  const [matchStatus, setMatchStatus] = useState<"idle" | "queued" | "polling" | "ready" | "error">("idle");

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

  useEffect(() => {
    if (!stats?.has_resume) {
      setMatchStatus("idle");
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let polls = 0;

    const checkLatest = async (): Promise<boolean> => {
      try {
        const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
        if (!r.ok) return false;
        const j = (await r.json()) as { run: DiscoverResult | null };
        const run = j.run ?? null;
        setLatestRun(run);
        return Boolean(run?.result?.parsed_listings?.length);
      } catch {
        return false;
      }
    };

    void (async () => {
      const readyNow = await checkLatest();
      if (cancelled) return;
      if (readyNow) {
        setMatchStatus("ready");
        return;
      }

      setMatchStatus("queued");
      try {
        await fetch(dauboBffUrl("v1/me/resume/trigger-auto-match"), {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        if (!cancelled) setMatchStatus("error");
        return;
      }

      if (cancelled) return;
      setMatchStatus("polling");
      intervalId = setInterval(async () => {
        if (cancelled) return;
        polls += 1;
        const ready = await checkLatest();
        if (ready) {
          if (intervalId) clearInterval(intervalId);
          if (!cancelled) {
            setMatchStatus("ready");
            void reloadStats();
          }
          return;
        }
        if (polls >= 18) {
          if (intervalId) clearInterval(intervalId);
          if (!cancelled) setMatchStatus("idle");
        }
      }, 7000);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [reloadStats, stats?.has_resume]);

  const metrics = useMemo(() => snapshotFromRun(latestRun), [latestRun]);
  const applied = stats?.career?.applied_or_interview ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-white">Job discovery</h1>
            <p className="mt-1 text-lg text-zinc-500">
              AI-matched roles based on your resume and preferences
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/resume"
              className="rounded-full border border-zinc-700 bg-black px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              Update resume
            </Link>
            <Link
              href="/dashboard/pipeline"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
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
        {matchStatus === "queued" || matchStatus === "polling" ? (
          <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            Matching your uploaded resume to live opportunities… this can take around 1-2 minutes.
          </p>
        ) : null}
        {matchStatus === "error" ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Could not start auto-match right now. Try the Refresh action in Discover in a moment.
          </p>
        ) : null}
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
