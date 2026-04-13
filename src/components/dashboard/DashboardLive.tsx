"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BalanceChart } from "@/components/daubo/BalanceChart";
import { QuickSwapCard } from "@/components/daubo/QuickSwapCard";
import {
  AssetsTableCard,
  type ApplicationSummary,
} from "@/components/daubo/AssetsTableCard";
import { RepartitionCard } from "@/components/daubo/RepartitionCard";
import { AutopilotCard } from "@/components/dashboard/AutopilotCard";
import { CareerNextStepsCard } from "@/components/dashboard/CareerNextStepsCard";
import { GettingStartedCard } from "@/components/dashboard/GettingStartedCard";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { JobDiscoverPanel } from "@/components/dashboard/JobDiscoverPanel";
import { ResumeMatchHighlightsCard } from "@/components/dashboard/ResumeMatchHighlightsCard";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { countParsedListingsFromRun } from "@/lib/agent-match-run";
import { dauboBffUrl } from "@/lib/daubo-api";
import { JOB_STAGE_VALUES, jobStageLabel } from "@/lib/job-stages";
import type { BalanceChartResumeSection } from "@/components/daubo/BalanceChart";

const RESUME_MATCH_POLL_MS = 7000;
const RESUME_MATCH_POLL_MAX = 18;
const RESUME_MATCH_AUTO_CYCLES = 3;

function runFingerprint(run: unknown): string | null {
  if (run == null || typeof run !== "object") return null;
  const r = run as {
    id?: unknown;
    run_id?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    started_at?: unknown;
    finished_at?: unknown;
    status?: unknown;
  };
  const vals = [r.id, r.run_id, r.created_at, r.updated_at, r.started_at, r.finished_at, r.status]
    .map((v) => (typeof v === "string" || typeof v === "number" ? String(v) : ""))
    .filter(Boolean);
  return vals.length ? vals.join("|") : null;
}

function isTerminalRunStatus(run: unknown): boolean {
  if (run == null || typeof run !== "object") return false;
  const status = (run as { status?: unknown }).status;
  if (typeof status !== "string") return false;
  const s = status.toLowerCase();
  return s === "completed" || s === "done" || s === "failed" || s === "error" || s === "cancelled";
}

function repartitionFromApplications(apps: ApplicationSummary[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const s of JOB_STAGE_VALUES) counts.set(s, 0);
  for (const a of apps) {
    const st = a.status === "ready" ? "ready_to_apply" : a.status;
    const key = (JOB_STAGE_VALUES as readonly string[]).includes(st) ? st : "draft";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return JOB_STAGE_VALUES.map((s) => ({
    name: jobStageLabel(s),
    value: counts.get(s) ?? 0,
  }));
}

function BottomRow() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        href="/dashboard/applications"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">My jobs</span>
        <span className="mt-1 block font-normal text-zinc-500">
          Track stages, review drafts, apply on real sites
        </span>
      </Link>
      <Link
        href="/dashboard/settings"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">Gmail drafts</span>
        <span className="mt-1 block font-normal text-zinc-500">
          Save application emails as drafts—you send when ready
        </span>
      </Link>
      <Link
        href="/dashboard/interviews"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">Interview practice</span>
        <span className="mt-1 block font-normal text-zinc-500">
          Questions tailored to jobs you’ve applied for
        </span>
      </Link>
    </div>
  );
}

