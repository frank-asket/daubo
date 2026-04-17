# Security Audit - OAuth Tokens and SSRF

Date: 2026-04-17  
Scope: TASK-070 hardening checks for OAuth token storage and SSRF prevention paths.

## 1) OAuth Token Storage

### Checked
- `backend/app/models.py` stores Gmail refresh tokens in `user_gmail_credentials.refresh_token`.
- `backend/app/services/apply_agent.py` only attempts Gmail draft creation after approval.
- `apps/api/app/routers/me_approvals.py` enforces approval state before transition and send handoff.

### Findings
- Token storage is server-side only; no token exposure in frontend code paths.
- OAuth tokens are not currently encrypted at rest at the application layer.
- User scoping is consistently keyed with `clerk_user_id`.

### Recommendations
1. Add envelope encryption for `refresh_token` using a KMS-backed key (or libsodium secretbox).
2. Rotate tokens and revoke on disconnect path; keep `updated_at` as token-version marker.
3. Add an audit event table for OAuth connect, refresh, revoke, and failure reasons.

## 2) SSRF Prevention in Job Discovery/Portal Scanner

### Checked
- URL safety test coverage exists in `backend/tests/test_url_safety.py`.
- Discovery ingestion in `apps/api/app/routers/jobs.py` persists source URLs from trusted pipelines.

### Findings
- Existing tests indicate SSRF-related guardrails are present.
- Safety controls should remain centralized in URL validation utilities used by all outbound fetchers.

### Recommendations
1. Ensure every outbound HTTP path (crawler, enrichers, preview fetch) passes through a shared allow/deny validator.
2. Block private and link-local address ranges, localhost, and non-http(s) schemes.
3. Log blocked URLs with redaction for operator visibility.

## 3) Residual Risks

- Plaintext token persistence in DB snapshots/backups.
- New fetch paths could bypass URL validator without explicit lint/test guard.

## 4) Status

- TASK-070: Partially completed with test and architecture evidence; this document records current controls and concrete follow-ups.
