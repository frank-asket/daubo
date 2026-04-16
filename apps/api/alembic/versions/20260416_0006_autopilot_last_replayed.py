"""autopilot_runs.last_replayed_at for idempotent replay observability

Revision ID: 20260416_0006
Revises: 20260416_0005
Create Date: 2026-04-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260416_0006"
down_revision = "20260416_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "autopilot_runs",
        sa.Column("last_replayed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("autopilot_runs", "last_replayed_at")
