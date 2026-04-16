"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { useDashboardStats } from "@/components/dashboard/DashboardStatsContext";
import { dauboBffUrl } from "@/lib/daubo-api";

type ResumeBody = {
  content_text: string;
  file_name?: string | null;
  updated_at?: string;
};

type UploadBody = ResumeBody & { agent_reply?: string | null };

export function ResumeWorkspace() {
  const { reload: reloadStats } = useDashboardStats();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [updated, setUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setText(String((body as ResumeBody).content_text));
      setFileName(String((body as ResumeBody).file_name ?? ""));
      setUpdated((body as ResumeBody).updated_at ?? null);
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
    setAgentReply(null);
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
      setUpdated((body as ResumeBody).updated_at ?? null);
      setOk("Résumé saved");
      await reloadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    setOk(null);
    setAgentReply(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(dauboBffUrl("v1/me/resume/upload"), {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const d = (j as { detail?: unknown }).detail;
        const msg =
          typeof d === "string"
            ? d.trim() || null
            : d != null
              ? JSON.stringify(d)
              : null;
        throw new Error(msg ?? `Upload failed (${r.status})`);
      }
      const body = (await r.json()) as UploadBody;
      setText(String(body.content_text ?? ""));
      setFileName(String(body.file_name ?? file.name));
      setUpdated(body.updated_at ?? null);
      setOk("Résumé imported. Daubo will use this text for suggestions and tailoring.");
      if (body.agent_reply?.trim()) {
        setAgentReply(body.agent_reply.trim());
      }
      await reloadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void uploadFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading resume…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-zinc-600">
        Upload a <span className="font-medium text-zinc-900">PDF, Word (.docx),</span> or{" "}
        <span className="font-medium text-zinc-900">picture of a document</span>—or paste text below. We pull out
        the wording so Daubo can mirror your real roles and dates.{" "}
        <span className="text-zinc-500">
          Always skim the result: formatting can be imperfect, especially from scans or photos.
        </span>{" "}
        Edit the text, then tap Save.
      </p>
      {updated ? (
        <p className="text-xs text-zinc-500">Last updated: {new Date(updated).toLocaleString()}</p>
      ) : null}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={`rounded-[28px] border-2 border-dashed px-5 py-10 text-center transition ${
          dragActive
            ? "border-emerald-500/70 bg-emerald-50"
            : "border-zinc-300 bg-white hover:border-zinc-400"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp,image/gif"
          onChange={onFileInputChange}
        />
        <FileUp className="mx-auto h-8 w-8 text-zinc-500" strokeWidth={1.5} />
        <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
          Drop your resume here
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Drop a file here or{" "}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="font-semibold text-emerald-600 hover:underline disabled:opacity-50"
          >
            browse
          </button>
        </p>
        <p className="mt-1 text-xs text-zinc-500">PDF or DOCX · Up to 12 MB</p>
        {uploading ? (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your file…
          </p>
        ) : null}
      </div>

      {agentReply ? (
        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            Quick note
          </p>
          <p className="mt-1 leading-relaxed">{agentReply}</p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          File name (optional)
        </span>
        <input
          className="mt-1 w-full max-w-md rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900"
          placeholder="e.g. Resume_Jan_2025.pdf"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          Your résumé text (edit freely)
        </span>
        <textarea
          className="mt-1 min-h-[320px] w-full rounded-[28px] border border-zinc-300 bg-white px-4 py-4 font-mono text-sm leading-relaxed text-zinc-800 outline-none focus:border-zinc-400"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Upload a file above or paste your experience, education, skills…"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save resume"}
        </button>
        <button
          type="button"
          onClick={load}
          disabled={uploading}
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-white disabled:opacity-50"
        >
          Reload
        </button>
      </div>
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
