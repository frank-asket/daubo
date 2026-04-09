"use client";

import { Loader2, Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Settings = {
  autopilot_enabled: boolean;
  autopilot_auto_gmail_drafts: boolean;
};

type RunResult = {
  processed: number;
  gmail_drafts_created: number;
  errors: string[];
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

  async function runNow(gmailOverride?: boolean) {
    setRunning(true);
    setRunResult(null);
    setError(null);
    try {
      const body: { limit: number; create_gmail_drafts?: boolean } = { limit: 8 };
      if (gmailOverride !== undefined) body.create_gmail_drafts = gmailOverride;
      const r = await fetch(dauboBffUrl("v1/me/autopilot/run"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      setRunResult((await r.json()) as RunResult);
      onAutopilotComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Autopilot failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <Rocket className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Prep autopilot (agents)</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Automatically generates <strong className="text-zinc-400">application packages</strong> for
            shortlisted roles (and drafts with a job description). Optional: create matching{" "}
            <strong className="text-zinc-400">Gmail drafts</strong>.{" "}
            <span className="text-zinc-600">
              Daubo never auto-submits on LinkedIn or employer sites—that step stays yours.
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
            After I add roles from discover, run prep automatically (adds to queue; still bounded per
            run)
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
            When prep autopilot runs, also create Gmail drafts (connect Gmail in Settings)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => void runNow()}
              className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Run prep autopilot now
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
    </div>
  );
}