export function DashboardLive() {
  const { stats, statsReady, error: statsError, reload: reloadStats } = useDashboardStats();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [resumeMatchListings, setResumeMatchListings] = useState<number | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [resumeMatchPending, setResumeMatchPending] = useState(false);
  const resumeMatchBootstrapDone = useRef(false);

  const loadApplications = useCallback(async () => {
    setAppsError(null);
    setAppsLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as {
          detail?: unknown;
          error?: string;
        };
        const d = j.detail;
        let msg: string | null =
          typeof d === "string"
            ? d.trim() || null
            : d != null
              ? JSON.stringify(d)
              : null;
        if (!msg && typeof j.error === "string" && j.error.trim()) {
          msg = j.error.trim();
        }
        setAppsError(msg ?? "We couldn’t load your jobs. Try refreshing the page.");
        setApplications([]);
        return;
      }
      const list = (await r.json()) as ApplicationSummary[];
      setApplications(
        list.map((a) => ({
          ...a,
          status: a.status === "ready" ? "ready_to_apply" : a.status,
        })),
      );
    } catch {
      setAppsError("We couldn’t reach Daubo. Check your connection and try again.");
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, []);

  const loadAgentMatchLatest = useCallback(async () => {
    setMatchLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
      if (!r.ok) {
        setResumeMatchListings(null);
        return;
      }
      const j = (await r.json()) as { run: unknown };
      setResumeMatchListings(countParsedListingsFromRun(j.run));
    } catch {
      setResumeMatchListings(null);
    } finally {
      setMatchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    if (!statsReady) {
      resumeMatchBootstrapDone.current = false;
      return;
    }
    if (!stats?.has_resume) {
      resumeMatchBootstrapDone.current = false;
      setResumeMatchListings(null);
      setMatchLoading(false);
      setResumeMatchPending(false);
      return;
    }

    if (resumeMatchBootstrapDone.current) return;
    resumeMatchBootstrapDone.current = true;

    let cancelled = false;

    void (async () => {
      if (cancelled) return;
      setMatchLoading(true);
      setResumeMatchPending(false);
      try {
        const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
        if (cancelled) return;
        if (!r.ok) {
          if (!cancelled) {
            setResumeMatchListings(null);
            resumeMatchBootstrapDone.current = false;
          }
          return;
        }
        const j = (await r.json()) as { run: unknown };
        if (cancelled) return;
        let c = countParsedListingsFromRun(j.run);
        const initialFingerprint = runFingerprint(j.run);
        if (!cancelled) setResumeMatchListings(c);

        if (cancelled) return;
        setMatchLoading(false);

        if (c !== null && c > 0) return;

        let settled = false;
        for (let cycle = 0; cycle < RESUME_MATCH_AUTO_CYCLES; cycle++) {
          if (cancelled) return;
          setResumeMatchPending(true);
          try {
            await fetch(dauboBffUrl("v1/me/resume/trigger-auto-match"), {
              method: "POST",
              credentials: "same-origin",
            });
          } catch {
            /* ignore */
          }

          for (let i = 0; i < RESUME_MATCH_POLL_MAX - 1; i++) {
            if (cancelled) return;
            await new Promise((res) => setTimeout(res, RESUME_MATCH_POLL_MS));
            if (cancelled) return;
            const pr = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
            if (!pr.ok) continue;
            const pj = (await pr.json()) as { run: unknown };
            c = countParsedListingsFromRun(pj.run);
            if (!cancelled) setResumeMatchListings(c);
            const nextFingerprint = runFingerprint(pj.run);
            const changedRun =
              initialFingerprint != null &&
              nextFingerprint != null &&
              nextFingerprint !== initialFingerprint;
            if (c !== null && c > 0) {
              settled = true;
              break;
            }
            if (changedRun || isTerminalRunStatus(pj.run)) {
              settled = true;
              break;
            }
          }

          if (settled) break;
          if (cycle < RESUME_MATCH_AUTO_CYCLES - 1) {
            await new Promise((res) => setTimeout(res, 1500 * (cycle + 1)));
          }
        }
      } catch {
        if (!cancelled) {
          setResumeMatchListings(null);
          resumeMatchBootstrapDone.current = false;
        }
      } finally {
        if (!cancelled) {
          setMatchLoading(false);
          setResumeMatchPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statsReady, stats?.has_resume]);

  const refreshPipelineData = useCallback(() => {
    void reloadStats();
    void loadApplications();
    void loadAgentMatchLatest();
  }, [reloadStats, loadApplications, loadAgentMatchLatest]);

  const segments = useMemo(
    () => repartitionFromApplications(applications),
    [applications],
  );

  /** Prefer live list length when loaded so the chart matches My jobs after discover / auto-match (stats can lag one tick). */
  const trackedRolesCount = useMemo(() => {
    if (!appsLoading && !appsError) {
      return applications.length;
    }
    if (stats?.application_count != null) {
      return stats.application_count;
    }
    return null;
  }, [appsLoading, appsError, applications.length, stats?.application_count]);

  const resumeSection: BalanceChartResumeSection = !statsReady
    ? "loading"
    : !stats?.has_resume
      ? "prompt_add_resume"
      : "metrics";

  return (
    <div className="space-y-4">
      <DashboardOverview hasResume={stats?.has_resume ?? null} />
      <GettingStartedCard />
      <CareerNextStepsCard />
      <ResumeMatchHighlightsCard
        onPipelineUpdated={() => {
          refreshPipelineData();
        }}
      />
      {statsError ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-200 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p>{statsError}</p>
          <button
            type="button"
            onClick={() => void reloadStats()}
            className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-400/20"
          >
            Try again
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BalanceChart
            compact
            trackedRoles={trackedRolesCount}
            resumeMatchListings={resumeMatchListings}
            resumeMatchLoading={matchLoading}
            resumeMatchPending={resumeMatchPending}
            resumeSection={resumeSection}
          />
        </div>
        <div className="lg:col-span-2">
          <QuickSwapCard compact />
        </div>
      </div>
      {stats && !stats.has_resume ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
          Add your résumé in{" "}
          <a href="/dashboard/resume" className="font-semibold text-emerald-400 hover:underline">
            My résumé
          </a>{" "}
          so Daubo can tailor suggestions to each role.
        </p>
      ) : null}
      <AutopilotCard
        onAutopilotComplete={() => {
          refreshPipelineData();
        }}
      />
      <JobDiscoverPanel
        onDiscoveryComplete={() => {
          refreshPipelineData();
        }}
        onAddedToPipeline={() => {
          refreshPipelineData();
        }}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssetsTableCard
            applications={applications.slice(0, 8)}
            loading={appsLoading}
            error={appsError}
            onRetry={loadApplications}
          />
        </div>
        <div className="lg:col-span-2">
          <RepartitionCard segments={segments} />
        </div>
      </div>
      <BottomRow />
    </div>
  );
}
