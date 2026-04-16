"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type ApprovalQueueItem = {
  id: string;
  application_id: string;
  title: string;
  company: string;
  apply_channel: string | null;
  /** Normalized handoff channel from API (email | linkedin | web). */
  channel?: string;
  notes: string | null;
  application_status: string;
  /** Server-normalized draft snippet; used when package fields are empty. */
  draft_body?: string;
  package_draft?: {
    cover_letter?: string;
    linkedin_note?: string;
  } | null;
};

type DraftEdits = { cover_letter: string; linkedin_note: string };

function isLinkedInChannel(item: ApprovalQueueItem) {
  return item.apply_channel?.toLowerCase() === "linkedin" || item.channel === "linkedin";
}

function initialEditsForItem(item: ApprovalQueueItem): DraftEdits {
  const pkg = item.package_draft;
  const fallback = (item.draft_body ?? "").trim();
  const li = isLinkedInChannel(item);
  const cov = (pkg?.cover_letter ?? "").trim();
  const note = (pkg?.linkedin_note ?? "").trim();
  return {
    cover_letter: cov || (li ? "" : fallback),
    linkedin_note: note || (li ? fallback : ""),
  };
}

export function ApprovalsBoard() {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [draftEdits, setDraftEdits] = useState<Record<string, DraftEdits>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/approvals"), { credentials: "same-origin" });
      if (!r.ok) {
        setItems([]);
        setError("Could not load pending approvals right now.");
        return;
      }
      const list = (await r.json()) as ApprovalQueueItem[];
      setItems(list);
    } catch {
      setItems([]);
      setError("Could not load pending approvals right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const next: Record<string, DraftEdits> = {};
    for (const item of items) {
      next[item.id] = initialEditsForItem(item);
    }
    setDraftEdits(next);
  }, [items]);

  async function approve(item: ApprovalQueueItem) {
    setActingId(item.id);
    setError(null);
    try {
      const ed = draftEdits[item.id] ?? initialEditsForItem(item);
      const li = isLinkedInChannel(item);
      const body: { cover_letter?: string; linkedin_note?: string } = {};
      if (li) body.linkedin_note = ed.linkedin_note;
      else body.cover_letter = ed.cover_letter;
      const r = await fetch(dauboBffUrl(`v1/me/approvals/${item.id}/approve`), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? "Could not approve this application.");
      }
      const data = (await r.json()) as { gmail_draft?: { gmail_web_url?: string } };
      const gurl = data.gmail_draft?.gmail_web_url;
      if (gurl) window.open(gurl, "_blank", "noopener,noreferrer");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not approve this application.");
    } finally {
      setActingId(null);
    }
  }

  async function reject(approvalId: string) {
    setActingId(approvalId);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/approvals/${approvalId}/reject`), {
        method: "POST",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? "Could not reject this approval.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reject this approval.");
    } finally {
      setActingId(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const header = useMemo(() => {
    if (loading) return "Loading applications ready for your review…";
    if (items.length === 0) return "No approvals pending. New AI drafts will appear here.";
    if (items.length === 1) return "1 application ready for your review. AI drafted; nothing sent until you approve.";
    return `${items.length} applications ready for your review. AI drafted; nothing sent until you approve.`;
  }, [items.length, loading]);

  return (
    <section className="space-y-4">
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {header}
      </p>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200">
                  {item.company.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{item.company}</p>
                  <p className="text-sm text-zinc-300">{item.title}</p>
                </div>
              </div>
              <span className="rounded-[6px] border border-zinc-700 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                {isLinkedInChannel(item) ? "👥 LinkedIn" : "✉ Email"}
              </span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Subject:{" "}
              {isLinkedInChannel(item)
                ? "LinkedIn connection note"
                : `Application: ${item.title}`}
            </p>
            <div className="mt-3 space-y-2">
              {isLinkedInChannel(item) ? (
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    LinkedIn note (edit before approve)
                  </span>
                  <textarea
                    className="mt-1 min-h-[140px] w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
                    value={draftEdits[item.id]?.linkedin_note ?? ""}
                    onChange={(e) =>
                      setDraftEdits((prev) => {
                        const cur = prev[item.id] ?? initialEditsForItem(item);
                        return {
                          ...prev,
                          [item.id]: { ...cur, linkedin_note: e.target.value },
                        };
                      })
                    }
                    disabled={actingId !== null}
                    placeholder="Connection note shown to the recipient…"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Email / cover text (edit before approve)
                  </span>
                  <textarea
                    className="mt-1 min-h-[160px] w-full resize-y rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
                    value={draftEdits[item.id]?.cover_letter ?? ""}
                    onChange={(e) =>
                      setDraftEdits((prev) => {
                        const cur = prev[item.id] ?? initialEditsForItem(item);
                        return {
                          ...prev,
                          [item.id]: { ...cur, cover_letter: e.target.value },
                        };
                      })
                    }
                    disabled={actingId !== null}
                    placeholder={
                      item.notes?.trim() ||
                      "Cover letter or email body — nothing is sent until you approve."
                    }
                  />
                </label>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actingId !== null}
                onClick={() => void approve(item)}
                className="rounded-md border border-zinc-600 bg-zinc-100 px-3 py-1.5 text-[12px] font-semibold text-zinc-900 hover:bg-white active:scale-[0.98] disabled:opacity-60"
              >
                Approve &amp; send
              </button>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.application_id)}`}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-900 active:scale-[0.98]"
              >
                Edit draft
              </Link>
              <button
                type="button"
                disabled={actingId !== null}
                onClick={() => void reject(item.id)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
