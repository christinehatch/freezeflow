from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.responses import success
from app.api.serializers import audit_entry_data
from app.database.session import get_db
from app.services.corrections import list_audit_entries

router = APIRouter(tags=["audit-entries"])
DBSession = Annotated[Session, Depends(get_db)]


@router.get("/audit-entries")
def list_audit_entries_endpoint(
    db: DBSession,
    entity_type: Annotated[str, Query()],
    entity_id: Annotated[UUID, Query()],
) -> dict[str, object]:
    entries = list_audit_entries(db, entity_type, entity_id)
    return success([audit_entry_data(entry) for entry in entries])
