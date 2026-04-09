from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

_settings = get_settings()


class Base(DeclarativeBase):
    pass


class DocumentChunk(Base):
    """Arbitrary text chunk with a Jina embedding stored in pgvector."""

    __tablename__ = "document_chunks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(
        Vector(_settings.jina_embedding_dimension),
        nullable=False,
    )
