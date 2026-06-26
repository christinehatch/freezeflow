"""empty milestone 0

Revision ID: 0001_empty_milestone_0
Revises:
Create Date: 2026-06-26 00:00:00.000000

"""

from collections.abc import Sequence

revision: str = "0001_empty_milestone_0"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
