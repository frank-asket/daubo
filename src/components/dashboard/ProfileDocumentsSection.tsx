"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Award, FileUp, Loader2, Trash2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";

type DocKind = "certification" | "degree" | "other";

type ProfileDocument = {
  id: string;
  doc_kind: string;
  label: string | null;
  file_name: string | null;
  content_text: string;
  updated_at: string;
};

const KIND_LABELS: Record<string, string> = {
  certification: "Certification",
  degree: "Degree / diploma",
  other: "Other",
};

export function ProfileDocumentsSection() {
  const [items, setItems] = useState<ProfileDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [kind, setKind] = useState<DocKind>("certification");
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/profile-documents"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      const body = (await r.json()) as ProfileDocument[];
      setItems(Array.isArray(body) ? body : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setOk(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_kind", kind);
    const lbl = label.trim();
    if (lbl) fd.append("label", lbl);
    try {
      const r = await fetch(dauboBffUrl("v1/me/profile-documents/upload"), {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        const d = (j as { detail?: unknown }).detail;
        const msg =
          typeof d === "string"
            ? d
            : Array.isArray(d) && d[0]?.msg
              ? String(d[0].msg)
              : `Upload failed (${r.status})`;
        throw new Error(msg);
      }
      setOk("Document saved. It will be included when Daubo builds application drafts and interview prep.");
      setLabel("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/profile-documents/${id}`), {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok && r.status !== 204) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      setOk("Removed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
          <Award className="h-5 w-5 text-emerald-400/90" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">Credentials &amp; education</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Upload certificates, diplomas, or licenses (PDF, Word, or images). Text is extracted the same way as
            your{" "}
            <Link href="/dashboard/resume" className="font-semibold text-emerald-400 hover:underline">
              résumé
            </Link>{" "}
            and used to strengthen{" "}
            <Link href="/dashboard/applications" className="font-semibold text-emerald-400 hover:underline">
              application packages
            </Link>{" "}
            and interview prep—not shown publicly.
          </p>
        </div>
      </div>

      <form
        className="mt-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = fileRef.current?.files?.[0];
          if (!f) {
            setError("Choose a file to upload");
            return;
          }
          void upload(f);
        }}
      >
        <label className="block text-xs font-medium text-zinc-400">
          Document type
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DocKind)}
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="certification">Certification or license</option>
            <option value="degree">Degree / diploma</option>
            <option value="other">Other supporting document</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-400">
          Label (optional)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. RN license, MSc Computer Science"
            className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder:text-zinc-600"
          />
        </label>
        <div className="sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            id="profile-doc-file"
          />
          <label
            htmlFor="profile-doc-file"
            className="flex cursor-pointer flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
          >
            <FileUp className="h-4 w-4 shrink-0 text-emerald-400/80" />
            <span>Choose file… PDF, Word, text, or image</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {uploading ? "Uploading…" : "Upload document"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-400/90">{ok}</p> : null}

      <div className="mt-6 border-t border-zinc-800 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your uploads</h3>
        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No documents yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {items.map((doc) => {
              const title =
                doc.label?.trim() ||
                doc.file_name?.trim() ||
                `${KIND_LABELS[doc.doc_kind] ?? doc.doc_kind} document`;
              const preview = doc.content_text.replace(/\s+/g, " ").trim().slice(0, 180);
              return (
                <li
                  key={doc.id}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-black/40 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{title}</p>
                    <p className="text-xs text-zinc-500">
                      {KIND_LABELS[doc.doc_kind] ?? doc.doc_kind}
                      {doc.updated_at
                        ? ` · Updated ${new Date(doc.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}`
                        : null}
                    </p>
                    {preview ? (
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-600">{preview}{doc.content_text.length > 180 ? "…" : ""}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(doc.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
