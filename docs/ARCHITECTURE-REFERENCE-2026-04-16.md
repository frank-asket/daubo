# DAUBO

Full Architecture, Backend Design & Cursor Roadmap  
Version 2026-04-16 · Engineering Reference

## 1. System Overview

Daubo is a multi-agent job search platform. Its architecture is composed of five layers:

- React + TypeScript frontend (Next.js 14 App Router)
- Python FastAPI backend with async task queues (Celery + Redis)
- 8 specialized AI agents orchestrated via a deterministic product layer
- PostgreSQL (via Supabase) for relational data + Redis for queues and idempotency
- Anthropic Claude (`claude-sonnet-4-20250514`) as the AI reasoning backbone

Core principle: AI drafts, user approves, system executes. No outbound action is ever taken without explicit user approval.

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, shadcn/ui | App Router + RSC for streaming |
| State | Zustand + SWR | Lightweight, async-friendly |
| Backend | FastAPI (Python 3.12) | Async, typed, agent-compatible |
| AI | `claude-sonnet-4-20250514` | Best reasoning for scoring + drafting |
| Database | PostgreSQL 16 via Supabase | RLS, Realtime, Storage bundled |
| Cache / Queue | Redis 7 + Celery | Idempotency, distributed locks, task queue |
| Auth | NextAuth + Supabase | Gmail + LinkedIn OAuth |
| File storage | Supabase Storage | Resume PDFs + generated variants |
| Scraping | Playwright (Python) | Headless portal scanning |
| Infra | Docker Compose -> Fly.io | Reproducible locally, cheap in prod |
| Monorepo | Turborepo | Shared types, parallel builds |

## 3. Directory Structure

Top-level monorepo layout:

```text
daubo/
├── apps/
│   ├── web/                  Next.js 14 App Router frontend
│   │   ├── app/
│   │   │   ├── (auth)/       login, onboarding
│   │   │   ├── (dashboard)/  discover, pipeline, approvals, prep, resume, agents
│   │   │   └── api/          NextAuth route handlers
│   │   ├── components/       ui/, jobs/, pipeline/, approvals/, prep/, agents/
│   │   ├── hooks/            useJobs, useApprovals, useAgentStream (SSE), etc.
│   │   ├── lib/              api.ts, supabase.ts, constants.ts
│   │   ├── stores/           Zustand: jobStore, pipelineStore, approvalStore
│   │   └── types/            Shared TypeScript types
│   └── api/                  FastAPI backend
│       ├── routers/          auth, users, resume, jobs, applications, autopilot,
│       │                     approvals, prep, agents
│       ├── agents/           orchestrator, discovery, scorer, tailor, writer,
│       │                     apply, prep_agent, monitor
│       ├── services/         anthropic, gmail, linkedin, resume_parser,
│       │                     portal_scanner, idempotency
│       ├── models/           SQLAlchemy ORM models
│       ├── schemas/          Pydantic request/response schemas
│       ├── tasks/            Celery async tasks
│       ├── db/               async session + Alembic migrations
│       └── tests/
├── packages/shared/          Shared TypeScript types
├── infra/                    docker-compose.yml, Dockerfiles, nginx.conf
├── .cursor/rules/            api.mdc, agents.mdc, frontend.mdc
└── turbo.json
```

## 4. Database Schema

Seven core tables. All user data has `user_id` foreign keys for row-level security.

### `users`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | `gen_random_uuid()` |
| email | TEXT UNIQUE | from OAuth provider |
| name | TEXT |  |
| plan | TEXT | `free` \| `pro` |
| created_at | TIMESTAMPTZ |  |

### `jobs`

| Column | Type | Notes |
|---|---|---|
| id | UUID PK |  |
| source | TEXT | `ashby` \| `greenhouse` \| `lever` \| `linkedin` |
| external_id | TEXT | portal-specific ID |
| title / company / location | TEXT |  |
| description / url | TEXT |  |
| discovered_at | TIMESTAMPTZ |  |
| UNIQUE | (`source`, `external_id`) | prevents duplicate imports |

### `job_scores` (per user)

