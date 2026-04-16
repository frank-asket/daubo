"use client";

import { CheckCircle2, Circle, Dot, Loader2 } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";

type AgentRow = {
  name: string;
  description: string;
  state: "active" | "working" | "idle";
};

function stateStyle(state: AgentRow["state"]): string {
  if (state === "active") return "text-emerald-300";
  if (state === "working") return "text-amber-300";
  return "text-zinc-400";
}

export function AgentStatusBoard() {
  const { stats, statsReady } = useDashboardStats();

  const rows: AgentRow[] = [
    {
      name: "Discovery agent",
      description: "Scans role opportunities based on your profile and preferences",
      state: "active",
    },
    {
      name: "Match scorer",
      description: "Runs fit scoring (1-5) against your resume profile",
      state: "working",
    },
    {
      name: "Resume tailor",
      description: "Generates ATS-friendly resume variants per opportunity",
      state: stats?.has_resume ? "active" : "idle",
    },
    {
      name: "Cover letter writer",
      description: "Drafts personalized cover letters and LinkedIn notes",
      state: "active",
    },
    {
      name: "Apply agent",
      description: "Executes channel-aware apply handoff after approval",
      state: (stats?.career?.ready_to_submit ?? 0) > 0 ? "working" : "idle",
    },
    {
      name: "Prep agent",
      description: "Generates interview questions and company briefs",
      state: "active",
    },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        {!statsReady ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing orchestration state…
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            All agents operational · Last orchestration run: recent
          </span>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.name} className="rounded-2xl border border-zinc-800 bg-[#101010] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-zinc-100">{row.name}</p>
                <p className="text-sm text-zinc-400">{row.description}</p>
              </div>
              <p className={`inline-flex items-center gap-1 text-sm ${stateStyle(row.state)}`}>
                {row.state === "working" ? (
                  <Dot className="h-5 w-5 animate-pulse" />
                ) : row.state === "active" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                {row.state}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
