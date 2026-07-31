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

RP-001

Preparation Presets are reusable data-entry conveniences.

They are not historical records.

---

RP-002

Using a Preparation Preset copies its Preparation Metadata onto the Tray.

---

RP-003

Editing a Preparation Preset affects future Trays only.

---

RP-004

A Tray may be created without selecting a Preparation Preset.

---

RP-005

Preparation Presets should be archived rather than deleted whenever they have been used by historical Trays.

---

# Notes

Preparation Presets exist to improve efficiency.

Users should think of Preparation Presets as optional shortcuts for creating Trays rather than as records of historical production.

Historical reporting should always use the Preparation Metadata stored on the Tray rather than the current Preparation Preset definition.

The filename is retained temporarily to preserve documentation links during the migration from the Recipe-first model. ADR-0013 is authoritative.
