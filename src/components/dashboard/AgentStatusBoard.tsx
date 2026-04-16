"use client";

import { CheckCircle2, Circle, Dot, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type AgentRow = {
  agent_id: string;
  name: string;
  description: string;
  state: "active" | "working" | "idle";
  last_run_at?: string | null;
};

function stateStyle(state: AgentRow["state"]): string {
  if (state === "active") return "text-emerald-300";
  if (state === "working") return "text-amber-300";
  return "text-zinc-400";
}

function timeAgo(iso: string | null | undefined): string | null {
  const s = (iso || "").trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  const deltaMs = Date.now() - t;
  if (deltaMs < 0) return "just now";
  const mins = Math.floor(deltaMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentStatusBoard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [lastOrchestrationAt, setLastOrchestrationAt] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/agents/status"), { credentials: "same-origin" });
      if (!r.ok) {
        setError("Could not load agent status right now.");
        setRows([]);
        setLastOrchestrationAt(null);
        return;
      }
      const j = (await r.json()) as {
        last_orchestration_at: string | null;
        agents: AgentRow[];
      };
      setRows(Array.isArray(j.agents) ? j.agents : []);
      setLastOrchestrationAt(j.last_orchestration_at ?? null);
    } catch {
      setError("Could not load agent status right now.");
      setRows([]);
      setLastOrchestrationAt(null);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const orchestrationLabel = useMemo(() => {
    const ago = timeAgo(lastOrchestrationAt);
    if (!ago) return "recent";
    return ago;
  }, [lastOrchestrationAt]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing orchestration state…
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-2">
              <Circle className="h-4 w-4" />
              {error}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All agents operational · Last orchestration run: {orchestrationLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 hover:bg-emerald-400/15 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={2} />
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.agent_id || row.name} className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{row.name}</p>
                <p className="text-sm text-zinc-400">{row.description}</p>
                {row.last_run_at ? (
                  <p className="mt-2 text-xs text-zinc-500">Last run: {timeAgo(row.last_run_at) ?? "—"}</p>
                ) : (
                  <p className="mt-2 text-xs text-zinc-600">Last run: —</p>
                )}
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
