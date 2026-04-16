"""add user preferences table

Revision ID: 20260416_0002
Revises: 20260416_0001
Create Date: 2026-04-16
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260416_0002"
down_revision = "20260416_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_preferences",
        sa.Column("clerk_user_id", sa.String(length=256), nullable=False),
        sa.Column("target_role", sa.String(length=300), nullable=True),
        sa.Column("location_preference", sa.String(length=300), nullable=True),
        sa.Column("min_salary_usd", sa.Integer(), nullable=True),
        sa.Column("seniority", sa.String(length=64), nullable=True),
        sa.Column("skills_highlight", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("clerk_user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_preferences")
