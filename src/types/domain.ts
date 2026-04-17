export type Channel = "email" | "linkedin" | "company_site" | "web" | string;

export type ApplicationStatus =
  | "draft"
  | "shortlisted"
  | "package_ready"
  | "ready_to_apply"
  | "applied"
  | "interview"
  | "offer"
  | "closed"
  | string;

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

export type JobListOut = {
  items: JobListItem[];
  page: number;
  page_size: number;
  total: number;
};

export type Application = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  status: ApplicationStatus;
  notes?: string | null;
  job_url?: string | null;
  apply_channel?: Channel | null;
  job_description?: string | null;
  package_draft?: Record<string, unknown> | null;
  interview_prep?: Record<string, unknown> | null;
  updated_at: string;
};

export type IntegrityChange = {
  application_id: string;
  action: string;
  reason: string;
  before?: string | null;
  after?: string | null;
  duplicate_of_id?: string | null;
};

export type IntegrityReport = {
  dry_run: boolean;
  stale_days: number;
  scanned: number;
  duplicates_found: number;
  duplicates_removed: number;
  statuses_normalized: number;
  stale_flagged: number;
  changes: IntegrityChange[];
};

export type ApprovalQueueItem = {
  id: string;
  application_id: string;
  title: string;
  company: string;
  location?: string | null;
  apply_channel?: Channel | null;
  draft_body?: string;
  package_draft?: { cover_letter?: string; linkedin_note?: string } | null;
  approval_type?: string;
  channel: "email" | "linkedin" | string;
  application_status?: ApplicationStatus;
};

export type AgentStatusItem = {
  agent_id: string;
  name: string;
  description: string;
  state: "active" | "working" | "idle" | string;
  last_run_at?: string | null;
};

export type AgentStatusOut = {
  last_orchestration_at: string | null;
  agents: AgentStatusItem[];
};
