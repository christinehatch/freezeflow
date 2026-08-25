from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import PreparationPreset
from app.repositories import preparation_preset_repository
from app.schemas import PreparationPresetCreate, PreparationPresetUpdate
from app.services._naming import normalize_name
from app.services.errors import BusinessRuleError

SUGGESTION_COLUMN_BY_FIELD = {
    "ingredients": "ingredients",
    "preparation_methods": "preparation_methods",
}


def list_preparation_presets(
    db: Session, *, include_archived: bool = False
) -> list[PreparationPreset]:
    statement = select(PreparationPreset).order_by(PreparationPreset.name)
    if not include_archived:
        statement = statement.where(PreparationPreset.archived.is_(False))
    return list(db.scalars(statement).all())


def get_preparation_preset(
    db: Session, preparation_preset_id: UUID
) -> PreparationPreset:
    preset = db.get(PreparationPreset, preparation_preset_id)
    if preset is None:
        raise BusinessRuleError("Preparation Preset does not exist.")
    return preset


def create_preparation_preset(
    db: Session, data: PreparationPresetCreate
) -> PreparationPreset:
    name = normalize_name(data.name, label="Preparation Preset")
    _ensure_name_available(db, name)
    preset = preparation_preset_repository.create(
        db,
        {
            "name": name,
            "product_name": data.product_name.strip(),
            "ingredients": data.ingredients,
            "preparation_methods": data.preparation_methods,
            "notes": _clean_optional_text(data.notes),
            "archived": False,
        },
    )
    db.commit()
    return preset


def update_preparation_preset(
    db: Session, preparation_preset_id: UUID, data: PreparationPresetUpdate
) -> PreparationPreset:
    preset = get_preparation_preset(db, preparation_preset_id)
    values = data.model_dump(exclude_unset=True)
    values.pop("archived", None)
    if "name" in values:
        name = normalize_name(values["name"], label="Preparation Preset")
        _ensure_name_available(db, name, exclude_id=preset.id)
        values["name"] = name
    if "product_name" in values and values["product_name"] is not None:
        values["product_name"] = values["product_name"].strip()
    if "notes" in values:
        values["notes"] = _clean_optional_text(values["notes"])
    updated = preparation_preset_repository.update(db, preset, values)
    db.commit()
    return updated


def archive_preparation_preset(
    db: Session, preparation_preset_id: UUID
) -> PreparationPreset:
    preset = get_preparation_preset(db, preparation_preset_id)
    if preset.archived:
        raise BusinessRuleError("Preparation Preset is already archived.")
    updated = preparation_preset_repository.update(db, preset, {"archived": True})
    db.commit()
    return updated


def restore_preparation_preset(
    db: Session, preparation_preset_id: UUID
) -> PreparationPreset:
    preset = get_preparation_preset(db, preparation_preset_id)
    if not preset.archived:
        raise BusinessRuleError("Preparation Preset is not archived.")
    _ensure_name_available(db, preset.name, exclude_id=preset.id)
    updated = preparation_preset_repository.update(db, preset, {"archived": False})
    db.commit()
    return updated


def list_preparation_suggestions(db: Session, field: str) -> list[str]:
    column = SUGGESTION_COLUMN_BY_FIELD.get(field)
    if column is None:
        raise BusinessRuleError('field must be "ingredients" or "preparation_methods".')
    # column is looked up from the fixed SUGGESTION_COLUMN_BY_FIELD map above,
    # never taken from the field argument directly, so this is safe from
    # SQL injection despite the string formatting.
    statement = text(f"""
        SELECT DISTINCT value FROM (
            SELECT json_each.value AS value
            FROM preparation_presets, json_each(preparation_presets.{column})
            WHERE preparation_presets.{column} IS NOT NULL
            UNION
            SELECT json_each.value AS value
            FROM trays, json_each(trays.{column})
            WHERE trays.{column} IS NOT NULL
        )
        ORDER BY value
        """)
    return [row[0] for row in db.execute(statement).all()]


def _ensure_name_available(
    db: Session, name: str, *, exclude_id: UUID | None = None
) -> None:
    statement = select(PreparationPreset).where(
        func.lower(PreparationPreset.name) == name.lower()
    )
    if exclude_id is not None:
        statement = statement.where(PreparationPreset.id != exclude_id)
    existing = db.scalar(statement)
    if existing is not None:
        raise BusinessRuleError(f'A Preparation Preset named "{name}" already exists.')


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None
