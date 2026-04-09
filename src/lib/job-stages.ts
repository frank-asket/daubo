/**
 * Internal API values for application status (snake_case).
 * Labels are short, plain English for non-technical users in selects and charts.
 */
export const JOB_STAGE_VALUES = [
  "draft",
  "shortlisted",
  "package_ready",
  "ready_to_apply",
  "applied",
  "interview",
  "offer",
  "closed",
] as const;

export type JobStageValue = (typeof JOB_STAGE_VALUES)[number];

const LABELS: Record<string, string> = {
  draft: "Exploring",
  shortlisted: "Interested",
  package_ready: "Materials ready",
  ready_to_apply: "Ready to apply",
  ready: "Ready to apply",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

/** Display label for a stored status value (handles legacy `ready`). */
export function jobStageLabel(status: string): string {
  const key = status === "ready" ? "ready_to_apply" : status;
  return LABELS[key] ?? status.replace(/_/g, " ");
}
