"use client";

import { create } from "zustand";
import type {
  AgentStatusItem,
  Application,
  ApprovalQueueItem,
  IntegrityReport,
  JobListItem,
} from "@/types/domain";

type JobsState = {
  jobs: JobListItem[];
  total: number;
  setJobs: (jobs: JobListItem[], total: number) => void;
};

export const useDomainJobsStore = create<JobsState>((set) => ({
  jobs: [],
  total: 0,
  setJobs: (jobs, total) => set({ jobs, total }),
}));

type PipelineState = {
  applications: Application[];
  integrity: IntegrityReport | null;
  setApplications: (applications: Application[]) => void;
  setIntegrity: (report: IntegrityReport | null) => void;
};

export const useDomainPipelineStore = create<PipelineState>((set) => ({
  applications: [],
  integrity: null,
  setApplications: (applications) => set({ applications }),
  setIntegrity: (integrity) => set({ integrity }),
}));

type ApprovalsState = {
  approvals: ApprovalQueueItem[];
  setApprovals: (approvals: ApprovalQueueItem[]) => void;
  removeApproval: (id: string) => void;
};

export const useDomainApprovalsStore = create<ApprovalsState>((set) => ({
  approvals: [],
  setApprovals: (approvals) => set({ approvals }),
  removeApproval: (id) =>
    set((state) => ({
      approvals: state.approvals.filter((approval) => approval.id !== id),
    })),
}));

type AgentsState = {
  agents: AgentStatusItem[];
  setAgents: (agents: AgentStatusItem[]) => void;
};

export const useDomainAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  setAgents: (agents) => set({ agents }),
}));
