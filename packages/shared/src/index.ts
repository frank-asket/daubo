export type Uuid = string;

export type JobChannel = "email" | "linkedin" | "company_site";

export type ApplicationStatus =
  | "saved"
  | "pending"
  | "applied"
  | "interview"
  | "offer"
  | "rejected";
