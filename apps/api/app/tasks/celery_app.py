from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery("daubo-api", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_default_queue = "daubo"
celery_app.conf.imports = ("app.tasks.jobs",)
celery_app.conf.beat_schedule = {
    "discovery-run-all-users-2x-daily": {
        "task": "daubo.tasks.discovery_run_all_users",
        "schedule": crontab(minute=0, hour="8,20"),
    }
}
