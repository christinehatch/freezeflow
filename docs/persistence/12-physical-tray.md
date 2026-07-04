# Physical Tray

## Purpose

A Physical Tray represents one reusable removable tray owned by the user.

Physical Trays exist independently from Freeze Dryers and Production Batches.

For example, a user may own twelve Physical Trays while a Freeze Dryer has four Tray Slots.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| label | Yes | Yes | User-facing tray identifier |
| tareWeightGrams | No | Yes | Optional reusable tray tare weight, stored in grams |
| notes | No | Yes | Optional equipment notes |
| archived | Yes | Yes | Indicates whether the Physical Tray is available for future Production Batches |

Future fields may include calibration notes, material, or behavior notes.

---

# Relationships

A Physical Tray:

- may be referenced by many Trays over time
- does not belong permanently to one Freeze Dryer
- may be selected for one Tray Slot during Draft Production Batch setup
- may store an optional tare weight for reusable tray setup

---

# Historical Behavior

Historical Trays preserve which Physical Tray was used during a Production Batch.

Changing or archiving a Physical Tray must not alter historical Production Batch records.

Changing a Physical Tray tare weight does not rewrite historical Tray weights or Weight Checks.

---

# Business Rules

PT-001

A Physical Tray is reusable equipment.

---

PT-002

A Physical Tray does not belong permanently to a Freeze Dryer.

---

PT-003

A Physical Tray may be selected for a Tray Slot during Draft Production Batch setup.

---

PT-004

A Physical Tray selected for a Running, Completed, Packaged, or Cancelled Tray remains part of that historical production record.
