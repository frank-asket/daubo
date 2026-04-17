# Daubo — Full Architecture, Backend Design & Roadmap

**Version:** 2026-04-16 | **Status:** Engineering Reference

---

## 1. System Overview

Daubo is a **multi-agent job search platform** composed of:

- A **React + TypeScript frontend** (Next.js App Router)
- A **Python FastAPI backend** with async task queues
- **8 specialized AI agents** orchestrated via a deterministic layer
- **PostgreSQL** for relational data + **Redis** for queues and idempotency
- **Anthropic Claude** (claude-sonnet-4-20250514) as the AI backbone
- **Gmail OAuth** and **LinkedIn OAuth** for channel-aware apply
- **Supabase** for auth, file storage (resumes), and real-time subscriptions

The core principle: **AI drafts, user approves, system executes.** No outbound action (email, LinkedIn message, form submission) is ever taken without an explicit user approval.

---

## 2. Directory Structure

```
daubo/
├── apps/
│   ├── web/                          # Next.js 14 App Router frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── onboarding/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        # Sidebar shell
│   │   │   │   ├── discover/page.tsx
│   │   │   │   ├── pipeline/page.tsx
│   │   │   │   ├── approvals/page.tsx
│   │   │   │   ├── prep/page.tsx
│   │   │   │   ├── resume/page.tsx
│   │   │   │   └── agents/page.tsx
│   │   │   ├── api/
│   │   │   │   └── auth/[...nextauth]/route.ts
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── jobs/
│   │   │   │   ├── JobCard.tsx
│   │   │   │   ├── FitScoreBar.tsx
│   │   │   │   └── JobFilters.tsx
│   │   │   ├── pipeline/
│   │   │   │   ├── PipelineTable.tsx
│   │   │   │   └── IntegrityBanner.tsx
│   │   │   ├── approvals/
│   │   │   │   ├── ApprovalCard.tsx
│   │   │   │   └── DraftPreview.tsx
│   │   │   ├── prep/
│   │   │   │   ├── PrepCard.tsx
│   │   │   │   └── StarStoryPanel.tsx
│   │   │   └── agents/
│   │   │       ├── AgentStatusCard.tsx
│   │   │       └── OrchestratorChat.tsx
│   │   ├── hooks/
│   │   │   ├── useJobs.ts
│   │   │   ├── useApprovals.ts
│   │   │   ├── usePipeline.ts
│   │   │   ├── useAgentStream.ts     # SSE streaming hook
│   │   │   └── useResumeUpload.ts
│   │   ├── lib/
│   │   │   ├── api.ts                # Typed API client
│   │   │   ├── supabase.ts
│   │   │   └── constants.ts
│   │   ├── stores/
│   │   │   ├── jobStore.ts           # Zustand
│   │   │   ├── pipelineStore.ts
│   │   │   └── approvalStore.ts
│   │   └── types/
│   │       └── index.ts              # Shared TypeScript types
│   │
│   └── api/                          # FastAPI backend
│       ├── main.py                   # App entrypoint
│       ├── config.py                 # Settings via pydantic-settings
│       ├── dependencies.py           # Auth, DB, Redis deps
│       │
│       ├── routers/
│       │   ├── auth.py               # /v1/auth — OAuth flows
│       │   ├── users.py              # /v1/me — profile, preferences
│       │   ├── resume.py             # /v1/me/resume — upload, parse
│       │   ├── jobs.py               # /v1/jobs — discovery, scoring
│       │   ├── applications.py       # /v1/me/applications — CRUD + integrity
│       │   ├── autopilot.py          # /v1/me/autopilot — Smart Prep runs
│       │   ├── approvals.py          # /v1/me/approvals — queue + actions
│       │   ├── prep.py               # /v1/me/prep — interview prep
│       │   └── agents.py             # /v1/agents — status, orchestrator
│       │
│       ├── agents/                   # Agent implementations
│       │   ├── base.py               # BaseAgent protocol
│       │   ├── orchestrator.py       # Routes tasks, enforces approvals
│       │   ├── discovery.py          # Scans portals, returns listings
│       │   ├── scorer.py             # Fit scoring 1.0–5.0 with Claude
│       │   ├── tailor.py             # Resume variant generation
│       │   ├── writer.py             # Cover letter + LinkedIn note drafts
│       │   ├── apply.py              # Channel-aware execution (post-approval)
│       │   ├── prep_agent.py         # STAR-R questions + company briefings
│       │   └── monitor.py            # Dedup, stale detection, normalization
│       │
│       ├── services/
│       │   ├── anthropic.py          # Claude API wrapper + streaming
│       │   ├── gmail.py              # Gmail OAuth + draft creation
│       │   ├── linkedin.py           # LinkedIn OAuth + message send
│       │   ├── resume_parser.py      # PDF/DOCX → structured profile
│       │   ├── portal_scanner.py     # Playwright scraper (Greenhouse, Lever, Ashby)
│       │   └── idempotency.py        # Redis-backed idempotency key store
│       │
│       ├── models/                   # SQLAlchemy ORM models
│       │   ├── user.py
│       │   ├── resume.py
│       │   ├── job.py
│       │   ├── application.py
│       │   ├── approval.py
│       │   ├── autopilot_run.py
│       │   └── prep_session.py
│       │
│       ├── schemas/                  # Pydantic request/response schemas
│       │   ├── jobs.py
│       │   ├── applications.py
│       │   ├── autopilot.py
│       │   ├── approvals.py
│       │   └── agents.py
│       │
│       ├── tasks/                    # Celery async tasks
│       │   ├── worker.py             # Celery app definition
│       │   ├── discovery_task.py
│       │   ├── scoring_task.py
│       │   ├── tailoring_task.py
│       │   └── apply_task.py
│       │
│       ├── db/
│       │   ├── session.py            # Async SQLAlchemy session
│       │   └── migrations/           # Alembic migrations
│       │       └── versions/
│       │
│       └── tests/
│           ├── test_autopilot.py
│           ├── test_idempotency.py
│           ├── test_integrity.py
│           └── conftest.py
│
├── packages/
│   └── shared/                       # Shared TypeScript types (monorepo)
│       └── types/
│           └── index.ts
│
├── infra/
│   ├── docker-compose.yml            # Local: API + worker + Postgres + Redis
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   └── nginx.conf
│
├── .cursor/
│   └── rules/                        # Cursor AI rules
│       ├── api.mdc
│       ├── agents.mdc
│       └── frontend.mdc
│
├── .env.example
├── turbo.json                        # Turborepo config
├── package.json                      # Root workspace
└── README.md
```

