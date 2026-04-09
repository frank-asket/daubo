"""Concatenate uploaded profile documents (certs, degrees) for LLM context."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserProfileDocument

_MAX_PER_DOC = 6_000
_MAX_TOTAL = 10_000


def _kind_label(kind: str) -> str:
    k = (kind or "").strip().lower()
    if k == "certification":
        return "Certification"
    if k == "degree":
        return "Degree / diploma"
    return "Other document"


async def profile_documents_prompt_block(
    session: AsyncSession,
    clerk_user_id: str,
    *,
    max_total: int = _MAX_TOTAL,
) -> str:
    result = await session.execute(
        select(UserProfileDocument)
        .where(UserProfileDocument.clerk_user_id == clerk_user_id)
        .order_by(UserProfileDocument.updated_at.desc())
    )
    rows = list(result.scalars().all())
    if not rows:
        return ""

    parts: list[str] = []
    budget = max_total
    for row in rows:
        title = (row.label or row.file_name or "Document").strip() or "Document"
        header = f"[{_kind_label(row.doc_kind)}: {title}]"
        body = (row.content_text or "").strip()
        if not body:
            continue
        chunk = body[:_MAX_PER_DOC]
        block = f"{header}\n{chunk}"
        if len(block) > budget:
            block = block[:budget].rstrip() + "…"
            parts.append(block)
            break
        parts.append(block)
        budget -= len(block) + 2
        if budget <= 0:
            break

    if not parts:
        return ""
    return "\n\n".join(parts)
