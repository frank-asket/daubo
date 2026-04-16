from app.tasks.celery_app import celery_app


@celery_app.task(name="daubo.tasks.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="daubo.tasks.discovery_run_all_users")
def discovery_run_all_users() -> dict:
    """Cron entrypoint placeholder for 2x daily discovery scheduling."""
    return {"queued": 0, "status": "ok"}
