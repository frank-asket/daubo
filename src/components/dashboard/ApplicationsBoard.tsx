"use client";

import { Download, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApplyHandoffPanel, type PackageDraft } from "@/components/dashboard/ApplyHandoffPanel";
import { ResumeProfileStrip } from "@/components/dashboard/ResumeProfileStrip";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { dauboBffUrl } from "@/lib/daubo-api";
import { JOB_STAGE_VALUES, jobStageLabel } from "@/lib/job-stages";

type Application = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  notes: string | null;
  job_url: string | null;
  apply_channel: string | null;
  job_description: string | null;
  package_draft: PackageDraft;
  interview_prep: Record<string, unknown> | null;
  updated_at: string;
};

type IntegrityChange = {
  application_id: string;
  action: string;
  reason: string;
  before?: string | null;
  after?: string | null;
  duplicate_of_id?: string | null;
};

type IntegrityReport = {
  dry_run: boolean;
  stale_days: number;
  scanned: number;
  duplicates_found: number;
  duplicates_removed: number;
  statuses_normalized: number;
  stale_flagged: number;
  changes: IntegrityChange[];
};

export function ApplicationsBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";
  const { stats, reload: reloadStats } = useDashboardStats();

  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filterText, setFilterText] = useState(qFromUrl);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityApplying, setIntegrityApplying] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const autoPreviewTriggered = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, `Could not load jobs (${r.status}). Try again.`));
      }
      const raw = (await r.json()) as Application[];
      setItems(
        raw.map((row) => ({
          ...row,
          status: row.status === "ready" ? "ready_to_apply" : row.status,
          apply_channel: row.apply_channel ?? null,
          job_description: row.job_description ?? null,
          package_draft: row.package_draft ?? null,
          interview_prep: row.interview_prep ?? null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t load your jobs. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications/export"), {
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, "Could not export. Try again."));
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "daubo-my-jobs.csv";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFilterText(qFromUrl);
  }, [qFromUrl]);

  const staleCutoffMs = 21 * 24 * 60 * 60 * 1000;

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const needle = filterText.trim().toLowerCase();
    return items.filter((row) => {
      const textMatch =
        !needle ||
        row.title.toLowerCase().includes(needle) ||
        row.company.toLowerCase().includes(needle) ||
        (row.location ?? "").toLowerCase().includes(needle) ||
        (row.notes ?? "").toLowerCase().includes(needle);
      if (!textMatch) return false;
      if (!staleOnly) return true;
      const updated = new Date(row.updated_at).getTime();
      if (!Number.isFinite(updated)) return false;
      return now - updated > staleCutoffMs;
    });
  }, [items, filterText, staleOnly, staleCutoffMs]);

  useEffect(() => {
    const q = filterText.trim();
    const t = window.setTimeout(() => {
      const prev = (new URLSearchParams(window.location.search).get("q") ?? "").trim();
      if (q === prev) return;
      const params = new URLSearchParams(window.location.search);
      if (q) params.set("q", q);
      else params.delete("q");
      const tail = params.toString();
      router.replace(tail ? `/dashboard/applications?${tail}` : "/dashboard/applications", {
        scroll: false,
      });
    }, 320);
    return () => window.clearTimeout(t);
  }, [filterText, router]);

  async function addApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !company.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || null,
          job_url: jobUrl.trim() || null,
          status: "draft",
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, "Could not save this job. Try again."));
      }
      setTitle("");
      setCompany("");
      setLocation("");
      setJobUrl("");
      await load();
      void reloadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const r = await fetch(dauboBffUrl(`v1/me/applications/${id}`), {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      await load();
      void reloadStats();
    }
  }

  const handoffApplication = useMemo(
    () => (handoffId ? (items.find((r) => r.id === handoffId) ?? null) : null),
    [handoffId, items],
  );

  async function remove(id: string) {
    if (!confirm("Remove this job from your list?")) return;
    const r = await fetch(dauboBffUrl(`v1/me/applications/${id}`), {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (r.ok) {
      await load();
      void reloadStats();
    }
  }

  async function runIntegrityCheck(dryRun: boolean) {
    if (dryRun) setIntegrityLoading(true);
    else setIntegrityApplying(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications/integrity-check"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dry_run: dryRun, stale_days: 21 }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { detail?: unknown };
        throw new Error(formatApiErrorMessage(j.detail, "Could not run pipeline cleanup. Try again."));
      }
      const report = (await r.json()) as IntegrityReport;
      setIntegrityReport(report);
      if (!dryRun) {
        await load();
        void reloadStats();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline cleanup failed");
    } finally {
      if (dryRun) setIntegrityLoading(false);
      else setIntegrityApplying(false);
    }
  }

  function jumpToApplicationRow(applicationId: string) {
    const el = document.getElementById(`app-row-${applicationId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (loading || autoPreviewTriggered.current) return;
    if (items.length < 12) return;
    autoPreviewTriggered.current = true;
    void runIntegrityCheck(true);
  }, [items.length, loading]);

  const limits = stats?.limits;

  return (
    <div className="space-y-8">
      <ApplyHandoffPanel
        application={handoffApplication}
        onClose={() => setHandoffId(null)}
        onRefresh={load}
        onStatusChange={async (id, status) => {
          await updateStatus(id, status);
        }}
      />
      {limits?.max_tracked_jobs != null &&
      limits.tracked_jobs >= limits.max_tracked_jobs ? (
        <p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          You&apos;ve reached the maximum number of saved jobs for your current plan (
          {limits.max_tracked_jobs}). Remove a job below to add another, or contact support about
          upgrading.
        </p>
      ) : limits?.max_tracked_jobs != null &&
        limits.max_tracked_jobs > 0 &&
        limits.tracked_jobs === limits.max_tracked_jobs - 1 ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
          You can save <strong className="text-zinc-300">one</strong> more job on your current plan (
          {limits.tracked_jobs}/{limits.max_tracked_jobs}).
        </p>
      ) : null}
      <ResumeProfileStrip />
      <form
        onSubmit={addApplication}
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6"
      >
        <h2 className="text-sm font-semibold text-white">Add a job</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            required
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
            placeholder="Role title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            required
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <input
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
            placeholder="Job URL (optional)"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={
            saving ||
            (limits?.max_tracked_jobs != null &&
              limits.tracked_jobs >= limits.max_tracked_jobs)
          }
          className="mt-4 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save to my jobs"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {integrityReport ? (
        <div className="rounded-xl border border-zinc-800 bg-black/30 px-4 py-3 text-xs text-zinc-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-zinc-200">
              Pipeline integrity {integrityReport.dry_run ? "preview" : "applied"}
            </p>
            {integrityReport.dry_run ? (
              <button
                type="button"
                disabled={integrityApplying}
                onClick={() => void runIntegrityCheck(false)}
                className="rounded-full border border-emerald-500/40 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
              >
                {integrityApplying ? "Applying…" : "Apply changes"}
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-zinc-400">
            Scanned {integrityReport.scanned} rows · duplicates found {integrityReport.duplicates_found}
            {integrityReport.dry_run ? "" : ` · removed ${integrityReport.duplicates_removed}`} · statuses
            normalized {integrityReport.statuses_normalized} · stale flagged{" "}
            {integrityReport.stale_flagged}
          </p>
          {integrityReport.changes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-400">
              {integrityReport.changes.slice(0, 8).map((change) => (
                <li key={`${change.application_id}-${change.action}-${change.duplicate_of_id ?? ""}`}>
                  <span className="text-zinc-300">{change.action}</span>: {change.reason}
                  <button
                    type="button"
                    onClick={() => jumpToApplicationRow(change.application_id)}
                    className="ml-2 text-[11px] font-medium text-emerald-400 hover:underline"
                  >
                    Open row
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-zinc-500">No integrity issues detected.</p>
          )}
        </div>
      ) : null}

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Your jobs</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {items.length > 0 ? (
              <>
                <button
                  type="button"
                  disabled={integrityLoading || integrityApplying}
                  onClick={() => void runIntegrityCheck(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white disabled:opacity-50"
                >
                  {integrityLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Clean pipeline
                </button>
                <button
                  type="button"
                  onClick={() => setStaleOnly((v) => !v)}
                  className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    staleOnly
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-zinc-600 text-zinc-200 hover:border-zinc-500 hover:text-white"
                  }`}
                >
                  {staleOnly ? "Showing stale only" : "Only stale"}
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void exportCsv()}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Export CSV
                </button>
                <label className="block w-full sm:max-w-xs sm:min-w-[12rem]">
                  <span className="sr-only">Filter jobs</span>
                  <input
                    type="search"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter…"
                    className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No jobs saved yet. Add one above, or save roles from Discover on the home dashboard.
          </p>
        ) : filteredItems.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No rows match &ldquo;{filterText.trim()}&rdquo;.{" "}
            <button
              type="button"
              className="font-medium text-emerald-400 hover:underline"
              onClick={() => {
                setFilterText("");
                router.replace("/dashboard/applications", { scroll: false });
              }}
            >
              Clear filter
            </button>
          </p>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {filteredItems.map((row) => (
                <div
                  key={row.id}
                  id={`app-row-${row.id}`}
                  tabIndex={-1}
                  className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-4 text-sm"
                >
                  <div className="font-medium text-white">
                    {row.job_url ? (
                      <a
                        href={row.job_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-400 hover:underline"
                      >
                        {row.title}
                      </a>
                    ) : (
                      row.title
                    )}
                  </div>
                  <p className="mt-1 text-zinc-400">{row.company}</p>
                  {row.location ? <p className="mt-0.5 text-xs text-zinc-500">{row.location}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-zinc-800 bg-black px-2 py-1.5 text-xs text-white"
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      aria-label="Job status"
                    >
                      {JOB_STAGE_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {jobStageLabel(s)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setHandoffId(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px] font-medium text-emerald-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Apply yourself
                    </button>
                    <span className="text-xs text-zinc-500">
                      {new Date(row.updated_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="ml-auto inline-flex rounded-lg border border-zinc-800 p-2 text-zinc-500 hover:border-red-500/50 hover:text-red-400"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-zinc-800 md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Apply</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {filteredItems.map((row) => (
                    <tr
                      key={row.id}
                      id={`app-row-${row.id}`}
                      tabIndex={-1}
                      className="border-b border-zinc-800/80 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {row.job_url ? (
                          <a
                            href={row.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-emerald-400 hover:underline"
                          >
                            {row.title}
                          </a>
                        ) : (
                          row.title
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{row.company}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border border-zinc-800 bg-black px-2 py-1 text-xs text-white"
                          value={row.status}
                          onChange={(e) => updateStatus(row.id, e.target.value)}
                        >
                          {JOB_STAGE_VALUES.map((s) => (
                            <option key={s} value={s}>
                              {jobStageLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(row.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setHandoffId(row.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[11px] font-medium text-emerald-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Apply yourself
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          className="inline-flex rounded-lg border border-zinc-800 p-2 text-zinc-500 hover:border-red-500/50 hover:text-red-400"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
