from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PackageMove(BaseModel):
    storage_location_id: UUID
    moved_at: datetime | None = None
    notes: str | None = None


class PackageGiveAway(BaseModel):
    effective_at: datetime | None = None
    notes: str | None = None


class PackageDeplete(BaseModel):
    effective_at: datetime | None = None
    notes: str | None = None
