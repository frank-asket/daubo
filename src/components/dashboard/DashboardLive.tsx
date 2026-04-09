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
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { JobDiscoverPanel } from "@/components/dashboard/JobDiscoverPanel";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { dauboBffUrl } from "@/lib/daubo-api";

const STATUS_ORDER = [
  "draft",
  "shortlisted",
  "package_ready",
  "ready_to_apply",
  "applied",
  "interview",
  "offer",
  "closed",
] as const;
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  shortlisted: "Shortlisted",
  package_ready: "Package ready",
  ready_to_apply: "Ready to apply",
  ready: "Ready to apply",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

function repartitionFromApplications(apps: ApplicationSummary[]): { name: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const s of STATUS_ORDER) counts.set(s, 0);
  for (const a of apps) {
    const st = a.status === "ready" ? "ready_to_apply" : a.status;
    const key = (STATUS_ORDER as readonly string[]).includes(st) ? st : "draft";
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
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">Pipeline</span>
        <span className="mt-1 block font-normal text-zinc-500">
          Human apply · stages · Gmail draft from handoff
        </span>
      </Link>
      <Link
        href="/dashboard/settings"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">Connect Gmail</span>
        <span className="mt-1 block font-normal text-zinc-500">
          OAuth · drafts only · you send from your inbox
        </span>
      </Link>
      <Link
        href="/dashboard/interviews"
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-300 transition hover:border-emerald-500/30 hover:text-white"
      >
        <span className="block text-emerald-400/90">Interview prep</span>
        <span className="mt-1 block font-normal text-zinc-500">
          LLM-generated questions after you apply
        </span>
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
      const list = (await r.json()) as ApplicationSummary[];
      setApplications(
        list.map((a) => ({
          ...a,
          status: a.status === "ready" ? "ready_to_apply" : a.status,
        })),
      );
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
      <DashboardOverview hasResume={stats?.has_resume ?? null} />
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
        onAddedToPipeline={() => {
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
