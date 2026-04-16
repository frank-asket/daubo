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
  package_draft?: {
    cover_letter?: string;
    linkedin_note?: string;
  } | null;
};

function isLinkedInChannel(item: ApprovalQueueItem) {
  return item.apply_channel?.toLowerCase() === "linkedin" || item.channel === "linkedin";
}

export function ApprovalsBoard() {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
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

  async function approve(approvalId: string) {
    setActingId(approvalId);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/approvals/${approvalId}/approve`), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? "Could not approve this application.");
      }
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
            <div className="relative mt-3 overflow-hidden rounded-xl bg-zinc-900/70 px-4 py-4">
              <p className="max-h-36 overflow-hidden text-sm leading-relaxed text-zinc-300">
                {item.package_draft?.cover_letter?.trim() ||
                  item.package_draft?.linkedin_note?.trim() ||
                  item.notes?.trim() ||
                  "Draft generated. Review and approve in pipeline handoff."}
              </p>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-zinc-900/95 to-transparent" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actingId !== null}
                onClick={() => void approve(item.id)}
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
