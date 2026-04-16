"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import type { DiscoverResult } from "@/components/dashboard/JobDiscoverPanel";
import { dauboBffUrl } from "@/lib/daubo-api";

const POLL_MS = 7000;
const POLL_MAX = 18;

type AgentMatchLatestJson = {
  run: DiscoverResult | null;
  created_at: string | null;
};

function fitTone(score: number | null | undefined): string {
  if (score == null) return "border-zinc-700 text-zinc-300";
  if (score >= 4.2) return "border-emerald-500/50 text-emerald-300";
  if (score >= 3.3) return "border-amber-500/50 text-amber-200";
  return "border-zinc-700 text-zinc-300";
}

function byFitThenTitle(
  a: DiscoverResult["result"]["parsed_listings"][number],
  b: DiscoverResult["result"]["parsed_listings"][number],
): number {
  const as = typeof a.fit_score === "number" ? a.fit_score : -1;
  const bs = typeof b.fit_score === "number" ? b.fit_score : -1;
  if (as !== bs) return bs - as;
  return a.title.localeCompare(b.title);
}

const FIT_THRESHOLDS = new Set([0, 2.5, 3, 3.5, 4, 4.5]);
const RESUME_FIT_QUERY_KEY = "resumeFitMin";
const RESUME_FIT_STORAGE_KEY = "daubo:resume-fit-min";

function normalizeFitThreshold(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return FIT_THRESHOLDS.has(parsed) ? parsed : 0;
}

function listingKey(l: DiscoverResult["result"]["parsed_listings"][number]): string {
  const title = l.title.trim().toLowerCase();
  const employer = (l.employer ?? "").trim().toLowerCase();
  const location = (l.location ?? "").trim().toLowerCase();
  const url = (l.source_url ?? "").trim().toLowerCase();
  return [title, employer, location, url].join("|");
}

