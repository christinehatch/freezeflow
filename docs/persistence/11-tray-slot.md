# Tray Slot

## Purpose

A Tray Slot represents one position inside a Freeze Dryer.

Tray Slots define the capacity and physical positions available when creating a Production Batch.

A Tray Slot is not a reusable Physical Tray.

The number of active Tray Slots is the Freeze Dryer's Tray Slot count.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| freezeDryerId | Yes | No | Parent Freeze Dryer |
| slotNumber | Yes | Yes* | Position number inside the Freeze Dryer |
| label | No | Yes | Optional user-facing label |
| archived | Yes | Yes | Indicates whether the slot is available for future Production Batches |

\* Slot configuration may only be changed when doing so does not invalidate historical Production Batch records.

---

# Relationships

A Tray Slot:

- belongs to one Freeze Dryer
- may be referenced by many Trays over time

A Tray Slot never owns a Physical Tray.

---

# Historical Behavior

Historical Trays preserve the Tray Slot used during their Production Batch.

Changing a Tray Slot label affects future setup display, but historical Production Batches must still remain traceable to the slot selected at the time of production.

---

# Business Rules

TS-001

A Tray Slot belongs to exactly one Freeze Dryer.

---

TS-002

A Tray Slot represents a machine position, not reusable equipment.

---

TS-003

A Draft Production Batch may select a Physical Tray for a Tray Slot.

---

TS-004

A Tray Slot may be selected at most once in a single Production Batch.

---

TS-005

A Running or Completed Production Batch preserves the Tray Slot selection used when production started.
