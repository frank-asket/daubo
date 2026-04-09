import asyncio
import logging
from collections.abc import AsyncGenerator

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import Base

logger = logging.getLogger("daubo")
settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=30,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Requests that use get_db wait until init finishes so ORM metadata exists before queries run.
db_init_complete = asyncio.Event()
db_init_ok = False


async def init_db() -> None:
    """Create extension + tables. Sets db_init_complete in finally so get_db never deadlocks."""
    global db_init_ok
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
        db_init_ok = True
    except Exception:
        logger.exception(
            "Database initialization failed — verify DATABASE_URL, network access to Postgres, "
            "and that the database allows the pgvector extension"
        )
        db_init_ok = False
    finally:
        db_init_complete.set()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    await db_init_complete.wait()
    if not db_init_ok:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable or not initialized. Check API logs for database errors.",
        )
    async with SessionLocal() as session:
        yield session