---

## 3. Database Schema

### Core tables

```sql
-- users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  plan        TEXT DEFAULT 'free',       -- free | pro
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- resumes
CREATE TABLE resumes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,         -- Supabase Storage key
  parsed_profile  JSONB,                 -- structured skills, experience, etc.
  preferences     JSONB,                 -- role, location, salary, seniority
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- jobs
CREATE TABLE jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT,                    -- ashby | greenhouse | lever | linkedin
  external_id   TEXT,
  title         TEXT NOT NULL,
  company       TEXT NOT NULL,
  location      TEXT,
  salary_range  TEXT,
  description   TEXT,
  url           TEXT,
  posted_at     TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, external_id)
);

-- job_scores (per user)
CREATE TABLE job_scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES jobs(id) ON DELETE CASCADE,
  fit_score     NUMERIC(3,1),            -- 1.0 to 5.0
  fit_reasons   TEXT[],
  risk_flags    TEXT[],
  dimension_scores JSONB,               -- {tech, culture, seniority, comp, location}
  scored_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- applications
CREATE TABLE applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id),
  status          TEXT DEFAULT 'saved',  -- saved|pending|applied|interview|offer|rejected
  channel         TEXT,                  -- email | linkedin | company_site
  applied_at      TIMESTAMPTZ,
  last_updated    TIMESTAMPTZ DEFAULT now(),
  idempotency_key TEXT UNIQUE,
  notes           TEXT,
  is_stale        BOOLEAN DEFAULT false,
  dedup_group     UUID                   -- groups duplicates together
);

-- approvals
CREATE TABLE approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  application_id  UUID REFERENCES applications(id),
  type            TEXT,                  -- cover_letter | linkedin_note | follow_up
  channel         TEXT,
  subject         TEXT,
  draft_body      TEXT,
  status          TEXT DEFAULT 'pending', -- pending | approved | rejected | edited
  approved_at     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- autopilot_runs
CREATE TABLE autopilot_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id),
  status             TEXT DEFAULT 'queued', -- queued|running|done|failed
  scope              TEXT DEFAULT 'all',    -- all|failed_only|gmail_failed_only
  idempotency_key    TEXT UNIQUE,
  request_fingerprint TEXT,
  item_results       JSONB,
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- prep_sessions
CREATE TABLE prep_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  application_id  UUID REFERENCES applications(id),
  questions       JSONB,
  star_stories    JSONB,
  company_brief   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 4. API Contract

### POST /v1/me/autopilot/run

Idempotency-aware Smart Prep batch execution.

```
Request headers:
  Idempotency-Key: <uuid>          required

