import { create } from 'zustand'
import type {
  JobWithScore, Application, Approval, AgentState,
  IntegrityCheckResult, AutopilotRun, AgentName,
} from '@/types'

// ─── Job Store ─────────────────────────────────────────────────────────────

interface JobStore {
  jobs: JobWithScore[]
  total: number
  loading: boolean
  minFit: number
  locationFilter: string
  setJobs: (jobs: JobWithScore[], total: number) => void
  setLoading: (v: boolean) => void
  setMinFit: (v: number) => void
  setLocationFilter: (v: string) => void
  dismissJob: (id: string) => void
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  total: 0,
  loading: false,
  minFit: 0,
  locationFilter: '',
  setJobs: (jobs, total) => set({ jobs, total }),
  setLoading: (loading) => set({ loading }),
  setMinFit: (minFit) => set({ minFit }),
  setLocationFilter: (locationFilter) => set({ locationFilter }),
  dismissJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
}))

// ─── Pipeline Store ────────────────────────────────────────────────────────

interface PipelineStore {
  applications: Application[]
  loading: boolean
  integrityResult: IntegrityCheckResult | null
  integrityLoading: boolean
  setApplications: (apps: Application[]) => void
  setLoading: (v: boolean) => void
  setIntegrityResult: (r: IntegrityCheckResult | null) => void
  setIntegrityLoading: (v: boolean) => void
  updateStatus: (id: string, status: Application['status']) => void
}

export const usePipelineStore = create<PipelineStore>((set) => ({
  applications: [],
  loading: false,
  integrityResult: null,
  integrityLoading: false,
  setApplications: (applications) => set({ applications }),
  setLoading: (loading) => set({ loading }),
  setIntegrityResult: (integrityResult) => set({ integrityResult }),
  setIntegrityLoading: (integrityLoading) => set({ integrityLoading }),
  updateStatus: (id, status) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, status } : a
      ),
    })),
}))

// ─── Approval Store ────────────────────────────────────────────────────────

interface ApprovalStore {
  approvals: Approval[]
  loading: boolean
  setApprovals: (a: Approval[]) => void
  setLoading: (v: boolean) => void
  removeApproval: (id: string) => void
  updateApproval: (id: string, patch: Partial<Approval>) => void
}

export const useApprovalStore = create<ApprovalStore>((set) => ({
  approvals: [],
  loading: false,
  setApprovals: (approvals) => set({ approvals }),
  setLoading: (loading) => set({ loading }),
  removeApproval: (id) =>
    set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  updateApproval: (id, patch) =>
    set((s) => ({
      approvals: s.approvals.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),
}))

// ─── Agent Store ───────────────────────────────────────────────────────────

interface AgentStore {
  agents: AgentState[]
  currentRun: AutopilotRun | null
  setAgents: (a: AgentState[]) => void
  updateAgent: (name: AgentName, patch: Partial<AgentState>) => void
  setCurrentRun: (r: AutopilotRun | null) => void
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  currentRun: null,
  setAgents: (agents) => set({ agents }),
  updateAgent: (name, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.name === name ? { ...a, ...patch } : a)),
    })),
  setCurrentRun: (currentRun) => set({ currentRun }),
}))
