"""add job_approvals table for Phase 4 approval queue

Revision ID: 20260416_0004
Revises: 20260416_0003
Create Date: 2026-04-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260416_0004"
down_revision = "20260416_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_approvals",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("clerk_user_id", sa.String(length=256), nullable=False),
        sa.Column("job_application_id", sa.UUID(), nullable=False),
        sa.Column("approval_type", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("draft_body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["job_application_id"],
            ["job_applications.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_approvals_clerk_user_id", "job_approvals", ["clerk_user_id"], unique=False)
    op.create_index(
        "ix_job_approvals_job_application_id", "job_approvals", ["job_application_id"], unique=False
    )
    op.create_index(
        "uq_job_approvals_application_pending",
        "job_approvals",
        ["job_application_id"],
        unique=True,
        postgresql_where=sa.text("status = 'pending'"),
    )


def downgrade() -> None:
    op.drop_index("uq_job_approvals_application_pending", table_name="job_approvals")
    op.drop_index("ix_job_approvals_job_application_id", table_name="job_approvals")
    op.drop_index("ix_job_approvals_clerk_user_id", table_name="job_approvals")
    op.drop_table("job_approvals")
