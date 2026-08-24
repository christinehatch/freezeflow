# Preparation Preset

## Purpose

A Preparation Preset is an optional reusable combination of Preparation Metadata.

Preparation Presets reduce repetitive data entry while allowing Product, Ingredients, Preparation Methods, and Notes to be reused across multiple Production Batches.

Preparation Presets are **not** historical production records.

Historical production information belongs to the Tray.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| name | Yes | Yes | User-friendly preset name |
| productName | Yes | Yes | Default Product, such as Chicken Breast |
| ingredients | No | Yes | Default Ingredients |
| preparationMethods | No | Yes | Default Preparation Methods |
| notes | No | Yes | Default processing Notes |
| archived | Yes | Yes | Indicates whether the Preparation Preset may be used for new Trays |

---

# Relationships

A Preparation Preset:

- may be referenced by many Trays

A Tray:

- may reference zero or one Preparation Preset

Preparation Presets do not own historical production data.

---

# Historical Behavior

When a Preparation Preset is selected for a Tray:

- the preset's Product, Ingredients, Preparation Methods, and Notes are copied to the Tray

After the Tray is created, it owns its own historical preparation information.

Editing a Preparation Preset never changes existing Trays.

This behavior is defined in ADR-0013.

---

# Lifecycle

Preparation Presets may be:

- Active
- Archived

Archived Preparation Presets:

- cannot be selected for new Trays
- remain visible on historical Trays
- preserve historical references

Preparation Presets should normally be archived rather than deleted.

---

# Business Rules

See RC-001–RC-006 ("Preparation Metadata and Preset Rules") in `docs/04-business-rules.md` — the canonical business-rules doc is the single source of truth for these rules. This document does not maintain its own duplicate rule numbering.

---

# Notes

Preparation Presets exist to improve efficiency.

Users should think of Preparation Presets as optional shortcuts for creating Trays rather than as records of historical production.

Historical reporting should always use the Preparation Metadata stored on the Tray rather than the current Preparation Preset definition.

This document was renamed from `04-recipe.md` to `04-preparation-preset.md` as part of Milestone 6, completing the terminology migration described in ADR-0013.
