# `apps/api`

Phase-0 migration entrypoint for Daubo backend.

Current behavior:

- `app.main` reuses the existing backend implementation from `backend/app/main.py`.
- Alembic metadata points at `backend/app/models.py`.
- Celery is wired with a bootstrap task module in `app/tasks/jobs.py`.

This keeps production behavior aligned while enabling progressive migration into `apps/api`.
