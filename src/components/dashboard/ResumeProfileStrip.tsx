"use client";

import { Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { dauboBffUrl } from "@/lib/daubo-api";

type ResumeProfileSignals = {
  headline?: string | null;
  skills: string[];
  target_roles: string[];
  seniority?: string | null;
  industries: string[];
  locations_or_remote?: string | null;
  summary: string;
};

type ResumeProfileStored = {
  has_resume: boolean;
  signals: ResumeProfileSignals | null;
  stale: boolean;
  resume_updated_at: string | null;
  profile_extracted_at: string | null;
};

export function ResumeProfileStrip() {
  const [data, setData] = useState<ResumeProfileStored | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/resume/profile"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, `Could not load profile (${r.status}).`));
      }
      setData((await r.json()) as ResumeProfileStored);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load résumé profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshProfile() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/resume/profile/refresh"), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, "Could not refresh profile."));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-3 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading your résumé profile…
      </div>
    );
  }

  if (!data?.has_resume) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-3 text-sm text-zinc-400">
        <span className="text-zinc-300">Skills from your résumé</span> show here once you{" "}
        <Link href="/dashboard/resume" className="font-medium text-emerald-400 hover:underline">
          add a résumé
        </Link>
        .
      </div>
    );
  }

  const sig = data.signals;
  if (!sig && data.stale) {
    return (
      <div className="space-y-2 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
        <p className="text-amber-100/90">We couldn&apos;t load cached skills yet.</p>
        {error ? <p className="text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refreshProfile()}
          className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 px-4 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Extract profile
        </button>
      </div>
    );
  }

  if (!sig) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-3 text-sm text-zinc-500">
        Profile data is unavailable. Try again later or re-upload your résumé.
        {error ? <p className="mt-2 text-red-400">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">From your résumé</p>
          {sig.headline ? (
            <p className="mt-1 text-sm font-medium text-white">{sig.headline}</p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">Skills &amp; context for this job search</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.stale ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              May be outdated
            </span>
          ) : null}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refreshProfile()}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-50"
            title="Re-run extraction"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      </div>
      {sig.summary ? <p className="text-sm leading-relaxed text-zinc-400">{sig.summary}</p> : null}
      {sig.skills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sig.skills.map((s) => (
            <span
              key={s}
              className="rounded-full border border-zinc-700/80 bg-black/40 px-2.5 py-0.5 text-[11px] text-zinc-300"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}
      {(sig.target_roles.length > 0 || sig.industries.length > 0 || sig.seniority) ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
          {sig.seniority ? <span>Seniority: {sig.seniority}</span> : null}
          {sig.target_roles.length > 0 ? <span>Targets: {sig.target_roles.join(", ")}</span> : null}
          {sig.industries.length > 0 ? <span>Sectors: {sig.industries.join(", ")}</span> : null}
          {sig.locations_or_remote ? <span>{sig.locations_or_remote}</span> : null}
        </div>
      ) : null}
      {data.profile_extracted_at ? (
        <p className="text-[10px] text-zinc-600">
          Profile extracted {new Date(data.profile_extracted_at).toLocaleString()}
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
