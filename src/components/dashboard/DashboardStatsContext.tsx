"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { dauboBffUrl } from "@/lib/daubo-api";

export type CareerStats = {
  ready_to_submit: number;
  package_ready: number;
  exploring: number;
  applied_or_interview: number;
};

export type MeStats = {
  application_count: number;
  has_resume: boolean;
  career?: CareerStats;
};

type DashboardStatsContextValue = {
  stats: MeStats | null;
  error: string | null;
  statsReady: boolean;
  reload: () => Promise<void>;
};

const DashboardStatsContext = createContext<DashboardStatsContextValue | null>(null);

export function DashboardStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<MeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statsReady, setStatsReady] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(dauboBffUrl("v1/me/stats"), { credentials: "same-origin" });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as {
          detail?: unknown;
          error?: string;
        };
        const detail = j.detail;
        let msg: string | null =
          typeof detail === "string"
            ? detail.trim() || null
            : Array.isArray(detail)
              ? JSON.stringify(detail)
              : detail != null
                ? String(detail).trim() || null
                : null;
        if (!msg && typeof j.error === "string" && j.error.trim()) {
          msg = j.error.trim();
        }
        setStats(null);
        setError(msg ?? `Stats ${r.status}`);
        return;
      }
      setStats((await r.json()) as MeStats);
    } catch {
      setStats(null);
      setError("Could not load dashboard stats");
    } finally {
      setStatsReady(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(
    () => ({ stats, error, statsReady, reload }),
    [stats, error, statsReady, reload],
  );

  return (
    <DashboardStatsContext.Provider value={value}>{children}</DashboardStatsContext.Provider>
  );
}

export function useDashboardStats(): DashboardStatsContextValue {
  const ctx = useContext(DashboardStatsContext);
  if (!ctx) {
    throw new Error("useDashboardStats must be used under DashboardStatsProvider");
  }
  return ctx;
}
