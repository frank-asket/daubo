"""phase0 baseline

Revision ID: 20260416_0001
Revises:
Create Date: 2026-04-16
"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260416_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Baseline marker revision for migration cutover.
    pass


def downgrade() -> None:
    pass
