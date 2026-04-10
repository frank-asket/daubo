"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import type { DiscoverResult } from "@/components/dashboard/JobDiscoverPanel";
import { dauboBffUrl } from "@/lib/daubo-api";

const POLL_MS = 7000;
const POLL_MAX = 18;

type AgentMatchLatestJson = {
  run: DiscoverResult | null;
  created_at: string | null;
};

export function ResumeMatchHighlightsCard({
  onPipelineUpdated,
}: {
  onPipelineUpdated?: () => void;
}) {
  const { stats, statsReady } = useDashboardStats();
  const [run, setRun] = useState<DiscoverResult | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "queued" | "polling" | "ready" | "empty" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const triggerSent = useRef(false);
  const pollCount = useRef(0);
  const onUpdate = useRef(onPipelineUpdated);
  onUpdate.current = onPipelineUpdated;

  const fetchLatest = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), { credentials: "same-origin" });
      if (!r.ok) return false;
      const j = (await r.json()) as AgentMatchLatestJson;
      if (j.run?.result) {
        setRun(j.run);
        setCreatedAt(j.created_at);
        setPhase("ready");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!statsReady || !stats?.has_resume) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      const has = await fetchLatest();
      if (cancelled) return;
      if (has) {
        onUpdate.current?.();
        return;
      }

      setPhase("polling");
      if (!triggerSent.current) {
        triggerSent.current = true;
        try {
          const t = await fetch(dauboBffUrl("v1/me/resume/trigger-auto-match"), {
            method: "POST",
            credentials: "same-origin",
          });
          if (cancelled) return;
          if (t.ok) {
            setPhase("queued");
          } else if (t.status === 400) {
            setPhase("empty");
            return;
          } else {
            if (!cancelled) {
              setErr(
                `Could not start résumé matching (HTTP ${t.status}). Try again in a moment.`,
              );
              setPhase("error");
            }
            return;
          }
        } catch {
          if (!cancelled) {
            setErr("Could not start résumé matching. Try again in a moment.");
            setPhase("error");
          }
          return;
        }
      }

      intervalId = setInterval(async () => {
        if (cancelled) return;
        pollCount.current += 1;
        const ok = await fetchLatest();
        if (ok) {
          if (intervalId != null) clearInterval(intervalId);
          onUpdate.current?.();
          return;
        }
        if (pollCount.current >= POLL_MAX) {
          if (intervalId != null) clearInterval(intervalId);
          setPhase("empty");
        }
      }, POLL_MS);
    })();

    return () => {
      cancelled = true;
      if (intervalId != null) clearInterval(intervalId);
      triggerSent.current = false;
      pollCount.current = 0;
    };
  }, [statsReady, stats?.has_resume, fetchLatest]);

  async function addListing(
    l: DiscoverResult["result"]["parsed_listings"][number],
    idx: number,
  ) {
    const key = `${l.title}-${idx}`;
    setAddingId(key);
    setErr(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: l.title.trim(),
          company: (l.employer ?? "Unknown employer").trim(),
          location: l.location?.trim() || null,
          job_url: l.source_url?.trim() || null,
          status: "shortlisted",
          job_description: l.excerpt?.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      onUpdate.current?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save role");
    } finally {
      setAddingId(null);
    }
  }

  if (!statsReady || !stats?.has_resume) return null;

  const listings = run?.result?.parsed_listings ?? [];
  const summary = run?.result?.executive_summary?.trim();

  if (phase === "polling" || phase === "queued") {
    return (
      <div
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-4 sm:px-5"
        role="status"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-white">Matching roles to your résumé…</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Daubo infers your market from your CV and pulls live openings when Adzuna (or similar) is
              configured on the server. This usually takes under a minute.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error" && err) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {err}
      </div>
    );
  }

  if (run && listings.length === 0 && summary) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-white">Résumé job match</h3>
        {createdAt ? (
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Last run {new Date(createdAt).toLocaleString()}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{summary}</p>
        <p className="mt-3 text-[11px] text-zinc-500">
          No structured listings in this run—try{" "}
          <a href="#discover" className="font-medium text-emerald-400 hover:underline">
            Find role ideas
          </a>{" "}
          for live search, or confirm <strong className="text-zinc-400">Adzuna</strong> keys on the API for
          automatic job rows.
        </p>
      </div>
    );
  }

  if (!run || listings.length === 0) {
    if (phase === "empty" || phase === "idle") {
      return (
        <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold text-white">Résumé job match</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            No match results yet. Daubo runs a background search from your CV when you save it and when you
            open the dashboard. With <strong className="text-zinc-400">OpenRouter</strong> and{" "}
            <strong className="text-zinc-400">Adzuna API</strong> on the server, matching openings appear here.
            You can also run{" "}
            <a href="#discover" className="font-medium text-emerald-400 hover:underline">
              Find role ideas
            </a>{" "}
            anytime.
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-[#0c0c0c] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Openings matched from your résumé</h3>
          {createdAt ? (
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Last run {new Date(createdAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <Link
          href="/dashboard/applications"
          className="shrink-0 text-[11px] font-semibold text-emerald-400 hover:underline"
        >
          My jobs →
        </Link>
      </div>
      {summary ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{summary}</p>
      ) : null}
      {err ? <p className="mt-2 text-xs text-red-400">{err}</p> : null}
      <ul className="mt-4 space-y-2">
        {listings.slice(0, 8).map((l, i) => (
          <li
            key={`${l.title}-${i}`}
            className="flex flex-col gap-2 rounded-xl border border-zinc-800/90 bg-black/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-white">{l.title}</span>
              {l.employer ? <span className="text-zinc-500"> · {l.employer}</span> : null}
              {l.location ? <span className="text-zinc-500"> · {l.location}</span> : null}
              {l.source_url ? (
                <a
                  href={l.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-[11px] text-emerald-400/90 hover:underline"
                >
                  View posting
                </a>
              ) : null}
            </div>
            <button
              type="button"
              disabled={addingId !== null}
              onClick={() => void addListing(l, i)}
              className="shrink-0 rounded-full border border-zinc-600 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
            >
              {addingId === `${l.title}-${i}` ? "Saving…" : "Save to my jobs"}
            </button>
          </li>
        ))}
      </ul>
      {listings.length > 8 ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          +{listings.length - 8} more in{" "}
          <a href="#discover" className="font-medium text-emerald-400 hover:underline">
            Find role ideas
          </a>
        </p>
      ) : null}
    </div>
  );
}
