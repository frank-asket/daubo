"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";

export function ResumeWorkspace() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [updated, setUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/resume"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      const body = await r.json();
      if (body == null || typeof body !== "object" || !("content_text" in body)) {
        setText("");
        setFileName("");
        setUpdated(null);
        return;
      }
      setText(String((body as { content_text: string }).content_text));
      setFileName(String((body as { file_name?: string | null }).file_name ?? ""));
      setUpdated((body as { updated_at?: string }).updated_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load resume");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!text.trim()) {
      setError("Resume text cannot be empty");
      return;
    }
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/resume"), {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content_text: text,
          file_name: fileName.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      const body = await r.json();
      setUpdated((body as { updated_at?: string }).updated_at ?? null);
      setOk("Resume saved to Daubo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading resume…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-zinc-500">
        Paste your master resume or CV text. Daubo uses this as the source profile for tailoring
        and matching. PDF upload can be layered on later.
      </p>
      {updated ? (
        <p className="text-xs text-zinc-500">Last updated: {new Date(updated).toLocaleString()}</p>
      ) : null}
      <input
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
        placeholder="Optional label (e.g. Resume_Jan_2025.pdf)"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
      />
      <textarea
        className="min-h-[320px] w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 font-mono text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your experience, education, skills…"
      />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save to Daubo"}
        </button>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-zinc-700 px-6 py-2.5 text-sm font-semibold text-zinc-300"
        >
          Reload
        </button>
      </div>
      {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
