from uuid import UUID

from sqlalchemy.orm import Session

from app.models import FreezeDryer
from app.repositories import freeze_dryer_repository
from app.schemas import FreezeDryerCreate, FreezeDryerUpdate
from app.services.errors import BusinessRuleError


def list_freeze_dryers(db: Session) -> list[FreezeDryer]:
    return freeze_dryer_repository.list(db)


def create_freeze_dryer(db: Session, data: FreezeDryerCreate) -> FreezeDryer:
    _ensure_name_available(db, data.name)
    freeze_dryer = freeze_dryer_repository.create(db, data)
    db.commit()
    db.refresh(freeze_dryer)
    return freeze_dryer


def update_freeze_dryer(
    db: Session,
    freeze_dryer_id: UUID,
    data: FreezeDryerUpdate,
) -> FreezeDryer:
    freeze_dryer = freeze_dryer_repository.get(db, freeze_dryer_id)
    if freeze_dryer is None:
        raise BusinessRuleError("Freeze Dryer was not found.", status_code=404)

    if data.name is not None and data.name != freeze_dryer.name:
        _ensure_name_available(db, data.name, current_id=freeze_dryer.id)

    updated = freeze_dryer_repository.update(db, freeze_dryer, data)
    db.commit()
    db.refresh(updated)
    return updated


def _ensure_name_available(
    db: Session,
    name: str,
    *,
    current_id: UUID | None = None,
) -> None:
    existing = freeze_dryer_repository.get_by_name(db, name)
    if existing is not None and existing.id != current_id:
        raise BusinessRuleError("A Freeze Dryer with this name already exists.")
