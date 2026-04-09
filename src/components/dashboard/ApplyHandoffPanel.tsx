"use client";

import { Copy, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

export type PackageDraft = {
  cover_letter?: string;
  linkedin_note?: string;
  checklist?: string[];
  tailored_bullets?: string[];
  channel_hint?: string;
  disclaimer?: string;
} | null;

export type ApplicationHandoff = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  job_url: string | null;
  apply_channel: string | null;
  job_description: string | null;
  package_draft: PackageDraft;
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* ignore */
  }
}

export function ApplyHandoffPanel({
  application,
  onClose,
  onRefresh,
  onStatusChange,
}: {
  application: ApplicationHandoff | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onStatusChange: (id: string, status: string) => Promise<void>;
}) {
  const [jdOverride, setJdOverride] = useState("");
  const [channelOverride, setChannelOverride] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gmailStatus, setGmailStatus] = useState<{
    configured: boolean;
    connected: boolean;
    google_email: string | null;
  } | null>(null);
  const [draftingGmail, setDraftingGmail] = useState(false);

  useEffect(() => {
    if (!application) return;
    setJdOverride(application.job_description ?? "");
    setChannelOverride(application.apply_channel ?? "");
    setError(null);
  }, [application]);

  useEffect(() => {
    if (!application) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [application, onClose]);

  useEffect(() => {
    if (!application) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(dauboBffUrl("v1/me/integrations/gmail/status"), {
          credentials: "same-origin",
        });
        if (!r.ok || cancelled) return;
        setGmailStatus((await r.json()) as {
          configured: boolean;
          connected: boolean;
          google_email: string | null;
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application]);

  const runGenerate = useCallback(async () => {
    if (!application) return;
    setGenerating(true);
    setError(null);
    try {
      const payload: { job_description?: string; apply_channel?: string } = {};
      const jd = jdOverride.trim();
      if (jd) payload.job_description = jd;
      const ch = channelOverride.trim().toLowerCase();
      if (ch && ["linkedin", "email", "web"].includes(ch)) {
        payload.apply_channel = ch;
      }
      const r = await fetch(
        dauboBffUrl(`v1/me/applications/${application.id}/application-package`),
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(Object.keys(payload).length ? payload : {}),
        },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [application, channelOverride, jdOverride, onRefresh]);

  const runGmailDraft = useCallback(async () => {
    if (!application) return;
    setDraftingGmail(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/applications/${application.id}/gmail-draft`), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? r.statusText);
      }
      const data = (await r.json()) as { gmail_web_url?: string };
      const url = data.gmail_web_url ?? "https://mail.google.com/mail/u/0/#drafts";
      window.open(url, "_blank", "noopener,noreferrer");
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gmail draft failed");
    } finally {
      setDraftingGmail(false);
    }
  }, [application, onRefresh]);

  if (!application) return null;

  const draft = application.package_draft;
  const showGmailDraft =
    Boolean(draft?.cover_letter?.trim() || draft?.linkedin_note?.trim()) &&
    Boolean(gmailStatus?.configured);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0c0c0c] shadow-2xl"
        role="dialog"
        aria-labelledby="handoff-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-800 bg-[#0c0c0c]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 id="handoff-title" className="truncate text-sm font-semibold text-white">
              Apply on the official site
            </h2>
            <p className="mt-1 truncate text-xs text-zinc-500">
              {application.title} · {application.company}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-zinc-300">
          <p className="text-xs leading-relaxed text-zinc-500">
            Daubo does not log into LinkedIn or company sites. Open the posting, paste the drafts
            below, and confirm when you have submitted.
          </p>

          <div className="flex flex-wrap gap-2">
            {application.job_url ? (
              <a
                href={application.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
              >
                Open posting
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => onStatusChange(application.id, "ready_to_apply")}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500"
            >
              Mark ready to apply
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(application.id, "applied")}
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
            >
              I submitted this application
            </button>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Job description (improves drafts)
            </span>
            <textarea
              className="mt-1 min-h-[100px] w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-zinc-600"
              value={jdOverride}
              onChange={(e) => setJdOverride(e.target.value)}
              placeholder="Paste the job ad text, then generate the package."
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Channel hint (optional)
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white"
              value={channelOverride || ""}
              onChange={(e) => setChannelOverride(e.target.value)}
            >
              <option value="">Let Daubo infer</option>
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email to HR</option>
              <option value="web">Company careers site</option>
            </select>
          </label>

          <button
            type="button"
            disabled={generating}
            onClick={runGenerate}
            className="w-full rounded-full bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50 sm:w-auto"
          >
            {generating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </span>
            ) : (
              "Generate application package"
            )}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          {showGmailDraft ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
                Gmail draft
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Creates a <strong className="text-zinc-300">draft</strong> in your Gmail with this cover
                letter (and checklist). You send it when ready—Daubo does not auto-send.
              </p>
              {gmailStatus?.connected ? (
                <button
                  type="button"
                  disabled={draftingGmail}
                  onClick={() => void runGmailDraft()}
                  className="mt-3 w-full rounded-full border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 sm:w-auto"
                >
                  {draftingGmail ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating draft…
                    </span>
                  ) : (
                    "Create draft in Gmail"
                  )}
                </button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href="/api/gmail/oauth/start"
                    className="inline-flex rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
                  >
                    Connect Gmail first
                  </a>
                  <a
                    href="/dashboard/settings"
                    className="text-[11px] text-zinc-500 underline hover:text-zinc-400"
                  >
                    Settings
                  </a>
                </div>
              )}
            </div>
          ) : null}

          {draft?.disclaimer ? (
            <p className="text-[11px] text-amber-200/80">{draft.disclaimer}</p>
          ) : null}

          {draft?.channel_hint ? (
            <p className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Suggested channel: </span>
              {draft.channel_hint}
            </p>
          ) : null}

          {draft?.cover_letter ? (
            <section>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Email / cover text
                </h3>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(draft.cover_letter ?? "")}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black p-3 text-xs text-zinc-300">
                {draft.cover_letter}
              </pre>
            </section>
          ) : null}

          {draft?.linkedin_note ? (
            <section>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  LinkedIn note
                </h3>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(draft.linkedin_note ?? "")}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black p-3 text-xs text-zinc-300">
                {draft.linkedin_note}
              </pre>
            </section>
          ) : null}

          {draft?.tailored_bullets && draft.tailored_bullets.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Tailored bullets for your CV
              </h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-zinc-400">
                {draft.tailored_bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {draft?.checklist && draft.checklist.length > 0 ? (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Checklist (you complete on the official site)
              </h3>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-zinc-400">
                {draft.checklist.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {!draft && !generating ? (
            <p className="text-xs text-zinc-600">
              No package yet — add a job description and generate drafts to paste into the employer
              flow.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
