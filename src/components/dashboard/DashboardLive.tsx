"use client";

import { useCallback, useEffect, useState } from "react";
import { BalanceChart } from "@/components/daubo/BalanceChart";
import { QuickSwapCard } from "@/components/daubo/QuickSwapCard";
import { AssetsTableCard } from "@/components/daubo/AssetsTableCard";
import { RepartitionCard } from "@/components/daubo/RepartitionCard";
import { JobDiscoverPanel } from "@/components/dashboard/JobDiscoverPanel";
import { dauboBffUrl } from "@/lib/daubo-api";

type Stats = { application_count: number; has_resume: boolean };

function BottomRow() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["Recent applications", "Job market", "Resources"].map((t) => (
        <div
          key={t}
          className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-6 text-sm font-semibold text-zinc-400"
        >
          {t}
        </div>
      ))}
    </div>
  );
}

export function DashboardLive() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/stats"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr((j as { detail?: string }).detail ?? `Stats ${r.status}`);
        return;
      }
      setStats((await r.json()) as Stats);
    } catch {
      setErr("Could not load dashboard stats");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {err ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {err}
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
      <JobDiscoverPanel onDiscoveryComplete={load} />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AssetsTableCard />
        </div>
        <div className="lg:col-span-2">
          <RepartitionCard />
        </div>
      </div>
      <BottomRow />
    </div>
  );
}
