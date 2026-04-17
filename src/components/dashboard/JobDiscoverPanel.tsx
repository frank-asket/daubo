"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { useDiscoverStream } from "@/hooks/useDiscoverStream";
import { dauboBffUrl } from "@/lib/daubo-api";

export type DiscoverResult = {
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
      fit_score?: number | null;
      fit_reasons?: string[];
      risk_flags?: string[];
      source_url?: string | null;
    }[];
  };
  notice: string;
};

type DiscoverHints = {
  country: string;
  country_code: string | null;
  city_or_region: string | null;
  industries: string[];
  role_focus: string | null;
  languages: string[];
  additional_country_codes: string[];
  emphasize_remote_global: boolean;
  resume_excerpt: string;
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
const DISCOVER_FIT_QUERY_KEY = "discoverFitMin";
const DISCOVER_FIT_STORAGE_KEY = "daubo:discover-fit-min";

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

export function JobDiscoverPanel({
  onDiscoveryComplete,
  onAddedToPipeline,
}: {
  onDiscoveryComplete?: () => void;
  onAddedToPipeline?: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onCompleteRef = useRef(onDiscoveryComplete);
  onCompleteRef.current = onDiscoveryComplete;

  const { stats } = useDashboardStats();
  const { event: discoverEvent } = useDiscoverStream(true);
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [cityOrRegion, setCityOrRegion] = useState("");
  const [roleFocus, setRoleFocus] = useState("");
  const [industries, setIndustries] = useState("");
  const [pasted, setPasted] = useState("");
  const [additionalCountryCodes, setAdditionalCountryCodes] = useState<string[]>([]);
  const [emphasizeRemoteGlobal, setEmphasizeRemoteGlobal] = useState(false);
  const [resumeExcerpt, setResumeExcerpt] = useState<string | null>(null);
  const hintsPrefilled = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DiscoverResult | null>(null);
  const [autoPlanAt, setAutoPlanAt] = useState<string | null>(null);
  const lastFetchedCreatedAt = useRef<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [minFitThreshold, setMinFitThreshold] = useState(0);

  useEffect(() => {
    const fromQuery = normalizeFitThreshold(searchParams.get(DISCOVER_FIT_QUERY_KEY));
    if (fromQuery > 0 || searchParams.has(DISCOVER_FIT_QUERY_KEY)) {
      setMinFitThreshold(fromQuery);
      return;
    }
    try {
      const fromStorage = normalizeFitThreshold(localStorage.getItem(DISCOVER_FIT_STORAGE_KEY));
      setMinFitThreshold(fromStorage);
    } catch {
      setMinFitThreshold(0);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      localStorage.setItem(DISCOVER_FIT_STORAGE_KEY, String(minFitThreshold));
    } catch {
      /* ignore storage failures */
    }
    const currentRaw = searchParams.get(DISCOVER_FIT_QUERY_KEY);
    const currentNormalized = normalizeFitThreshold(currentRaw);
    if (minFitThreshold <= 0 && !searchParams.has(DISCOVER_FIT_QUERY_KEY)) return;
    if (minFitThreshold > 0 && currentNormalized === minFitThreshold) return;

    const params = new URLSearchParams(searchParams.toString());
    if (minFitThreshold <= 0) params.delete(DISCOVER_FIT_QUERY_KEY);
    else params.set(DISCOVER_FIT_QUERY_KEY, String(minFitThreshold));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [minFitThreshold, router, searchParams]);

  async function addListingToPipeline(l: DiscoverResult["result"]["parsed_listings"][number]) {
    const key = listingKey(l);
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

  async function prepareListing(l: DiscoverResult["result"]["parsed_listings"][number]) {
    const key = listingKey(l);
    setPreparingId(key);
    setError(null);
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
      onAddedToPipeline?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare this application.");
    } finally {
      setPreparingId(null);
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

  useEffect(() => {
    if (!discoverEvent) return;
    // Refresh the discover panel when backend listing/scoring snapshot changes.
    void fetchLatestPlan();
  }, [discoverEvent, fetchLatestPlan]);

  useEffect(() => {
    if (!stats?.has_resume || hintsPrefilled.current) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(dauboBffUrl("v1/me/discover/hints"), { credentials: "same-origin" });
        if (!r.ok || cancelled) return;
        const h = (await r.json()) as DiscoverHints;
        hintsPrefilled.current = true;
        setCountry(h.country?.trim() || "");
        {
          const cc =
            typeof h.country_code === "string" ? h.country_code.trim().toUpperCase() : "";
          setCountryCode(cc.length === 2 ? cc : null);
        }
        setCityOrRegion(h.city_or_region?.trim() || "");
        setRoleFocus(h.role_focus?.trim() || "");
        setIndustries((h.industries ?? []).map((s) => s.trim()).filter(Boolean).join(", "));
        setAdditionalCountryCodes(
          (h.additional_country_codes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean),
        );
        setEmphasizeRemoteGlobal(Boolean(h.emphasize_remote_global));
        setResumeExcerpt(typeof h.resume_excerpt === "string" ? h.resume_excerpt : null);
      } catch {
        /* hints are optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stats?.has_resume]);

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
        country_code: countryCode?.trim() ? countryCode.trim().slice(0, 2).toUpperCase() : null,
        city_or_region: cityOrRegion.trim() || null,
        industries: industries
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        role_focus: roleFocus.trim() || null,
        pasted_listings: pasted.trim() || null,
        locale: "en",
        additional_country_codes: additionalCountryCodes,
        emphasize_remote_global: emphasizeRemoteGlobal,
        resume_context: resumeExcerpt?.trim() || null,
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

  const sortedParsedListings = data ? [...data.result.parsed_listings].sort(byFitThenTitle) : [];
  const filteredParsedListings = sortedParsedListings.filter((l) => {
    if (minFitThreshold <= 0) return true;
    if (typeof l.fit_score !== "number") return false;
    return l.fit_score >= minFitThreshold;
  });

  return (
    <div
      id="discover"
      className="scroll-mt-28 rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5"
    >
      <h3 className="text-sm font-semibold text-white">Find role ideas</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Fields can <strong className="font-medium text-zinc-400">prefill from your résumé</strong>—primary
        location, nearby region, extra countries tied to your CV, and remote/global angles when it fits. Edit
        anything, then run discover. Daubo suggests search strategies and sample roles; paste real job ads
        below if you have them. Always confirm on the employer site. Found a role elsewhere? Add it under{" "}
        <Link href="/dashboard/pipeline" className="font-semibold text-emerald-400/90 hover:underline">
          Pipeline
        </Link>{" "}
        with the posting URL so everything stays in one place.
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
        <label className="block sm:col-span-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            City or region (optional)
          </span>
          <input
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
            value={cityOrRegion}
            onChange={(e) => setCityOrRegion(e.target.value)}
            placeholder="e.g. Lyon, Scotland, Iowa — tightens nearby live listings"
          />
        </label>
      </div>
      {additionalCountryCodes.length > 0 ? (
        <p className="mt-2 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-400">Also weighted from your CV: </span>
          {additionalCountryCodes.join(", ")}
        </p>
      ) : null}
      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2.5">
        <input
          type="checkbox"
          checked={emphasizeRemoteGlobal}
          onChange={(e) => setEmphasizeRemoteGlobal(e.target.checked)}
          className="mt-1 rounded border-zinc-600 bg-black text-emerald-500 focus:ring-emerald-500/40"
        />
        <span className="text-xs leading-snug text-zinc-400">
          <span className="font-medium text-zinc-300">Include remote &amp; global boards</span> in the plan
          (uses your résumé signals when prefilled; you can override anytime).
        </span>
      </label>
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
          {sortedParsedListings.length > 0 ? (
            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Roles to save
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Sorted by estimated fit (highest first).
                  </p>
                </div>
                <label className="text-[11px] text-zinc-500">
                  Min fit score
                  <select
                    value={minFitThreshold}
                    onChange={(e) => setMinFitThreshold(normalizeFitThreshold(e.target.value))}
                    className="ml-2 rounded-md border border-zinc-700 bg-black px-2 py-1 text-[11px] text-zinc-200"
                  >
                    <option value={0}>All</option>
                    <option value={2.5}>2.5+</option>
                    <option value={3}>3.0+</option>
                    <option value={3.5}>3.5+</option>
                    <option value={4}>4.0+</option>
                    <option value={4.5}>4.5+</option>
                  </select>
                </label>
              </div>
              {filteredParsedListings.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  No listings meet this threshold. Lower the minimum to see more results.
                </p>
              ) : null}
              <ul className="mt-2 space-y-2 text-zinc-300">
                {filteredParsedListings.map((l) => (
                  <li
                    key={listingKey(l)}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{l.title}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${fitTone(
                            l.fit_score ?? null,
                          )}`}
                          title="Estimated fit score from your discovery profile."
                        >
                          Fit {typeof l.fit_score === "number" ? `${l.fit_score.toFixed(1)}/5` : "—"}
                        </span>
                      </div>
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
                      onClick={() => void addListingToPipeline(l)}
                      className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
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