| Column | Type | Notes |
|---|---|---|
| fit_score | NUMERIC(3,1) | 1.0 to 5.0 |
| fit_reasons | TEXT[] | explainability bullets |
| risk_flags | TEXT[] | review caveats |
| dimension_scores | JSONB | `{tech, culture, seniority, comp, location}` |

### `applications`

| Column | Type | Notes |
|---|---|---|
| status | TEXT | `saved` \| `pending` \| `applied` \| `interview` \| `offer` \| `rejected` |
| channel | TEXT | `email` \| `linkedin` \| `company_site` |
| idempotency_key | TEXT UNIQUE | prevents duplicate applies |
| is_stale | BOOLEAN | set by MonitorAgent |
| dedup_group | UUID | groups duplicate entries |

### `approvals`

| Column | Type | Notes |
|---|---|---|
| type | TEXT | `cover_letter` \| `linkedin_note` \| `follow_up` |
| channel | TEXT | `email` \| `linkedin` |
| draft_body | TEXT | AI-generated, editable |
| status | TEXT | `pending` \| `approved` \| `rejected` \| `edited` |
| sent_at | TIMESTAMPTZ | set only after ApplyAgent executes |
| idempotency_key | TEXT UNIQUE | prevents double-send |

### `autopilot_runs`

| Column | Type | Notes |
|---|---|---|
| status | TEXT | `queued` \| `running` \| `done` \| `failed` |
| scope | TEXT | `all` \| `failed_only` \| `gmail_failed_only` |
| idempotency_key | TEXT UNIQUE | replay key |
| request_fingerprint | TEXT | SHA-256 of payload |
| item_results | JSONB | per-application diagnostics |

## 5. API Contract

### `POST /v1/me/autopilot/run`

Idempotency-aware Smart Prep batch execution.

- **Headers:** `Idempotency-Key: <uuid>` (required)
- **Body:** `{ scope: 'all' | 'failed_only' | 'gmail_failed_only', application_ids: ['uuid', ...] | null }`
- **Responses:**
  - `202 Accepted` - fresh run queued: `{ run_id, status: 'queued', replayed: false }`
  - `200 OK` - replayed: `{ run_id, status: 'done', replayed: true, item_results }`
  - `409 Conflict` - same key, different payload: `{ error: 'idempotency_conflict', prior_run_id }`

### `POST /v1/me/applications/integrity-check`

- **Body:** `{ mode: 'dry_run' | 'apply' }`
- **Response:** `{ mode, summary: { duplicates, stale, status_fixes }, changes: [{ type, application_ids, keep_id, reason }] }`

### `GET /v1/jobs`

- **Query params:** `min_fit` (float), `location` (string), `page` (int)
- **Response:** `{ jobs: [{ id, title, company, fit_score, fit_reasons, risk_flags, dimension_scores, channel_recommendation, salary_range }], total, page }`

### `POST /v1/me/approvals/:id/approve`

- **Body:** `{ edited_body: string | null }`
- **Response:** `{ approval_id, status: 'approved', queued_send: true, send_task_id }`

### `GET /v1/agents/status` (SSE stream)

- **Content-Type:** `text/event-stream`
- **Data payload:** `{ agent, status: running|idle|done|error, progress?, message? }`

## 6. Agent Architecture

Each agent is a Python class implementing `BaseAgent`. Agents never touch HTTP - they receive and return plain dicts. The Orchestrator is the only agent that calls other agents.

| Agent | Trigger | Output |
|---|---|---|
| DiscoveryAgent | Cron 2x daily or manual | Raw job listings from 45+ portals |
| ScorerAgent | Post-discovery per user | `job_scores` rows with 5-dim fit data |
| TailorAgent | User queues apply | Tailored resume variant (PDF/MD) |
| WriterAgent | User queues apply | `approvals` draft rows (cover letter, note) |
| ApplyAgent | Post-approval only | Gmail draft or LinkedIn message sent |
| PrepAgent | On-demand per application | Questions + STAR-R stories |
| MonitorAgent | Cron hourly | Dedup + stale flags in applications |
| OrchestratorAgent | All agent events | Routes tasks, blocks overlaps, enforces gate |

Overlap prevention (Redis distributed lock):

