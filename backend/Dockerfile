# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENVIRONMENT=production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY app ./app

# Installs deps from pyproject.toml — python-multipart is required so POST /v1/me/resume/upload can boot.
RUN pip install --upgrade pip && pip install --no-cache-dir .

# Local default; Railway overwrites PORT at runtime — must bind to $PORT there.
ENV PORT=8000
EXPOSE 8000

# Workers: tune per CPU; 2 is a safe default for small APIs
# Use shell so ${PORT} expands. Without this, healthchecks fail (proxy ≠ port 8000).
# Single worker avoids two parallel lifespan threads racing on init_db / create_all.
CMD ["/bin/sh", "-c", "exec gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8000} --workers 1 --access-logfile - --error-logfile - --capture-output"]
