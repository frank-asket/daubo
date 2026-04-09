"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BalanceChart } from "@/components/daubo/BalanceChart";
import { QuickSwapCard } from "@/components/daubo/QuickSwapCard";
import {
  AssetsTableCard,
  type ApplicationSummary,
} from "@/components/daubo/AssetsTableCard";
import { RepartitionCard } from "@/components/daubo/RepartitionCard";
import { JobDiscoverPanel } from "@/components/dashboard/JobDiscoverPanel";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { dauboBffUrl } from "@/lib/daubo-api";

const STATUS_ORDER = ["draft", "ready", "applied", "interview", "offer", "closed"] as const;
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready for review",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

function repartitionFromApplications(apps: ApplicationSummary[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const s of STATUS_ORDER) counts.set(s, 0);
  for (const a of apps) {
    const key = (STATUS_ORDER as readonly string[]).includes(a.status) ? a.status : "draft";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return STATUS_ORDER.map((s) => ({
    name: STATUS_LABEL[s],
    value: counts.get(s) ?? 0,
  }));
}

function BottomRow() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        href="/dashboard/applications"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
      >
        Recent applications → manage pipeline
      </Link>
      <Link
        href="/dashboard"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
      >
        Job discovery → run a new search
      </Link>
      <Link
        href="/dashboard/support"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
      >
        Help & resources → support
      </Link>
    </div>
  );
}

export function DashboardLive() {
  const { stats, error: statsError, reload: reloadStats } = useDashboardStats();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);

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
        setAppsError(msg ?? `Applications ${r.status}`);
        setApplications([]);
        return;
      }
      setApplications((await r.json()) as ApplicationSummary[]);
    } catch {
      setAppsError("Could not load applications");
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const segments = useMemo(
    () => repartitionFromApplications(applications),
    [applications],
  );

  return (
    <div className="space-y-4">
      {statsError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {statsError}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <BalanceChart compact trackedRoles={stats?.application_count ?? null} />
        </div>
        <div className="lg:col-span-2">
          <QuickSwapCard compact />
        </div>
      </div>
      {stats && !stats.has_resume ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
          Add your resume in{" "}
          <a href="/dashboard/resume" className="font-semibold text-emerald-400 hover:underline">
            Resume
          </a>{" "}
          so Daubo can tailor applications to each role.
        </p>
      ) : null}
      <JobDiscoverPanel
        onDiscoveryComplete={() => {
          reloadStats();
          loadApplications();
        }}
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssetsTableCard
            applications={applications.slice(0, 8)}
            loading={appsLoading}
            error={appsError}
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
