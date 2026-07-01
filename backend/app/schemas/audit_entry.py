from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.base import ReadSchema


class AuditEntryCreate(BaseModel):
    entity_type: str
    entity_id: UUID
    field_changed: str
    previous_value: str | None = None
    new_value: str | None = None
    reason: str | None = None
    observation_time: datetime | None = None
    correction_time: datetime


class AuditEntryUpdate(BaseModel):
    entity_type: str | None = None
    entity_id: UUID | None = None
    field_changed: str | None = None
    previous_value: str | None = None
    new_value: str | None = None
    reason: str | None = None
    observation_time: datetime | None = None
    correction_time: datetime | None = None


class AuditEntryRead(AuditEntryCreate, ReadSchema):
    id: UUID
