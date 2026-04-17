# Daubo Operations Runbook (Vercel + Railway)

This runbook covers production checks for Phase 7 hardening goals:
- metrics and dashboards
- alerting thresholds
- Sentry health checks
- environment contract validation before deploy

## 1) Environment Contract

Validate required environment variables before release:

- Vercel contract:
  - `npm run check:env:vercel`
- Railway contract:
  - `npm run check:env:railway`

Required sets are enforced by `scripts/check-required-env.mjs`.

## 2) Prometheus and Grafana (Local/Infra Validation)

From `infra`:

```bash
docker compose up -d
```

Endpoints:
- API metrics: `http://localhost:8000/metrics`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001` (`admin` / `admin`)

Provisioned assets:
- Datasource: `Prometheus`
- Dashboard provider: `Daubo Dashboards`
- Dashboard file: `infra/grafana-dashboard-daubo.json`

## 3) Production Alert Baselines

Use these initial thresholds and tune after 1-2 weeks:

- `5xx_error_ratio > 2%` for 5 minutes
- `http_p95_latency > 1500ms` for 10 minutes
- `autopilot_run_failed_total` spikes above baseline
- no successful discovery updates for 24 hours

## 4) Sentry Checks

Required backend env:
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE` (recommended: `0.1`)
- `SENTRY_PROFILES_SAMPLE_RATE` (recommended: `0.0` to `0.05`)

Release checklist:
- Trigger one synthetic backend exception in staging.
- Confirm event appears in Sentry with environment tags.
- Verify breadcrumbs include request path and user context.

## 5) Release Checklist (Vercel + Railway)

1. CI green (lint, tests, build, env contract checks).
2. Railway API deploy healthy (`/health` returns 200).
3. Vercel frontend build succeeds and BFF calls API.
4. `/metrics` reachable and scraped.
5. Grafana dashboard panels show live data.
6. Sentry receives events from current release.

## 6) Rollback

- Vercel: redeploy previous production deployment.
- Railway: rollback to previous successful deployment.
- Confirm:
  - `/health` OK
  - dashboard error ratio normalizes
  - no sustained 5xx or queue backlog growth
