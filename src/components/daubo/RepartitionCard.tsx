"use client";

import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#4ade80", "#a1a1aa", "#71717a", "#52525b", "#3b82f6", "#a855f7"];

export function RepartitionCard({
  segments,
}: {
  /** Counts by pipeline stage label (only non-zero segments are drawn). */
  segments: { name: string; value: number }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = useMemo(() => segments.filter((s) => s.value > 0), [segments]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <p className="text-sm font-semibold text-white">By stage</p>
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center" style={{ height: 200 }}>
        {!mounted ? (
          <div className="h-full w-full rounded-lg bg-zinc-900/50" aria-hidden />
        ) : data.length === 0 ? (
          <p className="px-4 text-center text-xs text-zinc-500">
            Stages appear here once you save jobs under My jobs.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={56}
                outerRadius={76}
                paddingAngle={3}
                stroke="none"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-[11px] text-zinc-500">
        {data.map((d, i) => (
          <span key={d.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}
