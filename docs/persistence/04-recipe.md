# Recipe

## Purpose

A Recipe is an optional reusable preparation template.

Recipes exist to reduce repetitive data entry by allowing commonly used preparation information to be reused across multiple Production Batches.

Recipes are **not** historical production records.

Historical production information belongs to the Tray.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| name | Yes | Yes | User-friendly recipe name |
| productName | Yes | Yes | Product being prepared (ex. Chicken Breast) |
| preparation | Yes | Yes | Preparation instructions or description |
| notes | No | Yes | Optional recipe notes |
| archived | Yes | Yes | Indicates whether the Recipe may be used for new Trays |

---

# Relationships

A Recipe:

- may be referenced by many Trays

A Tray:

- may reference zero or one Recipe

Recipes do not own historical production data.

---

# Historical Behavior

When a Recipe is selected for a Tray:

- the Recipe's Product Name is copied to the Tray
- the Recipe's Preparation is copied to the Tray

After the Tray is created, it owns its own historical preparation information.

Editing a Recipe never changes existing Trays.

This behavior is defined in ADR-0001.

---

# Lifecycle

Recipes may be:

- Active
- Archived

Archived Recipes:

- cannot be selected for new Trays
- remain visible on historical Trays
- preserve historical references

Recipes should normally be archived rather than deleted.

---

# Business Rules

RP-001

Recipes are reusable templates.

They are not historical records.

---

RP-002

Using a Recipe copies its preparation information onto the Tray.

---

RP-003

Editing a Recipe affects future Trays only.

---

RP-004

A Tray may be created without selecting a Recipe.

---

RP-005

Recipes should be archived rather than deleted whenever they have been used by historical Trays.

---

# Notes

Recipes exist to improve efficiency.

Users should think of Recipes as shortcuts for creating Trays rather than as records of historical production.

Historical reporting should always use the preparation information stored on the Tray rather than the current Recipe definition.
