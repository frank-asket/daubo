"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Application = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  notes: string | null;
  job_url: string | null;
  updated_at: string;
};

const STATUSES = ["draft", "ready", "applied", "interview", "offer", "closed"];

export function ApplicationsBoard() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      setItems((await r.json()) as Application[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  async function remove(id: string) {
    if (!confirm("Remove this application from your pipeline?")) return;
    const r = await fetch(dauboBffUrl(`v1/me/applications/${id}`), {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (r.ok) await load();
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={addApplication}
        className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6"
      >
        <h2 className="text-sm font-semibold text-white">Add to pipeline</h2>
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
          {saving ? "Saving…" : "Save application"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div>
        <h2 className="text-sm font-semibold text-white">Your pipeline</h2>
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No applications yet. Add one above or run discovery on the dashboard.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {items.map((row) => (
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
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(row.updated_at).toLocaleDateString()}
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
        )}
      </div>
    </div>
  );
}
