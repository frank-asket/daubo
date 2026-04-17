import { apiRequest } from "@/lib/api-client";
import type {
  AgentStatusOut,
  Application,
  ApprovalQueueItem,
  IntegrityReport,
  JobListOut,
} from "@/types/domain";

export const domainApi = {
  jobs: {
    list(params: {
      min_fit?: number;
      location?: string;
      page?: number;
      page_size?: number;
    } = {}) {
      const query = new URLSearchParams();
      if (params.min_fit != null) query.set("min_fit", String(params.min_fit));
      if (params.location?.trim()) query.set("location", params.location.trim());
      if (params.page != null) query.set("page", String(params.page));
      if (params.page_size != null) query.set("page_size", String(params.page_size));
      const tail = query.toString();
      return apiRequest<JobListOut>(`v1/jobs${tail ? `?${tail}` : ""}`);
    },
  },
  applications: {
    list() {
      return apiRequest<Application[]>("v1/me/applications");
    },
    create(body: {
      title: string;
      company: string;
      location?: string | null;
      job_url?: string | null;
      status?: string;
      apply_channel?: string | null;
      job_description?: string | null;
    }) {
      return apiRequest<Application>("v1/me/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    update(applicationId: string, body: Record<string, unknown>) {
      return apiRequest<Application>(`v1/me/applications/${encodeURIComponent(applicationId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    remove(applicationId: string) {
      return apiRequest<void>(`v1/me/applications/${encodeURIComponent(applicationId)}`, {
        method: "DELETE",
      });
    },
    exportCsv() {
      return fetch(`/api/daubo/v1/me/applications/export`, { credentials: "same-origin" });
    },
    integrityCheck(body: { dry_run: boolean; stale_days?: number }) {
      return apiRequest<IntegrityReport>("v1/me/applications/integrity-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    },
  },
  approvals: {
    list(applicationId?: string) {
      const q = applicationId?.trim()
        ? `?application_id=${encodeURIComponent(applicationId.trim())}`
        : "";
      return apiRequest<ApprovalQueueItem[]>(`v1/me/approvals${q}`);
    },
    approve(
      approvalId: string,
      body: { cover_letter?: string; linkedin_note?: string },
      idempotencyKey: string,
    ) {
      return apiRequest<{
        gmail_draft?: { gmail_web_url?: string };
        gmail_warning?: string | null;
        linkedin_handoff?: {
          note_text: string;
          job_url?: string | null;
          context_line?: string;
        } | null;
      }>(`v1/me/approvals/${encodeURIComponent(approvalId)}/approve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });
    },
    reject(approvalId: string, idempotencyKey: string) {
      return apiRequest<Application>(`v1/me/approvals/${encodeURIComponent(approvalId)}/reject`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      });
    },
  },
  agents: {
    status() {
      return apiRequest<AgentStatusOut>("v1/me/agents/status");
    },
  },
};