```python
lock_key = f'autopilot:lock:{user_id}'
acquired = await redis.set(lock_key, key, nx=True, ex=300)
if not acquired:
    raise HTTPException(409, 'Overlapping run in progress')
```

## 7. Cursor Roadmap

73 tasks across 8 phases, 13 weeks. Each task maps to a discrete, AI-implementable unit of work in Cursor.

### Phase 0 - Foundation (Week 1-2)

Goal: Monorepo boots, auth works, resume uploads.

- TASK-001 Init Turborepo monorepo with `apps/web` and `apps/api`
- TASK-002 Scaffold Next.js 14 App Router with Tailwind + shadcn/ui
- TASK-003 Scaffold FastAPI app with pydantic-settings, async SQLAlchemy, Alembic
- TASK-004 `docker-compose.yml`: Postgres 16, Redis 7, API, Celery worker
- TASK-005 Supabase auth integration (NextAuth + Supabase provider)
- TASK-006 `POST /v1/me/resume` - upload PDF/DOCX to Supabase Storage
- TASK-007 Resume parser service (pdfplumber + Claude structured extraction)
- TASK-008 User preferences CRUD (`GET/PATCH /v1/me/preferences`)
- TASK-009 Alembic migrations for users, resumes, jobs, applications tables
- TASK-010 Frontend: Onboarding flow (resume upload + preferences form)

### Phase 1 - Discovery & Scoring (Week 3-4)

Goal: Jobs appear with AI fit scores.

- TASK-011 DiscoveryAgent - Playwright scraper for Greenhouse, Ashby, Lever
- TASK-012 `jobs` table + dedup by (`source`, `external_id`)
- TASK-013 ScorerAgent - 5-dimension Claude scoring per user resume
- TASK-014 `GET /v1/jobs` with `min_fit`, `location`, `page` query params
- TASK-015 Celery beat cron: discovery runs 2x daily per user
- TASK-016 Frontend: Discover panel - JobCard, FitScoreBar, filters
- TASK-017 Frontend: Zustand `jobStore` + `useJobs` hook with SWR
- TASK-018 Frontend: Real-time score streaming via SSE (`useAgentStream` hook)
- TASK-019 Redis caching for job scores (TTL 6h)
- TASK-020 Unit tests: scorer output schema validation

### Phase 2 - Pipeline & Integrity (Week 5)

Goal: Applications tracked, integrity checks run.

- TASK-021 `applications` table full CRUD (`GET/POST/PATCH /v1/me/applications`)
- TASK-022 MonitorAgent - dedup rules, stale detection, status normalization
- TASK-023 `POST /v1/me/applications/integrity-check` (dry-run + apply modes)
- TASK-024 Frontend: Pipeline panel - PipelineTable, status badges, filter tabs
- TASK-025 Frontend: IntegrityBanner - diff preview with row jump actions
- TASK-026 Supabase Realtime subscription for application status updates
- TASK-027 Integration test: integrity dry-run vs apply mode parity

### Phase 3 - Smart Prep & Idempotency (Week 6-7)

Goal: Batch prep runs safely without overlap or duplicates.

- TASK-028 `idempotency.py` service (Redis-backed, SHA-256 fingerprint, 24h TTL)
- TASK-029 `autopilot_runs` table + Alembic migration
- TASK-030 `POST /v1/me/autopilot/run` - idempotency contract (`202 / 200 / 409`)
- TASK-031 Orchestrator overlap prevention (Redis distributed lock, 5-min TTL)
- TASK-032 TailorAgent - Claude resume variant per JD (Markdown output)
- TASK-033 WriterAgent - cover letter + LinkedIn note draft generation
- TASK-034 Retry scopes: `failed_only`, `gmail_failed_only`
- TASK-035 Item-level diagnostics: status category, retryability, latency
- TASK-036 Frontend: Agents panel - AgentStatusCard, SSE live indicators
- TASK-037 Integration test: overlap + idempotency interaction ordering

### Phase 4 - Approvals & Apply Handoff (Week 8-9)

Goal: Human-in-the-loop gate works end to end.

