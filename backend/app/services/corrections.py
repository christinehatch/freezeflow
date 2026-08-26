from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEntry
from app.repositories import audit_entry_repository


def record_correction(
    db: Session,
    *,
    entity_type: str,
    entity_id: UUID,
    field_name: str,
    previous_value: str,
    current_value: str,
    observed_at: datetime | None,
    reason: str | None,
) -> AuditEntry:
    """Write one append-only Audit Entry (ADR-0005).

    This only records history. It does not mutate the corrected entity,
    validate the correction, or commit — the caller owns all three.
    """
    return audit_entry_repository.create(
        db,
        {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "field_name": field_name,
            "previous_value": previous_value,
            "current_value": current_value,
            "observed_at": observed_at,
            "corrected_at": datetime.now(UTC),
            "reason": reason,
        },
    )


def list_audit_entries(
    db: Session, entity_type: str, entity_id: UUID
) -> list[AuditEntry]:
    return list(
        db.scalars(
            select(AuditEntry)
            .where(
                AuditEntry.entity_type == entity_type,
                AuditEntry.entity_id == entity_id,
            )
            .order_by(AuditEntry.corrected_at, AuditEntry.id)
        ).all()
    )
