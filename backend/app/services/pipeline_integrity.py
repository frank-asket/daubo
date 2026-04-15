"""Pipeline integrity checks for saved job applications."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import JobApplication

logger = logging.getLogger("daubo")

CANONICAL_STATUSES = {
    "draft",
    "shortlisted",
    "package_ready",
    "ready_to_apply",
    "applied",
    "interview",
    "offer",
    "closed",
}

STATUS_ALIASES = {
    "ready": "ready_to_apply",
    "ready-to-apply": "ready_to_apply",
    "in_review": "applied",
    "in-process": "applied",
    "interviewing": "interview",
    "offered": "offer",
    "archived": "closed",
}

STATUS_RANK = {
    "draft": 0,
    "shortlisted": 1,
    "package_ready": 2,
    "ready_to_apply": 3,
    "applied": 4,
    "interview": 5,
    "offer": 6,
    "closed": 7,
}


def normalize_application_status(raw: str | None) -> str:
    status = (raw or "draft").strip().lower().replace(" ", "_")
    if status in STATUS_ALIASES:
        status = STATUS_ALIASES[status]
    if status not in CANONICAL_STATUSES:
        return "draft"
    return status


def duplicate_key_for_application(row: JobApplication) -> str:
    title = (row.title or "").strip().lower()
    company = (row.company or "").strip().lower()
    url = (row.job_url or "").strip().lower()
    if url:
        return f"{title}|{company}|{url}"
    location = (row.location or "").strip().lower()
    return f"{title}|{company}|{location}"


def choose_stronger_status(a: str, b: str) -> str:
    aa = normalize_application_status(a)
    bb = normalize_application_status(b)
    return aa if STATUS_RANK.get(aa, 0) >= STATUS_RANK.get(bb, 0) else bb


@dataclass
class IntegrityChange:
    application_id: str
    action: str
    reason: str
    before: str | None = None
    after: str | None = None
    duplicate_of_id: str | None = None


async def run_pipeline_integrity_pass(
    session: AsyncSession,
    user_id: str,
    *,
    dry_run: bool = True,
    stale_days: int = 21,
) -> dict[str, Any]:
    result = await session.execute(
        select(JobApplication)
        .where(JobApplication.clerk_user_id == user_id)
        .order_by(JobApplication.updated_at.desc())
    )
    rows = list(result.scalars().all())

    changes: list[IntegrityChange] = []
    duplicates_found = 0
    duplicates_removed = 0
    statuses_normalized = 0
    stale_flagged = 0

    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(days=max(1, stale_days))
    keep_by_key: dict[str, JobApplication] = {}
    rows_to_delete: list[JobApplication] = []

    for row in rows:
        previous_status = row.status
        normalized_status = normalize_application_status(row.status)
        if normalized_status != previous_status:
            statuses_normalized += 1
            changes.append(
                IntegrityChange(
                    application_id=str(row.id),
                    action="status_normalized",
                    reason="Mapped legacy or non-canonical status to canonical stage.",
                    before=previous_status,
                    after=normalized_status,
                )
            )
            if not dry_run:
                row.status = normalized_status

        updated_at = row.updated_at
        if updated_at is not None:
            ts = updated_at if updated_at.tzinfo else updated_at.replace(tzinfo=timezone.utc)
            if ts < stale_cutoff and normalize_application_status(row.status) not in {"offer", "closed"}:
                stale_flagged += 1
                changes.append(
                    IntegrityChange(
                        application_id=str(row.id),
                        action="stale_flagged",
                        reason=f"Not updated in more than {max(1, stale_days)} days.",
                    )
                )

        key = duplicate_key_for_application(row)
        keeper = keep_by_key.get(key)
        if keeper is None:
            keep_by_key[key] = row
            continue

        duplicates_found += 1
        keeper_previous_status = keeper.status
        merged_status = choose_stronger_status(keeper.status, row.status)
        if merged_status != keeper_previous_status and not dry_run:
            keeper.status = merged_status
        if merged_status != keeper_previous_status:
            changes.append(
                IntegrityChange(
                    application_id=str(keeper.id),
                    action="status_promoted",
                    reason="Duplicate carried a later-stage status.",
                    before=keeper_previous_status,
                    after=merged_status,
                    duplicate_of_id=str(row.id),
                )
            )
        # Fill missing keeper fields from duplicate.
        for field in (
            "location",
            "notes",
            "job_url",
            "apply_channel",
            "job_description",
            "package_draft",
            "interview_prep",
        ):
            keeper_val = getattr(keeper, field)
            row_val = getattr(row, field)
            keeper_empty = keeper_val is None or (isinstance(keeper_val, str) and not keeper_val.strip())
            row_has_value = row_val is not None and (not isinstance(row_val, str) or bool(row_val.strip()))
            if keeper_empty and row_has_value:
                if not dry_run:
                    setattr(keeper, field, row_val)

        changes.append(
            IntegrityChange(
                application_id=str(row.id),
                action="duplicate_removed",
                reason="Duplicate of another listing with same normalized identity.",
                duplicate_of_id=str(keeper.id),
            )
        )
        if not dry_run:
            rows_to_delete.append(row)
            duplicates_removed += 1

    if not dry_run:
        for row in rows_to_delete:
            await session.delete(row)
        await session.commit()

    logger.info(
        "pipeline integrity user=%s dry_run=%s scanned=%s dup_found=%s dup_removed=%s status_norm=%s stale=%s",
        user_id[:12],
        dry_run,
        len(rows),
        duplicates_found,
        duplicates_removed,
        statuses_normalized,
        stale_flagged,
    )

    return {
        "dry_run": dry_run,
        "stale_days": max(1, stale_days),
        "scanned": len(rows),
        "duplicates_found": duplicates_found,
        "duplicates_removed": duplicates_removed,
        "statuses_normalized": statuses_normalized,
        "stale_flagged": stale_flagged,
        "changes": [c.__dict__ for c in changes[:120]],
    }

