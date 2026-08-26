from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import DryingRunStatus
from app.schemas.base import ReadSchema


class DryingRunStart(BaseModel):
    started_at: datetime | None = None
    notes: str | None = None


class DryingRunComplete(BaseModel):
    ended_at: datetime | None = None
    notes: str | None = None


class DryingRunVoid(BaseModel):
    notes: str


class DryingRunTimestampCorrection(BaseModel):
    started_at: datetime | None = None
    ended_at: datetime | None = None
    reason: str | None = None


class DryingRunCreate(BaseModel):
    production_batch_id: UUID
    status: DryingRunStatus = DryingRunStatus.ACTIVE
    started_at: datetime
    ended_at: datetime | None = None
    notes: str | None = None


class DryingRunUpdate(BaseModel):
    status: DryingRunStatus | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    notes: str | None = None


class DryingRunRead(DryingRunCreate, ReadSchema):
    id: UUID
    created_at: datetime
    updated_at: datetime