Request body:
  {
    "scope": "all" | "failed_only" | "gmail_failed_only",
    "application_ids": ["uuid", ...] | null   // null = all pending
  }

Response 202 — queued (fresh run):
  {
    "run_id": "uuid",
    "status": "queued",
    "replayed": false
  }

Response 200 — replayed (same key + same fingerprint):
  {
    "run_id": "uuid",
    "status": "done",
    "replayed": true,
    "item_results": [...]
  }

Response 409 — conflict (same key, different payload):
  {
    "error": "idempotency_conflict",
    "detail": "Key already used with a different payload fingerprint",
    "prior_run_id": "uuid"
  }
```

### POST /v1/me/applications/integrity-check

```
Request body:
  { "mode": "dry_run" | "apply" }

Response:
  {
    "mode": "dry_run",
    "summary": { "duplicates": 2, "stale": 1, "status_fixes": 3 },
    "changes": [
      {
        "type": "deduplicate",
        "application_ids": ["uuid-a", "uuid-b"],
        "keep_id": "uuid-a",
        "reason": "Same job URL, different status — keeping most recent"
      },
      {
        "type": "mark_stale",
        "application_id": "uuid",
        "reason": "No update in 30 days, status still 'applied'"
      }
    ]
  }
```

### GET /v1/jobs?min_fit=4.0&location=remote&page=1

```
Response:
  {
    "jobs": [
      {
        "id": "uuid",
        "title": "Senior ML Engineer",
        "company": "Mistral AI",
        "fit_score": 4.8,
        "fit_reasons": ["RAG stack exact match", "Agentic pipeline experience"],
        "risk_flags": ["French authorization required"],
        "dimension_scores": { "tech": 4.9, "culture": 4.5, "seniority": 5.0, "comp": 4.6, "location": 4.8 },
        "channel_recommendation": "email",
        "salary_range": "€130k–€160k"
      }
    ],
    "total": 12,
    "page": 1
  }
```

### POST /v1/me/approvals/:id/approve

```
Request body:
  { "edited_body": "string | null" }    // null = approve as-is

Response 200:
  {
    "approval_id": "uuid",
    "status": "approved",
    "queued_send": true,
    "send_task_id": "uuid"
  }
```

### GET /v1/agents/status (SSE stream)

```
Content-Type: text/event-stream

data: {"agent":"discovery","status":"running","progress":0.3,"message":"Scanning Greenhouse..."}
data: {"agent":"scorer","status":"idle"}
data: {"agent":"tailor","status":"done","items_processed":4}
```

---

## 5. Agent Architecture

Each agent is a Python class implementing the `BaseAgent` protocol:

```python
# agents/base.py
from abc import ABC, abstractmethod
from typing import AsyncIterator

class BaseAgent(ABC):
    name: str
    description: str

    @abstractmethod
    async def run(self, context: dict) -> dict:
        """Synchronous task execution."""

    async def stream(self, context: dict) -> AsyncIterator[str]:
        """Optional: yield SSE tokens for live UI updates."""
        yield ""
