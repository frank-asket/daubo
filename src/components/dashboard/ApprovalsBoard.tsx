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
      <p className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {header}
      </p>

      {error ? (
        <p className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.8),0_18px_40px_rgba(24,24,27,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-zinc-950">{item.company}</p>
                <p className="text-base text-zinc-700">{item.role}</p>
              </div>
              <span className="rounded-full border border-zinc-200 bg-[#f3f1ee] px-3 py-1 text-xs font-medium text-zinc-700">
                {(item.apply_channel || "company site").trim()}
              </span>
            </div>
            <p className="mt-3 rounded-2xl bg-[#f5f3ee] px-4 py-4 text-base leading-relaxed text-zinc-700">
              {item.notes?.trim() || "Draft generated. Review and approve in pipeline handoff."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.98]"
              >
                Approve &amp; send
              </Link>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
              >
                Edit draft
              </Link>
              <Link
                href={`/dashboard/pipeline?focus=${encodeURIComponent(item.id)}`}
                className="rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98]"
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
