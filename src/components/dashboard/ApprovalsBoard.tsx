"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type ApprovalItem = {
  id: string;
  title: string;
  company: string;
  apply_channel: string | null;
  notes: string | null;
  status: string;
  package_draft?: {
    cover_letter?: string;
    linkedin_note?: string;
  } | null;
};

export function ApprovalsBoard() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) {
        setItems([]);
        setError("Could not load pending approvals right now.");
        return;
      }
      const list = (await r.json()) as ApprovalItem[];
      setItems(
        list.filter((a) => {
          const s = (a.status || "").toLowerCase();
          return s === "ready_to_apply" || s === "ready" || s === "package_ready";
        }),
      );
    } catch {
      setItems([]);
      setError("Could not load pending approvals right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function updateStatus(id: string, status: string) {
    setActingId(id);
    setError(null);
    try {
      const r = await fetch(dauboBffUrl(`v1/me/applications/${id}`), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { detail?: string }).detail ?? "Could not update approval status.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update approval status.");
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
              <div>
                <p className="text-lg font-semibold text-white">{item.company}</p>
                <p className="text-sm text-zinc-300">{item.title}</p>
              </div>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300">
                {(item.apply_channel || "company site").trim()}
              </span>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Subject:{" "}
              {item.apply_channel?.toLowerCase() === "linkedin"
                ? "LinkedIn connection note"
                : `Application: ${item.title}`}
            </p>
            <p className="mt-3 rounded-xl bg-zinc-900/70 px-4 py-4 text-sm leading-relaxed text-zinc-300">
              {item.package_draft?.cover_letter?.trim() ||
                item.package_draft?.linkedin_note?.trim() ||
                item.notes?.trim() ||
                "Draft generated. Review and approve in pipeline handoff."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actingId !== null}
                onClick={() => void updateStatus(item.id, "applied")}
                className="rounded-xl border border-zinc-600 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-white active:scale-[0.98] disabled:opacity-60"
              >
                Approve &amp; send
              </button>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 active:scale-[0.98]"
              >
                Edit draft
              </Link>
              <button
                type="button"
                disabled={actingId !== null}
                onClick={() => void updateStatus(item.id, "closed")}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-60"
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