```

**Agent responsibilities:**


| Agent               | Trigger                   | Output                                                |
| ------------------- | ------------------------- | ----------------------------------------------------- |
| `DiscoveryAgent`    | Cron (2× daily) or manual | Raw job listings from 45+ portals                     |
| `ScorerAgent`       | Post-discovery per user   | `job_scores` rows with fit data                       |
| `TailorAgent`       | When user queues apply    | Tailored resume variant (PDF/MD)                      |
| `WriterAgent`       | When user queues apply    | `approvals` draft rows                                |
| `ApplyAgent`        | Post-approval only        | Gmail draft or LinkedIn message sent                  |
| `PrepAgent`         | On-demand per application | Questions + STAR-R stories                            |
| `MonitorAgent`      | Cron (hourly)             | Dedup + stale flags in applications table             |
| `OrchestratorAgent` | All agent events          | Routes tasks, blocks overlaps, enforces approval gate |


**Orchestrator overlap prevention** (idempotency + lock):

```python
# agents/orchestrator.py
async def run_autopilot(user_id: str, key: str, payload: dict):
    lock_key = f"autopilot:lock:{user_id}"
    acquired = await redis.set(lock_key, key, nx=True, ex=300)  # 5-min lock
    if not acquired:
        raise HTTPException(409, "Overlapping run in progress")
    try:
        await _execute_batch(user_id, payload)
    finally:
        await redis.delete(lock_key)
```

---

## 6. Key Services

### Idempotency service

```python
# services/idempotency.py
import hashlib, json
from redis.asyncio import Redis

async def check_or_create(redis: Redis, key: str, payload: dict) -> dict:
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    stored = await redis.hgetall(f"idempotency:{key}")

    if stored:
        if stored["fingerprint"] != fingerprint:
            return {"conflict": True, "prior_run_id": stored["run_id"]}
        return {"replayed": True, "run_id": stored["run_id"]}

    run_id = str(uuid4())
    await redis.hset(f"idempotency:{key}", mapping={"fingerprint": fingerprint, "run_id": run_id})
    await redis.expire(f"idempotency:{key}", 86400)  # 24h TTL
    return {"replayed": False, "run_id": run_id}
```

### Resume parser

```python
# services/resume_parser.py
async def parse_resume(file_bytes: bytes, mime: str) -> dict:
    # Extract text (PDF via pdfplumber, DOCX via python-docx)
    text = extract_text(file_bytes, mime)

    # Claude extracts structured profile
    response = await claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system="Extract a structured JSON profile from this resume. Return ONLY valid JSON.",
        messages=[{"role": "user", "content": f"Resume:\n{text}"}]
    )
    return json.loads(response.content[0].text)
```

### Gmail service

```python
# services/gmail.py
async def create_draft(user_id: str, to: str, subject: str, body: str) -> str:
    creds = await get_oauth_token(user_id, provider="gmail")
    service = build("gmail", "v1", credentials=creds)
    message = MIMEText(body)
    message["to"] = to
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    draft = service.users().drafts().create(
        userId="me", body={"message": {"raw": raw}}
    ).execute()
    return draft["id"]
```

---

## 7. Environment Variables

```bash
# .env.example

# App
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# Database
DATABASE_URL=postgresql+asyncpg://daubo:daubo@localhost:5432/daubo
REDIS_URL=redis://localhost:6379

