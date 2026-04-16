"use client";

import { CheckCircle2, Circle, Dot, Loader2, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type AgentRow = {
  agent_id: string;
  name: string;
  description: string;
  state: "active" | "working" | "idle";
  last_run_at?: string | null;
};

type Turn = { role: "user" | "assistant"; content: string };

const REQUIRED_AGENT_IDS = [
  "discovery_agent",
  "match_scorer",
  "resume_tailor",
  "cover_letter_writer",
  "apply_agent",
  "prep_agent",
  "pipeline_monitor",
  "orchestrator",
] as const;

const AGENT_FALLBACKS: Record<(typeof REQUIRED_AGENT_IDS)[number], Omit<AgentRow, "agent_id">> = {
  discovery_agent: {
    name: "Discovery agent",
    description: "Scans role opportunities based on your profile and preferences",
    state: "active",
  },
  match_scorer: {
    name: "Match scorer",
    description: "Runs fit scoring (1-5) against your resume profile",
    state: "active",
  },
  resume_tailor: {
    name: "Resume tailor",
    description: "Generates ATS-optimized resume variants per job description",
    state: "active",
  },
  cover_letter_writer: {
    name: "Cover letter writer",
    description: "Drafts personalized cover letters and LinkedIn notes",
    state: "active",
  },
  apply_agent: {
    name: "Apply agent",
    description: "Executes channel-aware apply handoff post-approval",
    state: "idle",
  },
  prep_agent: {
    name: "Prep agent",
    description: "Generates STAR-R interview questions and company briefings",
    state: "active",
  },
  pipeline_monitor: {
    name: "Pipeline monitor",
    description: "Deduplicates, normalizes statuses, and flags stale applications",
    state: "active",
  },
  orchestrator: {
    name: "Orchestrator",
    description: "Coordinates specialized agents and routes actions by workflow stage",
    state: "working",
  },
};

function normalizeRows(rows: AgentRow[]): AgentRow[] {
  const byId = new Map<string, AgentRow>(rows.map((r) => [r.agent_id, r]));
  for (const id of REQUIRED_AGENT_IDS) {
    if (!byId.has(id)) {
      const fallback = AGENT_FALLBACKS[id];
      byId.set(id, { agent_id: id, ...fallback, last_run_at: null });
    }
  }
  return REQUIRED_AGENT_IDS.map((id) => byId.get(id)!).filter(Boolean);
}

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
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Turn[]>([]);
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
      setRows(normalizeRows(Array.isArray(j.agents) ? j.agents : []));
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

  const sendChat = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || chatSending) return;
      setChatError(null);
      setChatSending(true);
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setChatInput("");
      try {
        const r = await fetch(dauboBffUrl("v1/chat"), {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: prompt, history }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { detail?: string }).detail ?? "Could not reach orchestrator.");
        }
        const j = (await r.json()) as { reply: string };
        setMessages((prev) => [...prev, { role: "assistant", content: j.reply || "…" }]);
      } catch (e) {
        setMessages((prev) => prev.slice(0, -1));
        setChatError(e instanceof Error ? e.message : "Could not reach orchestrator.");
      } finally {
        setChatSending(false);
      }
    },
    [chatSending, messages],
  );

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

      <section className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-4">
        <p className="text-sm font-semibold text-white">Orchestrator chat</p>
        <p className="mt-1 text-xs text-zinc-500">
          Ask the orchestrator what to do next across discover, pipeline, approvals, and prep.
        </p>
        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-black/40 p-3">
          {messages.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Try: &quot;What should I do next for applications waiting approval?&quot;
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-zinc-800 text-zinc-100"
                    : "mr-8 border border-zinc-800 bg-zinc-900/50 text-zinc-300"
                }`}
              >
                {m.content}
              </div>
            ))
          )}
          {chatSending ? <p className="text-xs text-zinc-500">Thinking…</p> : null}
        </div>
        {chatError ? <p className="mt-2 text-xs text-red-400">{chatError}</p> : null}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat(chatInput);
          }}
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask orchestrator…"
            className="flex-1 rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatSending}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-3 text-zinc-950 disabled:opacity-50"
            aria-label="Send orchestrator message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </section>
  );
}
