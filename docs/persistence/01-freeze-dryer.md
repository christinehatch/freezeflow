# Freeze Dryer

## Purpose

A Freeze Dryer represents one physical freeze dryer.

It is used to organize Production Batches and preserve the historical record of where a Batch was processed.

Freeze Dryers are long-lived setup records that change infrequently.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| name | Yes | Yes | User-friendly name (ex. "Large Harvest Right") |
| notes | No | Yes | Optional notes about the machine |
| archived | Yes | Yes | Indicates whether the Freeze Dryer is available for new Production Batches |

---

# Relationships

A Freeze Dryer:

- has many Production Batches
- has many Tray Slots

A Production Batch:

- belongs to exactly one Freeze Dryer

A Tray Slot:

- belongs to exactly one Freeze Dryer
- may be selected by many historical Trays over time

---

# Historical Behavior

Historical Production Batches always retain their original Freeze Dryer.

Changing a Freeze Dryer never changes historical Production Batches.

Renaming a Freeze Dryer updates the displayed name everywhere, including historical records.

The Freeze Dryer itself is considered the same physical machine.

---

# Lifecycle

A Freeze Dryer may be:

- Active
- Archived

Archived Freeze Dryers:

- cannot be selected for new Production Batches
- remain visible in historical records
- are never automatically removed

---

# Business Rules

FD-001

Every Production Batch must belong to exactly one Freeze Dryer.

---

FD-002

A Freeze Dryer may have any number of Production Batches.

---

FD-003

Freeze Dryers cannot be deleted if historical Production Batches reference them.

---

FD-004

Freeze Dryers should normally be archived rather than deleted.

---

FD-005

Changing a Freeze Dryer does not modify historical Production Batch records.

---

FD-006

A Freeze Dryer may have at most one Running Production Batch at a time.

---

FD-007

A Freeze Dryer has a configured number of Tray Slots.

---

FD-008

Tray Slots represent positions inside the Freeze Dryer, not reusable Physical Trays.

---

# Notes

The Freeze Dryer represents the physical machine.

It may include basic hardware setup such as Tray Slots.

It does not own reusable Physical Trays.

Maintenance history, runtime statistics, firmware version, and detailed hardware diagnostics are future enhancements.

Those features may be added in future versions if needed.