# Auth (NextAuth)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# OAuth integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
```

---

## 8. Cursor Roadmap

### Phase 0 — Foundation (Week 1–2)

**Goal:** Monorepo boots, auth works, resume uploads.

- **TASK-001** Init Turborepo monorepo with `apps/web` and `apps/api`
- **TASK-002** Scaffold Next.js 14 App Router with Tailwind + shadcn/ui
- **TASK-003** Scaffold FastAPI app with pydantic-settings, async SQLAlchemy, Alembic
- **TASK-004** `docker-compose.yml` with Postgres 16, Redis 7, API, Celery worker
- **TASK-005** Supabase auth integration (NextAuth + Supabase provider)
- **TASK-006** `POST /v1/me/resume` — upload PDF/DOCX to Supabase Storage
- **TASK-007** Resume parser service (pdfplumber + Claude structured extraction)
- **TASK-008** User preferences CRUD (`GET/PATCH /v1/me/preferences`)
- **TASK-009** Alembic migrations for users, resumes, jobs, applications tables
- **TASK-010** Frontend: Onboarding flow (resume upload + preferences form)

**Cursor rules to create:** `api.mdc` (FastAPI patterns), `agents.mdc` (agent base class)

---

### Phase 1 — Discovery & Scoring (Week 3–4)

**Goal:** Jobs appear with fit scores.

- **TASK-011** `DiscoveryAgent` — Playwright scraper for Greenhouse, Ashby, Lever
- **TASK-012** `jobs` table + dedup by `(source, external_id)`
- **TASK-013** `ScorerAgent` — 5-dimension Claude scoring per user resume
- **TASK-014** `GET /v1/jobs` with `min_fit`, `location`, `page` query params
- **TASK-015** Celery beat cron: discovery runs 2× daily per user
- **TASK-016** Frontend: Discover panel — JobCard, FitScoreBar, filters
- **TASK-017** Frontend: Zustand `jobStore` + `useJobs` hook with SWR
- **TASK-018** Frontend: Real-time score streaming via SSE (`useAgentStream` hook)
- **TASK-019** Redis caching for job scores (TTL 6h)
- **TASK-020** Unit tests: scorer output schema validation

---

### Phase 2 — Pipeline & Integrity (Week 5)

**Goal:** Applications tracked, integrity checks run.

- **TASK-021** `applications` table full CRUD (`GET/POST/PATCH /v1/me/applications`)
- **TASK-022** `MonitorAgent` — dedup rules, stale detection, status normalization
- **TASK-023** `POST /v1/me/applications/integrity-check` (dry-run + apply modes)
- **TASK-024** Frontend: Pipeline panel — PipelineTable, status badges, filter tabs
- **TASK-025** Frontend: IntegrityBanner — diff preview with row jump actions
- **TASK-026** Supabase Realtime subscription for application status updates
- **TASK-027** Integration test: integrity check dry-run vs apply mode parity

---

### Phase 3 — Smart Prep & Idempotency (Week 6–7)

**Goal:** Batch prep runs safely without overlap or duplicates.

- **TASK-028** `idempotency.py` service (Redis-backed, 24h TTL)
- **TASK-029** `autopilot_runs` table + migration
- **TASK-030** `POST /v1/me/autopilot/run` — idempotency contract (202/200/409)
- **TASK-031** Orchestrator overlap prevention (Redis distributed lock)
- **TASK-032** `TailorAgent` — Claude resume variant per JD (Markdown output)
- **TASK-033** `WriterAgent` — cover letter + LinkedIn note draft generation
- **TASK-034** Retry scopes: `failed_only`, `gmail_failed_only`
- **TASK-035** Item-level diagnostics: status category, retryability, latency
- **TASK-036** Frontend: Agents panel — AgentStatusCard, SSE live indicators
- **TASK-037** Integration test: overlap + idempotency interaction ordering

---

### Phase 4 — Approvals & Apply Handoff (Week 8–9)

**Goal:** Human-in-the-loop gate works end to end.

- **TASK-038** `approvals` table + migration
- **TASK-039** `GET /v1/me/approvals` — pending queue
- **TASK-040** `POST /v1/me/approvals/:id/approve` — approve (optionally with edit)
- **TASK-041** `POST /v1/me/approvals/:id/reject`
- **TASK-042** `ApplyAgent` — Gmail draft creation (post-approval, never auto-send)
- **TASK-043** `ApplyAgent` — LinkedIn note dispatch (post-approval)
- **TASK-044** Gmail OAuth connect flow + token refresh
- **TASK-045** LinkedIn OAuth connect flow
- **TASK-046** Gmail status/disconnect error handling with user-facing messages
- **TASK-047** Frontend: Approvals panel — ApprovalCard, DraftPreview, channel badges
- **TASK-048** Frontend: Apply handoff — channel-aware UI (Gmail draft block hidden for non-email)
- **TASK-049** Frontend: Gmail status refresh button in handoff flow

---

### Phase 5 — Interview Prep (Week 10)

**Goal:** STAR-R prep sessions generated per application.

- **TASK-050** `PrepAgent` — 5 tailored interview questions per JD + resume
- **TASK-051** `PrepAgent` — STAR-R story generation (Situation, Task, Action, Result, Reflection)
- **TASK-052** `PrepAgent` — company brief (recent news, tech stack, culture signals)
- **TASK-053** `prep_sessions` table + migration
- **TASK-054** `GET /v1/me/prep?application_id=` + `POST /v1/me/prep/generate`
- **TASK-055** Frontend: Prep panel — PrepCard, StarStoryPanel, streaming output

---

### Phase 6 — Orchestrator Chat & Observability (Week 11)

**Goal:** Users can query their pipeline in natural language.

- **TASK-056** `OrchestratorAgent` chat endpoint — `POST /v1/agents/chat` (SSE stream)
- **TASK-057** Orchestrator system prompt: full pipeline context injected per user
- **TASK-058** Run history observability: `replayed_at`, `fresh_run` flag in responses
- **TASK-059** `GET /v1/agents/status` SSE stream for live agent state
- **TASK-060** Frontend: OrchestratorChat component — streaming, suggested prompts
- **TASK-061** Frontend: Run history log in Agents panel

---

### Phase 7 — Hardening & Production (Week 12–13)

**Goal:** Production-ready, observable, secure.

- **TASK-062** Rate limiting per user (slowapi + Redis)
- **TASK-063** Row-level security (RLS) in Supabase for all user data
- **TASK-064** Structured logging (structlog) + Sentry error tracking
- **TASK-065** Prometheus metrics endpoint + Grafana dashboard
- **TASK-066** Auth verification in dev environment (unblock local QA)
- **TASK-067** Python version pinning in `pyproject.toml` (avoid runtime mismatch)
- **TASK-068** E2E tests: Playwright — full apply flow from resume upload to approval
- **TASK-069** API documentation: auto-generated OpenAPI + ReDoc at `/docs`
- **TASK-070** Security audit: OAuth token storage, SSRF prevention in portal scanner
- **TASK-071** CI/CD: GitHub Actions pipeline (lint → test → build → deploy)
- **TASK-072** Fly.io or Railway deployment config

---

## 9. Tech Stack Summary


| Layer        | Choice                                      | Reason                                |
| ------------ | ------------------------------------------- | ------------------------------------- |
| Frontend     | Next.js 14, TypeScript, Tailwind, shadcn/ui | App Router + RSC for streaming        |
| State        | Zustand + SWR                               | Lightweight, async-friendly           |
| Backend      | FastAPI (Python 3.12)                       | Async, typed, agent-compatible        |
| AI           | Anthropic claude-sonnet-4-20250514          | Best reasoning for scoring + drafting |
| Database     | PostgreSQL 16 via Supabase                  | RLS, Realtime, Storage bundled        |
| Cache/Queue  | Redis 7 + Celery                            | Idempotency, locks, task queue        |
| Auth         | NextAuth + Supabase                         | Gmail + LinkedIn OAuth                |
| File storage | Supabase Storage                            | Resume PDFs + generated variants      |
| Scraping     | Playwright (Python)                         | Headless portal scanning              |
| Infra        | Docker Compose (local) → Fly.io (prod)      | Reproducible, cheap                   |
| Monorepo     | Turborepo                                   | Shared types, parallel builds         |


---

## 10. Cursor Rules (`.cursor/rules/`)

### `api.mdc`

```
All FastAPI routes must be async.
All database access goes through the async SQLAlchemy session injected as a dependency.
Never access the DB directly in a router — use a service function.
All endpoints return typed Pydantic response models.
Idempotency-Key header must be validated before any mutating POST in autopilot and approvals routers.
```

### `agents.mdc`

```
All agents inherit from BaseAgent in agents/base.py.
Agents never directly call routers or touch HTTP — they receive and return plain dicts.
The orchestrator is the only agent that calls other agents.
The ApplyAgent must check approval status before any outbound action — raise if not approved.
Agent prompts live in agents/{name}_prompts.py, never inline.
```

### `frontend.mdc`

```
All API calls go through lib/api.ts — never fetch directly in components.
Streaming responses use the useAgentStream hook (SSE).
Zustand stores own server-derived state; SWR handles fetching and revalidation.
The ApprovalCard component must always show channel badge and draft preview before any action button.
Gmail UI elements are conditionally rendered — only show when channel === 'email' AND gmail is connected.
```

---

*End of Daubo Architecture & Roadmap Document*