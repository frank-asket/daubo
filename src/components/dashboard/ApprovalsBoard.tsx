"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

type ApprovalItem = {
  id: string;
  company: string;
  role: string;
  apply_channel: string | null;
  notes: string | null;
  status: string;
};

export function ApprovalsBoard() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <article key={item.id} className="rounded-2xl border border-zinc-800 bg-[#101010] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-zinc-100">{item.company}</p>
                <p className="text-sm text-zinc-300">{item.role}</p>
              </div>
              <span className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
                {(item.apply_channel || "company site").trim()}
              </span>
            </div>
            <p className="mt-3 rounded-xl bg-zinc-900/70 px-3 py-3 text-sm text-zinc-300">
              {item.notes?.trim() || "Draft generated. Review and approve in pipeline handoff."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-xl border border-zinc-600 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Approve &amp; send
              </Link>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Edit draft
              </Link>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              >
                Reject
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
