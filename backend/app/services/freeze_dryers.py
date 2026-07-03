from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import FreezeDryer, PhysicalTray, Tray, TraySlot
from app.repositories import freeze_dryer_repository, physical_tray_repository
from app.schemas import (
    FreezeDryerCreate,
    FreezeDryerUpdate,
    PhysicalTrayCreate,
    PhysicalTrayUpdate,
)
from app.services.errors import BusinessRuleError


def list_freeze_dryers(db: Session) -> list[FreezeDryer]:
    return list(
        db.scalars(
            select(FreezeDryer).options(selectinload(FreezeDryer.tray_slots))
        ).all()
    )


def create_freeze_dryer(db: Session, data: FreezeDryerCreate) -> FreezeDryer:
    _ensure_name_available(db, data.name)
    freeze_dryer = freeze_dryer_repository.create(
        db,
        {
            "name": data.name,
            "notes": data.notes,
            "archived": data.archived,
        },
    )
    _configure_tray_slots(db, freeze_dryer, data.tray_slot_count)
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

    update_values = data.model_dump(exclude_unset=True, exclude={"tray_slot_count"})
    updated = freeze_dryer_repository.update(db, freeze_dryer, update_values)
    if data.tray_slot_count is not None:
        _configure_tray_slots(db, updated, data.tray_slot_count)
    db.commit()
    db.refresh(updated)
    return updated


def list_tray_slots(db: Session, freeze_dryer_id: UUID) -> list[TraySlot]:
    freeze_dryer = freeze_dryer_repository.get(db, freeze_dryer_id)
    if freeze_dryer is None:
        raise BusinessRuleError("Freeze Dryer was not found.", status_code=404)
    return list(
        db.scalars(
            select(TraySlot)
            .where(TraySlot.freeze_dryer_id == freeze_dryer_id)
            .order_by(TraySlot.slot_number)
        ).all()
    )


def list_physical_trays(db: Session) -> list[PhysicalTray]:
    return physical_tray_repository.list(db)


def create_physical_tray(db: Session, data: PhysicalTrayCreate) -> PhysicalTray:
    _ensure_physical_tray_label_available(db, data.label)
    physical_tray = physical_tray_repository.create(db, data)
    db.commit()
    db.refresh(physical_tray)
    return physical_tray


def update_physical_tray(
    db: Session,
    physical_tray_id: UUID,
    data: PhysicalTrayUpdate,
) -> PhysicalTray:
    physical_tray = physical_tray_repository.get(db, physical_tray_id)
    if physical_tray is None:
        raise BusinessRuleError("Physical Tray was not found.", status_code=404)

    if data.label is not None and data.label != physical_tray.label:
        _ensure_physical_tray_label_available(
            db,
            data.label,
            current_id=physical_tray.id,
        )

    updated = physical_tray_repository.update(db, physical_tray, data)
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


def _ensure_physical_tray_label_available(
    db: Session,
    label: str,
    *,
    current_id: UUID | None = None,
) -> None:
    existing = physical_tray_repository.get_by_label(db, label)
    if existing is not None and existing.id != current_id:
        raise BusinessRuleError("A Physical Tray with this label already exists.")


def _configure_tray_slots(
    db: Session,
    freeze_dryer: FreezeDryer,
    tray_slot_count: int,
) -> None:
    slots = list(
        db.scalars(
            select(TraySlot)
            .where(TraySlot.freeze_dryer_id == freeze_dryer.id)
            .order_by(TraySlot.slot_number)
        ).all()
    )
    slot_by_number = {slot.slot_number: slot for slot in slots}

    highest_used_slot = db.scalar(
        select(TraySlot.slot_number)
        .join(Tray, Tray.tray_slot_id == TraySlot.id)
        .where(TraySlot.freeze_dryer_id == freeze_dryer.id)
        .order_by(TraySlot.slot_number.desc())
        .limit(1)
    )
    if highest_used_slot is not None and tray_slot_count < highest_used_slot:
        raise BusinessRuleError(
            "Tray Slot count cannot be reduced below historical Tray usage."
        )

    for slot_number in range(1, tray_slot_count + 1):
        slot = slot_by_number.get(slot_number)
        if slot is None:
            db.add(
                TraySlot(
                    freeze_dryer_id=freeze_dryer.id,
                    slot_number=slot_number,
                    label=f"Slot {slot_number}",
                )
            )
        else:
            slot.archived = False
            db.add(slot)

    for slot in slots:
        if slot.slot_number > tray_slot_count:
            slot.archived = True
            db.add(slot)

    db.flush()
