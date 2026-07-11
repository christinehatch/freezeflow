# Package Type

## Purpose

A Package Type represents a reusable packaging format used when creating finished Packages.

Package Types reduce repeated entry during Packaging and help the application suggest appropriate defaults such as oxygen absorber size and printable label template.

Examples:

- Pint Jar
- 1 qt Mylar
- 2 qt Mylar
- 2 gallon Mylar

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| name | Yes | Yes | Display name |
| defaultOxygenAbsorber | No | Yes | Suggested absorber for this package format |
| defaultLabelTemplate | No | Yes | Suggested human-readable label template |
| notes | No | Yes | Optional setup notes |
| archived | Yes | Yes | Archived Package Types are hidden from new Packaging |

---

# Relationships

A Package Type:

- may be used by many Packages

A Package:

- belongs to one Package Type

---

# Historical Behavior

Package Types are reusable setup records.

Changing a Package Type must not rewrite historical Packages.

Packages preserve the Package Type selected when they were created along with the Package-level oxygen absorber and sealed weight values recorded during Packaging.

---

# Lifecycle

Package Types may be archived when they are no longer used.

Archived Package Types:

- do not appear in normal Packaging selection lists
- remain visible through historical Packages that used them
- may be restored if needed

Package Types should normally be archived rather than deleted.

---

# Business Rules

PTYPE-001

A Package Type represents one reusable packaging format.

---

PTYPE-002

Every Package created in Version 1 should reference a Package Type.

---

PTYPE-003

Package Type defaults may prefill Package fields, but Package-level values remain editable during Packaging.

Milestone 4 defaults are limited to oxygen absorber and printable label template.

---

PTYPE-004

Editing a Package Type must not alter historical Package records.

---

PTYPE-005

Archived Package Types cannot be selected for new Packages unless restored.

---

# Notes

Package Types are not food inventory.

They describe the container format used to create inventory Packages.

Packaging supply stock counts, reorder reminders, and label automation are future enhancements.
