from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery("daubo-api", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.task_default_queue = "daubo"
celery_app.conf.imports = ("app.tasks.jobs",)
