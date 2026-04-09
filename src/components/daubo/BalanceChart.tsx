"use client";

import { useId, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const frames = ["1W", "1M", "3M", "1Y"];

const makeData = () =>
  Array.from({ length: 24 }, (_, i) => ({
    t: `${i + 1}`,
    v: 48 + Math.sin(i / 3) * 8 + i * 1.2,
  }));

export function BalanceChart({
  compact,
  trackedRoles,
}: {
  compact?: boolean;
  /** Live count from Daubo API; chart curve stays illustrative until historic metrics exist */
  trackedRoles?: number | null;
}) {
  const [range, setRange] = useState("1Y");
  const data = makeData();
  const h = compact ? 160 : 220;
  const gradId = useId().replace(/:/g, "");

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">Pipeline</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {trackedRoles != null ? `${trackedRoles} roles` : "24 roles"}
            </span>
            <span
              className={`text-sm font-semibold ${trackedRoles != null ? "text-zinc-500" : "text-emerald-400"}`}
              title={trackedRoles != null ? "Trend when history is wired" : undefined}
            >
              {trackedRoles != null ? "tracked" : "+18%"}
            </span>
          </div>
        </div>
        <div className="flex rounded-full border border-zinc-800 bg-black/40 p-0.5">
          {frames.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setRange(f)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                range === f
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1" style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              tick={{ fill: "#52525b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v: number) => [`${v.toFixed(0)} saved`, "Activity"]}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="#ffffff"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
