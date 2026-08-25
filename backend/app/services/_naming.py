from app.services.errors import BusinessRuleError


def normalize_name(name: str, *, label: str) -> str:
    """Trim and validate a required name field.

    Only handles string normalization - domain-specific rules (uniqueness,
    reserved names) stay in each service. See Milestone 6 plan Decision 4:
    Storage Location and Preparation Preset naming rules may diverge later
    (e.g. Storage Location reserves "Unassigned"), so only this
    normalization step is shared, not the uniqueness check itself.
    """
    trimmed = name.strip()
    if not trimmed:
        raise BusinessRuleError(f"{label} name is required.")
    return trimmed
