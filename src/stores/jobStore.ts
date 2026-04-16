"use client";

import { create } from "zustand";

export type JobListItem = {
  id: string;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location?: string | null;
  url?: string | null;
  fit_score?: number | null;
  fit_reasons: string[];
  risk_flags: string[];
  discovered_at: string;
};

type JobStore = {
  jobs: JobListItem[];
  setJobs: (jobs: JobListItem[]) => void;
};

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  setJobs: (jobs) => set({ jobs }),
}));
