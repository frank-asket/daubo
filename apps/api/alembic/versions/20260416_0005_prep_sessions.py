"""prep_sessions table for Phase 5 interview prep history

Revision ID: 20260416_0005
Revises: 20260416_0004
Create Date: 2026-04-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260416_0005"
down_revision = "20260416_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prep_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("clerk_user_id", sa.String(length=256), nullable=False),
        sa.Column("job_application_id", sa.UUID(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["job_application_id"],
            ["job_applications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prep_sessions_clerk_user_id", "prep_sessions", ["clerk_user_id"], unique=False)
    op.create_index(
        "ix_prep_sessions_job_application_id", "prep_sessions", ["job_application_id"], unique=False
    )
    op.create_index(
        "ix_prep_sessions_app_created",
        "prep_sessions",
        ["job_application_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_prep_sessions_app_created", table_name="prep_sessions")
    op.drop_index("ix_prep_sessions_job_application_id", table_name="prep_sessions")
    op.drop_index("ix_prep_sessions_clerk_user_id", table_name="prep_sessions")
    op.drop_table("prep_sessions")
