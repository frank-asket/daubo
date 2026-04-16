"""add job listings table

Revision ID: 20260416_0003
Revises: 20260416_0002
Create Date: 2026-04-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260416_0003"
down_revision = "20260416_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_listings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("clerk_user_id", sa.String(length=256), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=512), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("company", sa.String(length=500), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("url", sa.String(length=2000), nullable=True),
        sa.Column("fit_score", sa.Float(), nullable=True),
        sa.Column("fit_reasons", sa.JSON(), nullable=False),
        sa.Column("risk_flags", sa.JSON(), nullable=False),
        sa.Column("page_hint", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("discovered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "clerk_user_id",
            "source",
            "external_id",
            name="uq_job_listings_user_source_external",
        ),
    )
    op.create_index("ix_job_listings_clerk_user_id", "job_listings", ["clerk_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_job_listings_clerk_user_id", table_name="job_listings")
    op.drop_table("job_listings")