- TASK-038 `approvals` table + Alembic migration
- TASK-039 `GET /v1/me/approvals` - pending queue
- TASK-040 `POST /v1/me/approvals/:id/approve` (optionally with edited body)
- TASK-041 `POST /v1/me/approvals/:id/reject`
- TASK-042 ApplyAgent - Gmail draft creation (post-approval, never auto-send)
- TASK-043 ApplyAgent - LinkedIn note dispatch (post-approval)
- TASK-044 Gmail OAuth connect flow + token refresh
- TASK-045 LinkedIn OAuth connect flow
- TASK-046 Gmail status/disconnect error handling with user-facing messages
- TASK-047 Frontend: Approvals panel - ApprovalCard, DraftPreview, channel badges
- TASK-048 Frontend: Apply handoff - channel-aware UI (Gmail hidden for non-email)
- TASK-049 Frontend: Gmail status refresh button in handoff flow

### Phase 5 - Interview Prep (Week 10)

Goal: STAR-R prep sessions generated per application.

- TASK-050 PrepAgent - 5 tailored interview questions per JD + resume
- TASK-051 PrepAgent - STAR-R story generation (Situation, Task, Action, Result, Reflection)
- TASK-052 PrepAgent - company brief (recent news, tech stack, culture signals)
- TASK-053 `prep_sessions` table + Alembic migration
- TASK-054 `GET /v1/me/prep?application_id=` + `POST /v1/me/prep/generate`
- TASK-055 Frontend: Prep panel - PrepCard, StarStoryPanel, streaming output

### Phase 6 - Orchestrator Chat & Observability (Week 11)

Goal: Users can query their pipeline in natural language.

- TASK-056 OrchestratorAgent chat endpoint - `POST /v1/agents/chat` (SSE stream)
- TASK-057 Orchestrator system prompt: full pipeline context injected per user
- TASK-058 Run history observability: `replayed_at`, `fresh_run` flag in responses
- TASK-059 `GET /v1/agents/status` SSE stream for live agent state
- TASK-060 Frontend: OrchestratorChat component - streaming, suggested prompts
- TASK-061 Frontend: Run history log in Agents panel

### Phase 7 - Hardening & Production (Week 12-13)

Goal: Production-ready, observable, and secure.

- TASK-062 Rate limiting per user (slowapi + Redis)
- TASK-063 Row-level security (RLS) in Supabase for all user data
- TASK-064 Structured logging (structlog) + Sentry error tracking
- TASK-065 Prometheus metrics endpoint + Grafana dashboard
- TASK-066 Auth verification in dev environment (unblock local QA)
- TASK-067 Python version pinning in `pyproject.toml` (3.12 minimum)
- TASK-068 E2E tests: Playwright - full apply flow, resume upload to approval
- TASK-069 API documentation: auto-generated OpenAPI + ReDoc at `/docs`
- TASK-070 Security audit: OAuth token storage, SSRF prevention in portal scanner
- TASK-071 CI/CD: GitHub Actions - lint -> test -> build -> deploy
- TASK-072 Fly.io or Railway deployment config

## 8. Cursor Rules (`.cursor/rules/`)

### `api.mdc`

- All FastAPI routes must be async.
- All database access goes through the async SQLAlchemy session injected as a dependency.
- Never access the DB directly in a router - use a service function.
- All endpoints return typed Pydantic response models.
- `Idempotency-Key` header must be validated before any mutating POST in autopilot and approvals routers.

### `agents.mdc`

- All agents inherit from `BaseAgent` in `agents/base.py`.
- Agents never directly call routers or touch HTTP - they receive and return plain dicts.
- The orchestrator is the only agent that calls other agents.
- The ApplyAgent must check approval status before any outbound action - raise if not approved.
- Agent prompts live in `agents/{name}_prompts.py`, never inline.

### `frontend.mdc`

- All API calls go through `lib/api.ts` - never fetch directly in components.
- Streaming responses use the `useAgentStream` hook (SSE).
- Zustand stores own server-derived state; SWR handles fetching and revalidation.
- The ApprovalCard must always show channel badge and draft preview before any action button.
- Gmail UI elements are conditionally rendered - only when `channel == 'email'` AND Gmail is connected.

---

Daubo · Architecture Reference · 2026-04-16
