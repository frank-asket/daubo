"use client";

import { useEffect, useId, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

const frames = ["1W", "1M", "3M", "1Y"];

/** Illustrative series only (not historic job counts). Baseline bumps slightly when user has saved jobs so the curve reflects “activity”. */
const makeData = (trackedHint: number | null) => {
  const base = trackedHint != null && trackedHint > 0 ? 42 + Math.min(trackedHint * 2, 36) : 48;
  return Array.from({ length: 24 }, (_, i) => ({
    t: `${i + 1}`,
    v: base + Math.sin(i / 3) * 8 + i * 1.2,
  }));
};

export function BalanceChart({
  compact,
  trackedRoles,
}: {
  compact?: boolean;
  /** Live count from Daubo API; chart curve stays illustrative until historic metrics exist */
  trackedRoles?: number | null;
}) {
  const [range, setRange] = useState("1Y");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const data = makeData(trackedRoles ?? null);
  const h = compact ? 160 : 220;
  const gradId = useId().replace(/:/g, "");

  // Recharts measures the DOM on mount; SSR HTML never matches → React #418 hydration errors.
  if (!mounted) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-zinc-500">Jobs you’re tracking</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {trackedRoles != null
                ? `${trackedRoles} job${trackedRoles === 1 ? "" : "s"}`
                : "—"}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-zinc-900/50" style={{ height: h }} aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">Jobs you’re tracking</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {trackedRoles != null
                ? `${trackedRoles} job${trackedRoles === 1 ? "" : "s"}`
                : "—"}
            </span>
            <span
              className={`text-sm font-semibold ${trackedRoles != null ? "text-zinc-500" : "text-emerald-400"}`}
              title={
                trackedRoles != null
                  ? "Illustrative trend—your exact history chart is coming"
                  : "Preview only until you save jobs"
              }
            >
              {trackedRoles != null ? "saved in Daubo" : "sample chart"}
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
              formatter={(v: number) => [`${v.toFixed(0)} (example)`, "Trend"]}
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
