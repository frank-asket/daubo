"""Compact pipeline snapshot for orchestrator system prompts (Phase 6)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import JobApplication, JobApproval, UserResume


async def build_pipeline_context_block(session: AsyncSession, user_id: str) -> str:
    """Return a short, factual block for injection into the orchestrator system message."""
    resume_n = await session.scalar(
        select(func.count()).select_from(UserResume).where(UserResume.clerk_user_id == user_id)
    )
    has_resume = bool(resume_n and resume_n > 0)

    pending_approvals = await session.scalar(
        select(func.count())
        .select_from(JobApproval)
        .where(JobApproval.clerk_user_id == user_id, JobApproval.status == "pending")
    )
    pending_n = int(pending_approvals or 0)

    status_rows = await session.execute(
        select(JobApplication.status, func.count())
        .where(JobApplication.clerk_user_id == user_id)
        .group_by(JobApplication.status)
    )
    by_status: dict[str, int] = {row[0]: int(row[1]) for row in status_rows.all()}
    total_apps = sum(by_status.values())

    recent_res = await session.execute(
        select(JobApplication.title, JobApplication.company, JobApplication.status)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.desc())
        .limit(8)
    )
    recent_lines: list[str] = []
    for title, company, st in recent_res.all():
        recent_lines.append(f"  - {company}: {title} [{st}]")

    status_bits = ", ".join(f"{k}={v}" for k, v in sorted(by_status.items())) or "none"

    parts = [
        "### User pipeline snapshot (authoritative; do not invent rows not listed)",
        f"- Total applications tracked: {total_apps}",
        f"- Resume text on file: {'yes' if has_resume else 'no'}",
        f"- Pending approvals (human gate): {pending_n}",
        f"- Counts by status: {status_bits}",
    ]
    if recent_lines:
        parts.append("- Recent roles (most recently updated, up to 8):")
        parts.extend(recent_lines)
    else:
        parts.append("- No applications in pipeline yet.")
    parts.append(
        "Use this snapshot to prioritize advice. If the user asks for data you do not have here, "
        "say you only see this summary and suggest they open Pipeline or Approvals in the app."
    )
    return "\n".join(parts)
