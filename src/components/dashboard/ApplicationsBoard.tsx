"use client";

import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApplyHandoffPanel, type PackageDraft } from "@/components/dashboard/ApplyHandoffPanel";
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

export function ApplicationsBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qFromUrl = searchParams.get("q") ?? "";

  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState(qFromUrl);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [handoffId, setHandoffId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
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
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFilterText(qFromUrl);
  }, [qFromUrl]);

  const filteredItems = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (row) =>
        row.title.toLowerCase().includes(needle) ||
        row.company.toLowerCase().includes(needle) ||
        (row.location ?? "").toLowerCase().includes(needle) ||
        (row.notes ?? "").toLowerCase().includes(needle),
    );
  }, [items, filterText]);

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
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      setTitle("");
      setCompany("");
      setLocation("");
      setJobUrl("");
      await load();
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
    if (r.ok) await load();
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
    if (r.ok) await load();
  }

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
          disabled={saving}
          className="mt-4 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save to my jobs"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-white">Your jobs</h2>
          {items.length > 0 ? (
            <label className="block w-full sm:max-w-xs">
              <span className="sr-only">Filter jobs</span>
              <input
                type="search"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter…"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-zinc-600"
              />
            </label>
          ) : null}
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
                      aria-label="Stage"
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
                    <th className="px-4 py-3 font-medium">Stage</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Apply</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {filteredItems.map((row) => (
                    <tr key={row.id} className="border-b border-zinc-800/80 last:border-0">
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
