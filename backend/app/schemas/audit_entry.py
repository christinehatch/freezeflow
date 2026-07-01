from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class AuditEntryCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    field_name: str
    previous_value: str
    current_value: str
    observed_at: datetime | None = None
    corrected_at: datetime
    reason: str | None = None


class AuditEntryUpdate(BaseModel):
    entity_type: str | None = None
    entity_id: UUID | None = None
    field_name: str | None = None
    previous_value: str | None = None
    current_value: str | None = None
    observed_at: datetime | None = None
    corrected_at: datetime | None = None
    reason: str | None = None


class AuditEntryRead(AuditEntryCreate, ReadSchema):
    id: UUID
