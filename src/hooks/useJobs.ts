"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { dauboBffUrl } from "@/lib/daubo-api";
import { useJobStore, type JobListItem } from "@/stores/jobStore";

type JobListOut = {
  items: JobListItem[];
  page: number;
  page_size: number;
  total: number;
};

const fetcher = async (url: string): Promise<JobListOut> => {
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { detail?: string }).detail ?? "Could not load jobs.");
  }
  return (await r.json()) as JobListOut;
};

export function useJobs({
  minFit = 0,
  location,
  page = 1,
  pageSize = 20,
}: {
  minFit?: number;
  location?: string;
  page?: number;
  pageSize?: number;
}) {
  const setJobs = useJobStore((s) => s.setJobs);
  const params = new URLSearchParams({
    min_fit: String(minFit),
    page: String(page),
    page_size: String(pageSize),
  });
  const loc = (location ?? "").trim();
  if (loc) params.set("location", loc);
  const key = dauboBffUrl(`v1/jobs?${params.toString()}`);
  const swr = useSWR<JobListOut>(key, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
  useEffect(() => {
    setJobs(swr.data?.items ?? []);
  }, [setJobs, swr.data?.items]);
  return swr;
}
