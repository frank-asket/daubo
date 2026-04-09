"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { dauboBffUrl } from "@/lib/daubo-api";

type Application = {
  id: string;
  title: string;
  company: string;
  status: string;
};

export function InterviewPrepBoard() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(dauboBffUrl("v1/me/applications"), { credentials: "same-origin" });
      if (!r.ok) return;
      const all = (await r.json()) as Application[];
      setItems(all.filter((a) => a.status === "interview" || a.status === "applied"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm text-zinc-500">
        Focus prep on roles you marked <strong className="text-zinc-300">interview</strong> or{" "}
        <strong className="text-zinc-300">applied</strong> in your pipeline. Full mock sessions
        and question banks will plug into the same context next.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No active interview targets yet. Update a role to &quot;interview&quot; in{" "}
          <Link href="/dashboard/applications" className="text-emerald-400 hover:underline">
            Applications
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] px-4 py-4"
            >
              <p className="font-semibold text-white">
                {row.title} <span className="text-zinc-500">· {row.company}</span>
              </p>
              <p className="mt-2 text-xs uppercase tracking-wide text-zinc-500">{row.status}</p>
              <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                <li>☐ Reframe two wins from your Daubo resume for this role</li>
                <li>☐ Draft answers for &quot;Why this company?&quot; and &quot;Why now?&quot;</li>
                <li>☐ List three questions you will ask the hiring manager</li>
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
