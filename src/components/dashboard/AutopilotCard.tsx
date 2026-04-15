"use client";

import { Loader2, Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Settings = {
  autopilot_enabled: boolean;
  autopilot_auto_gmail_drafts: boolean;
};

type RunResult = {
  run_id?: string | null;
  status?: string;
  processed: number;
  gmail_drafts_created: number;
  errors: string[];
};

type RunRecord = {
  id: string;
  status: string;
  processed: number;
  gmail_drafts_created: number;
  started_at: string;
  finished_at: string | null;
  errors: string[];
};

type RunItem = {
  id: string;
  application_id: string | null;
  title: string;
  company: string;
  status: string;
  error: string | null;
  error_category: string | null;
  retryable: boolean;
  suggested_action: string | null;
  latency_ms: number | null;
  job_url: string | null;
};

type ActiveRunConflict = {
  runId: string | null;
  message: string;
};

export function AutopilotCard({
  onAutopilotComplete,
}: {
  onAutopilotComplete?: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runItemsLoading, setRunItemsLoading] = useState(false);
  const [runItems, setRunItems] = useState<RunItem[]>([]);
  const [retryingScope, setRetryingScope] = useState<"failed_only" | "gmail_failed_only" | null>(null);
  const [activeRunConflict, setActiveRunConflict] = useState<ActiveRunConflict | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/workspace-settings"), { credentials: "same-origin" });
      if (!r.ok) throw new Error("Could not load workspace settings");
      setSettings((await r.json()) as Settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRuns = useCallback(async (opts?: { suppressError?: boolean }) => {
    setRunsLoading(true);
    if (!opts?.suppressError) {
      setError(null);
    }
    try {
      const r = await fetch(dauboBffUrl("v1/me/autopilot/runs?limit=10"), { credentials: "same-origin" });
      if (!r.ok) throw new Error("Could not load run history");
      const list = (await r.json()) as RunRecord[];
      setRuns(list);
      setSelectedRunId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      if (!opts?.suppressError) {
        setError(e instanceof Error ? e.message : "Could not load run history");
      }
      setRuns([]);
      setSelectedRunId(null);
    } finally {
      setRunsLoading(false);
    }
  }, []);

  const loadRunItems = useCallback(async (runId: string) => {
    setRunItemsLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/autopilot/runs/${runId}/items`), {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Could not load run details");
      setRunItems((await r.json()) as RunItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load run details");
      setRunItems([]);
    } finally {
      setRunItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      setRunItems([]);
      return;
    }
    void loadRunItems(selectedRunId);
  }, [selectedRunId, loadRunItems]);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/workspace-settings"), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      setSettings((await r.json()) as Settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runNow(
    gmailOverride?: boolean,
    opts?: { retryScope?: "failed_only" | "gmail_failed_only"; sourceRunId?: string | null },
  ) {
    setRunning(true);
    setRunResult(null);
    setError(null);
    setActiveRunConflict(null);
    try {
      const body: {
        limit: number;
        create_gmail_drafts?: boolean;
        retry_scope?: "failed_only" | "gmail_failed_only";
        source_run_id?: string;
      } = { limit: 8 };
      if (gmailOverride !== undefined) body.create_gmail_drafts = gmailOverride;
      if (opts?.retryScope) body.retry_scope = opts.retryScope;
      if (opts?.sourceRunId) body.source_run_id = opts.sourceRunId;
      const r = await fetch(dauboBffUrl("v1/me/autopilot/run"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const detail = ((j as { detail?: string }).detail ?? r.statusText).trim();
        if (r.status === 409) {
          const m = detail.match(/Run id:\s*([0-9a-f-]{36})/i);
          setActiveRunConflict({
            runId: m?.[1] ?? null,
            message: detail || "A Smart prep run is already in progress.",
          });
          return;
        }
        throw new Error(detail);
      }
      const out = (await r.json()) as RunResult;
      setRunResult(out);
      await loadRuns({ suppressError: true });
      if (out.run_id) {
        setSelectedRunId(out.run_id);
      }
      onAutopilotComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Smart prep failed");
    } finally {
      setRunning(false);
    }
  }

  async function retrySubset(scope: "failed_only" | "gmail_failed_only") {
    setRetryingScope(scope);
    try {
      await runNow(undefined, { retryScope: scope, sourceRunId: selectedRunId });
    } finally {
      setRetryingScope(null);
    }
  }

  function statusPillClass(status: string): string {
    if (status === "prepared_with_draft") return "border-emerald-500/40 text-emerald-300";
    if (status === "prepared") return "border-emerald-600/30 text-emerald-200";
    if (status === "prepared_draft_failed") return "border-amber-500/40 text-amber-200";
    if (status === "failed") return "border-red-500/40 text-red-300";
    if (status === "running") return "border-zinc-600 text-zinc-300";
    return "border-zinc-700 text-zinc-400";
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <Rocket className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Smart prep</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            When you save roles from discover, we can automatically prepare{" "}
            <strong className="text-zinc-400">tailored application materials</strong> (and optional{" "}
            <strong className="text-zinc-400">Gmail drafts</strong> when Gmail is connected).{" "}
            <span className="text-zinc-600">
              You still apply on LinkedIn and company sites yourself—we never auto-submit there.
            </span>
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-zinc-500">Loading…</p>
      ) : settings ? (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autopilot_enabled}
              disabled={saving}
              onChange={(e) =>
                void save({ autopilot_enabled: e.target.checked })
              }
              className="rounded border-zinc-600 bg-black"
            />
            After I save roles from discover, run prep automatically (queued; limited per run)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={settings.autopilot_auto_gmail_drafts}
              disabled={saving}
              onChange={(e) =>
                void save({ autopilot_auto_gmail_drafts: e.target.checked })
              }
              className="rounded border-zinc-600 bg-black"
            />
            When Smart prep runs, also create Gmail drafts (connect Gmail in Settings)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => void runNow()}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Run Smart prep now
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void runNow(true)}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              Run now + Gmail drafts
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      {activeRunConflict ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p>{activeRunConflict.message}</p>
          {activeRunConflict.runId ? (
            <button
              type="button"
              onClick={() => setSelectedRunId(activeRunConflict.runId)}
              className="mt-2 rounded-full border border-amber-400/40 px-3 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/15"
            >
              View active run
            </button>
          ) : null}
        </div>
      ) : null}
      {runResult ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2 text-xs text-zinc-400">
          <p>
            Packages generated:{" "}
            <strong className="text-zinc-200">{runResult.processed}</strong> · Gmail drafts:{" "}
            <strong className="text-zinc-200">{runResult.gmail_drafts_created}</strong>
          </p>
          {runResult.errors.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-amber-200/80">
              {runResult.errors.slice(0, 5).map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
        <p className="text-xs font-semibold text-zinc-300">Recent Smart prep runs</p>
        {runsLoading ? (
          <p className="mt-2 text-xs text-zinc-500">Loading run history…</p>
        ) : runs.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">No runs yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {runs.slice(0, 6).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
                  selectedRunId === run.id
                    ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {run.status} · {run.processed}
              </button>
            ))}
          </div>
        )}
        {selectedRunId ? (
          <div className="mt-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={running || retryingScope !== null}
                onClick={() => void retrySubset("failed_only")}
                className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                {retryingScope === "failed_only" ? "Retrying failed…" : "Retry failed only"}
              </button>
              <button
                type="button"
                disabled={running || retryingScope !== null}
                onClick={() => void retrySubset("gmail_failed_only")}
                className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-medium text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
              >
                {retryingScope === "gmail_failed_only"
                  ? "Retrying Gmail failures…"
                  : "Retry Gmail draft failures"}
              </button>
            </div>
            {runItemsLoading ? (
              <p className="text-xs text-zinc-500">Loading run details…</p>
            ) : runItems.length === 0 ? (
              <p className="text-xs text-zinc-500">No items recorded for this run.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {runItems.slice(0, 8).map((item) => (
                  <li key={item.id} className="rounded-md border border-zinc-800 bg-black/30 px-2 py-1.5">
                    <p className="text-zinc-300">
                      {item.title} · <span className="text-zinc-500">{item.company}</span>
                    </p>
                    <p className="mt-1 text-zinc-500">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusPillClass(
                          item.status,
                        )}`}
                      >
                        {item.status}
                      </span>
                      {typeof item.latency_ms === "number" ? (
                        <span className="ml-2 text-zinc-600">{Math.max(1, Math.round(item.latency_ms / 1000))}s</span>
                      ) : null}
                    </p>
                    {item.error ? <p className="text-amber-300/80">{item.error}</p> : null}
                    {item.error_category ? (
                      <p className="text-[11px] text-zinc-500">
                        category: <span className="text-zinc-400">{item.error_category}</span>
                      </p>
                    ) : null}
                    {item.suggested_action ? (
                      <p className="text-[11px] text-zinc-500">{item.suggested_action}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
