# `apps/web`

Phase 0 scaffold for the Next.js 14 App Router frontend.

Current implementation continues to run from the repository root while migration is in progress.
This package exposes workspace scripts so Turborepo can orchestrate web tasks during the transition.

Planned target structure:

- `app/(auth)` for login and onboarding
- `app/(dashboard)` for discover, pipeline, approvals, prep, resume, and agents
- `app/api` for NextAuth route handlers
- `components`, `hooks`, `lib`, `stores`, and `types`
