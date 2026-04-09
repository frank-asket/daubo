"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type DiscoverResult = {
  country: string;
  result: {
    executive_summary: string;
    portals: { name: string; kind: string; how_to_use: string }[];
    example_search_queries: string[];
    filters_to_apply: string[];
    regulatory_reminders: string;
    parsed_listings: {
      title: string;
      employer: string | null;
      location: string | null;
      excerpt?: string | null;
      source_url?: string | null;
    }[];
  };
  notice: string;
};

export function JobDiscoverPanel({
  onDiscoveryComplete,
  onAddedToPipeline,
}: {
  onDiscoveryComplete?: () => void;
  onAddedToPipeline?: () => void;
}) {
  const onCompleteRef = useRef(onDiscoveryComplete);
  onCompleteRef.current = onDiscoveryComplete;

  const [country, setCountry] = useState("");
  const [roleFocus, setRoleFocus] = useState("");
  const [industries, setIndustries] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [autoPlanAt, setAutoPlanAt] = useState<string | null>(null);
  const lastFetchedCreatedAt = useRef<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  async function addListingToPipeline(l: DiscoverResult["result"]["parsed_listings"][number], idx: number) {
    const key = `${l.title}-${idx}`;
    setAddingId(key);
    setError(null);
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
      try {
        const sr = await fetch(dauboBffUrl("v1/me/workspace-settings"), {
          credentials: "same-origin",
        });
        if (sr.ok) {
          const ws = (await sr.json()) as { autopilot_enabled?: boolean };
          if (ws.autopilot_enabled) {
            await fetch(dauboBffUrl("v1/me/autopilot/run"), {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ limit: 4 }),
            });
          }
        }
      } catch {
        /* prep autopilot is best-effort */
      }
      onAddedToPipeline?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add this role");
    } finally {
      setAddingId(null);
    }
  }

  const fetchLatestPlan = useCallback(async () => {
    try {
      const r = await fetch(dauboBffUrl("v1/me/agent-match/latest"), {
        credentials: "same-origin",
      });
      if (!r.ok) return;
      const j = (await r.json()) as { run: DiscoverResult | null; created_at: string | null };
      if (j.run) {
        const isNew = j.created_at != null && j.created_at !== lastFetchedCreatedAt.current;
        if (j.created_at) lastFetchedCreatedAt.current = j.created_at;
        setData(j.run);
        setAutoPlanAt(j.created_at);
        setCountry((prev) => prev.trim() || j.run?.country || "");
        if (isNew) onCompleteRef.current?.();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchLatestPlan();
    const a = setTimeout(() => void fetchLatestPlan(), 20_000);
    const b = setTimeout(() => void fetchLatestPlan(), 50_000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [fetchLatestPlan]);

  async function runDiscover() {
    setError(null);
    setData(null);
    setAutoPlanAt(null);
    if (!country.trim()) {
      setError("Add a country so we can focus role ideas for you.");
      return;
    }
    setLoading(true);
    try {
      const body = {
        country: country.trim(),
        industries: industries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        role_focus: roleFocus.trim() || null,
        pasted_listings: pasted.trim() || null,
        locale: "en",
      };
      const r = await fetch(dauboBffUrl("v1/jobs/discover"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError((j as { detail?: string }).detail ?? `Could not refresh role ideas (${r.status})`);
        return;
      }
      setData((await r.json()) as DiscoverResult);
      onDiscoveryComplete?.();
    } catch {
      setError("Connection problem—check your network and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <h3 className="text-sm font-semibold text-white">Find role ideas</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Tell us where you want to work and what you do. Daubo suggests search angles and example roles;
        you can also paste text from real job ads to add them to your list. Ideas are starting points—
        always open the employer’s own site to confirm details. Some regions show more live listings than
        others.
      </p>
      {autoPlanAt ? (
        <p className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90">
          Last suggestions from your résumé
          {autoPlanAt ? `: ${new Date(autoPlanAt).toLocaleString()}` : ""}. This can take about a minute
          after you save your résumé—refresh the page if this area stays blank.
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Country
          </span>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. France"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Role focus
          </span>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
            value={roleFocus}
            onChange={(e) => setRoleFocus(e.target.value)}
            placeholder="e.g. ward nurse, warehouse lead"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Industries (comma-separated)
        </span>
        <input
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
          value={industries}
          onChange={(e) => setIndustries(e.target.value)}
          placeholder="healthcare, logistics, …"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Pasted listings (optional)
        </span>
        <textarea
          className="mt-1 min-h-[88px] w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste job ad text to extract titles and employers…"
        />
      </label>
      <button
        type="button"
        onClick={runDiscover}
        disabled={loading}
        className="mt-4 rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {loading ? "Working…" : "Get role ideas"}
      </button>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {data ? (
        <div className="mt-6 space-y-4 border-t border-zinc-800 pt-6 text-sm">
          <p className="text-xs text-zinc-500">{data.notice}</p>
          <p className="leading-relaxed text-zinc-300">{data.result.executive_summary}</p>
          {data.result.parsed_listings.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Roles to save
              </p>
              <ul className="mt-2 space-y-2 text-zinc-300">
                {data.result.parsed_listings.map((l, i) => (
                  <li
                    key={`${l.title}-${i}`}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-white">{l.title}</span>
                      {l.employer ? (
                        <span className="text-zinc-500"> · {l.employer}</span>
                      ) : null}
                      {l.location ? (
                        <span className="text-zinc-500"> · {l.location}</span>
                      ) : null}
                      {l.source_url ? (
                        <a
                          href={l.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-[11px] text-emerald-400/90 hover:underline"
                        >
                          Open posting
                        </a>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={addingId !== null}
                      onClick={() => void addListingToPipeline(l, i)}
                      className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
                    >
                      {addingId === `${l.title}-${i}` ? "Saving…" : "Save to my jobs"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.result.example_search_queries.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Example searches to try
              </p>
              <ul className="mt-2 list-inside list-disc text-zinc-400">
                {data.result.example_search_queries.slice(0, 8).map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
