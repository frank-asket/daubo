// ─── User & Auth ───────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro'

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  plan: Plan
  created_at: string
}

export interface UserPreferences {
  target_role: string
  location: string
  min_salary?: number
  seniority: 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Staff' | 'Principal'
  skills: string[]
  excluded_companies?: string[]
}

// ─── Resume ────────────────────────────────────────────────────────────────

export interface ResumeProfile {
  id: string
  storage_path: string
  file_name: string
  parsed_profile: ParsedProfile
  preferences: UserPreferences
  version: number
  created_at: string
}

export interface ParsedProfile {
  name: string
  headline: string
  experience_years: number
  skills: string[]
  top_skills: string[]
  archetypes: string[]         // e.g. ['LLMOps', 'Agentic Systems', 'ML Platform']
  gaps: string[]
  summary: string
}

// ─── Jobs ──────────────────────────────────────────────────────────────────

export type JobSource = 'ashby' | 'greenhouse' | 'lever' | 'linkedin' | 'wellfound' | 'manual'

export interface Job {
  id: string
  source: JobSource
  external_id: string
  title: string
  company: string
  location: string
  salary_range?: string
  description: string
  url: string
  posted_at?: string
  discovered_at: string
  logo_url?: string
}

export interface DimensionScores {
  tech: number
  culture: number
  seniority: number
  comp: number
  location: number
}

export interface JobScore {
  job_id: string
  fit_score: number            // 1.0 – 5.0
  fit_reasons: string[]
  risk_flags: string[]
  dimension_scores: DimensionScores
  channel_recommendation: Channel
  scored_at: string
}

export type JobWithScore = Job & { score: JobScore }

// ─── Applications ──────────────────────────────────────────────────────────

export type ApplicationStatus =
  | 'saved' | 'pending' | 'applied' | 'interview' | 'offer' | 'rejected'

export type Channel = 'email' | 'linkedin' | 'company_site'

export interface Application {
  id: string
  user_id: string
  job: Job
  score?: JobScore
  status: ApplicationStatus
  channel: Channel
  applied_at?: string
  last_updated: string
  idempotency_key?: string
  notes?: string
  is_stale: boolean
  dedup_group?: string
}

// ─── Integrity Check ───────────────────────────────────────────────────────

export type IntegrityChangeType = 'deduplicate' | 'mark_stale' | 'normalize_status'

export interface IntegrityChange {
  type: IntegrityChangeType
  application_ids: string[]
  keep_id?: string
  reason: string
}

export interface IntegrityCheckResult {
  mode: 'dry_run' | 'apply'
  summary: {
    duplicates: number
    stale: number
    status_fixes: number
  }
  changes: IntegrityChange[]
}

// ─── Autopilot ─────────────────────────────────────────────────────────────

export type AutopilotScope = 'all' | 'failed_only' | 'gmail_failed_only'
export type RunStatus = 'queued' | 'running' | 'done' | 'failed'

export interface AutopilotRunItem {
  application_id: string
  status: 'success' | 'failed' | 'skipped'
  retryable: boolean
  suggested_action?: string
  latency_ms: number
  error?: string
}

export interface AutopilotRun {
  run_id: string
  status: RunStatus
  scope: AutopilotScope
  replayed: boolean
  item_results?: AutopilotRunItem[]
  started_at?: string
  completed_at?: string
}

// ─── Approvals ─────────────────────────────────────────────────────────────

export type ApprovalType = 'cover_letter' | 'linkedin_note' | 'follow_up'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited'

export interface Approval {
  id: string
  application: Application
  type: ApprovalType
  channel: Channel
  subject?: string
  draft_body: string
  status: ApprovalStatus
  approved_at?: string
  sent_at?: string
  idempotency_key: string
  created_at: string
}

// ─── Prep ──────────────────────────────────────────────────────────────────

export interface StarStory {
  situation: string
  task: string
  action: string
  result: string
  reflection: string
  tags: string[]
}

export interface PrepSession {
  id: string
  application: Application
  questions: string[]
  star_stories: StarStory[]
  company_brief?: string
  created_at: string
}

// ─── Agents ────────────────────────────────────────────────────────────────

export type AgentName =
  | 'discovery' | 'scorer' | 'tailor' | 'writer'
  | 'apply' | 'prep' | 'monitor' | 'orchestrator'

export type AgentStatus = 'active' | 'running' | 'idle' | 'error'

export interface AgentState {
  name: AgentName
  label: string
  description: string
  status: AgentStatus
  progress?: number           // 0–1
  message?: string
  items_processed?: number
  last_run?: string
}

export interface AgentEvent {
  agent: AgentName
  status: AgentStatus
  progress?: number
  message?: string
  items_processed?: number
}

// ─── API helpers ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
}

export interface ApiError {
  error: string
  detail: string
  status: number
}