export function ResumeMatchHighlightsCard({
  onPipelineUpdated,
}: {
  onPipelineUpdated?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stats, statsReady } = useDashboardStats();
  const [run, setRun] = useState<DiscoverResult | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "queued" | "polling" | "ready" | "empty" | "error">(
    "idle",
  );
  const [err, setErr] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [minFitThreshold, setMinFitThreshold] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const triggerSent = useRef(false);
  const pollCount = useRef(0);
  const onUpdate = useRef(onPipelineUpdated);
  onUpdate.current = onPipelineUpdated;

  useEffect(() => {
    const fromQuery = normalizeFitThreshold(searchParams.get(RESUME_FIT_QUERY_KEY));
    if (fromQuery > 0 || searchParams.has(RESUME_FIT_QUERY_KEY)) {
      setMinFitThreshold(fromQuery);
      return;
    }
    try {
      const fromStorage = normalizeFitThreshold(localStorage.getItem(RESUME_FIT_STORAGE_KEY));
      setMinFitThreshold(fromStorage);
    } catch {
      setMinFitThreshold(0);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(RESUME_FIT_STORAGE_KEY, String(minFitThreshold));
    } catch {
      /* ignore storage failures */
    }
    const currentRaw = searchParams.get(RESUME_FIT_QUERY_KEY);
    const currentNormalized = normalizeFitThreshold(currentRaw);
    if (minFitThreshold <= 0 && !searchParams.has(RESUME_FIT_QUERY_KEY)) return;
    if (minFitThreshold > 0 && currentNormalized === minFitThreshold) return;

    const params = new URLSearchParams(searchParams.toString());
    if (minFitThreshold <= 0) params.delete(RESUME_FIT_QUERY_KEY);
    else params.set(RESUME_FIT_QUERY_KEY, String(minFitThreshold));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [minFitThreshold, router, searchParams]);

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

  async function addListing(l: DiscoverResult["result"]["parsed_listings"][number]) {
    const key = listingKey(l);
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

  async function prepareListing(l: DiscoverResult["result"]["parsed_listings"][number]) {
    const key = listingKey(l);
    setPreparingId(key);
    setErr(null);
    try {
      const create = await fetch(dauboBffUrl("v1/me/applications"), {
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
          apply_channel: l.source_url?.toLowerCase().includes("linkedin") ? "linkedin" : "email",
        }),
      });
      if (!create.ok) {
        const j = await create.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? create.statusText);
      }
      const created = (await create.json()) as { id?: string };
      const id = created.id?.trim();
      if (!id) throw new Error("Could not prepare this role (missing application id).");

      const prep = await fetch(dauboBffUrl(`v1/me/applications/${id}/application-package`), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!prep.ok) {
        const j = await prep.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? "Package generation failed.");
      }
      onUpdate.current?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not prepare application.");
    } finally {
      setPreparingId(null);
    }
  }

  async function refreshMatches() {
    setRefreshing(true);
    setErr(null);
    try {
      await fetch(dauboBffUrl("v1/me/resume/trigger-auto-match"), {
        method: "POST",
        credentials: "same-origin",
      });
      await fetchLatest();
    } catch {
      setErr("Could not refresh matches right now.");
    } finally {
      setRefreshing(false);
    }
  }

  if (!statsReady || !stats?.has_resume) return null;

  const listings = [...(run?.result?.parsed_listings ?? [])].sort(byFitThenTitle);
  const filteredListings = listings.filter((l) => {
    if (minFitThreshold <= 0) return true;
    if (typeof l.fit_score !== "number") return false;
    return l.fit_score >= minFitThreshold;
  });
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

  if (phase === "error") {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {err?.trim() ? err : "Résumé matching couldn’t start. Try again in a moment."}
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
        <Link href="/dashboard/pipeline" className="shrink-0 text-[11px] text-zinc-500 hover:text-zinc-300">
          My jobs
        </Link>
      </div>
      {summary ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-400">{summary}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium uppercase tracking-[0.04em] text-zinc-400">
          Top matches
        </p>
        <div className="flex items-center gap-2">
          <select
            value={minFitThreshold}
            onChange={(e) => setMinFitThreshold(normalizeFitThreshold(e.target.value))}
            className="rounded-md border border-zinc-700 bg-black px-2 py-1.5 text-[11px] text-zinc-100"
          >
            <option value={0}>All scores</option>
            <option value={4}>High fit (≥4.0)</option>
            <option value={3}>Mid fit (3-3.9)</option>
          </select>
          <button
            type="button"
            onClick={() => void refreshMatches()}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-[11px] text-zinc-100 hover:bg-zinc-900 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>
      {err ? <p className="mt-2 text-xs text-red-400">{err}</p> : null}
      {filteredListings.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          No matched listings meet this threshold yet. Lower the minimum to see more roles.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {filteredListings.slice(0, 8).map((l) => (
          <li
            key={listingKey(l)}
            className="flex flex-col gap-2 rounded-xl border border-zinc-800/90 bg-black/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{l.title}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${fitTone(
                    l.fit_score ?? null,
                  )}`}
                  title="Estimated fit score from your résumé profile and listing details."
                >
                  Fit {typeof l.fit_score === "number" ? `${l.fit_score.toFixed(1)}/5` : "—"}
                </span>
              </div>
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
              {(l.fit_reasons?.length ?? 0) > 0 || (l.risk_flags?.length ?? 0) > 0 ? (
                <details className="mt-2 rounded-md border border-zinc-800/80 bg-black/20 px-2.5 py-1.5 text-xs">
                  <summary className="cursor-pointer select-none text-zinc-400">
                    Why this role matched
                  </summary>
                  {(l.fit_reasons?.length ?? 0) > 0 ? (
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-zinc-300">
                      {(l.fit_reasons ?? []).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                  {(l.risk_flags?.length ?? 0) > 0 ? (
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-200/80">
                      {(l.risk_flags ?? []).map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  ) : null}
                </details>
              ) : null}
            </div>
            <button
              type="button"
              disabled={addingId !== null || preparingId !== null}
              onClick={() => void addListing(l)}
              className="shrink-0 rounded-full border border-zinc-600 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
            >
              {addingId === listingKey(l) ? "Saving…" : "Save to my jobs"}
            </button>
            <button
              type="button"
              disabled={addingId !== null || preparingId !== null}
              onClick={() => void prepareListing(l)}
              className="shrink-0 rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              {preparingId === listingKey(l) ? "Preparing…" : "Prepare application"}
            </button>
          </li>
        ))}
      </ul>
      {filteredListings.length > 8 ? (
        <p className="mt-3 text-[11px] text-zinc-500">
          +{filteredListings.length - 8} more in{" "}
          <a href="#discover" className="font-medium text-emerald-400 hover:underline">
            Find role ideas
          </a>
        </p>
      ) : null}
    </div>
  );
}
