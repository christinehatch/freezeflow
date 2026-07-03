# Production Batch

## Purpose

A Production Batch represents one freeze-drying session.

It groups together all Trays loaded into a single Freeze Dryer during one production run.

A Production Batch organizes the production process but does not directly represent inventory.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| freezeDryerId | Yes | No* | The Freeze Dryer used for this Batch |
| batchNumber | Yes | No | Human-readable identifier |
| status | Yes | System | Lifecycle state |
| startedAt | No | System | Set when the Batch transitions to Running |
| completedAt | No | System | Set when the user completes the Batch |
| notes | No | Yes | Optional production notes |

\* A Freeze Dryer may only be changed while the Batch is still in Draft.

---

# Relationships

A Production Batch:

- belongs to one Freeze Dryer
- contains one or more Trays
- has one or more Drying Runs after Production starts

A Production Batch does not directly contain:

- Weight Checks
- Packages
- Inventory

Those records are associated through the Trays.

---

# Lifecycle

Production Batches follow the lifecycle defined in ADR-0004.

Typical progression:

```text
Draft
    ↓
Running
    ↓
Completed

or

Cancelled
```

Cancelled batches remain part of the historical record.

Completed batches cannot return to an earlier lifecycle state.

When a Production Batch transitions from Draft to Running:

- `startedAt` is set to the transition time
- every Draft Tray in the Batch transitions to Running
- the first Drying Run is created automatically

---

# Completion

A Production Batch is considered complete only when every Tray within the Batch has been completed.

The system is responsible for determining when this condition has been met and showing that the Batch is ready to complete.

Users must explicitly choose Complete Batch.

---

# Historical Behavior

Production Batches are historical production records.

After completion:

- the Freeze Dryer cannot change
- Trays cannot be added
- Trays cannot be removed

Corrections follow the Audit History model defined in ADR-0005.

---

# Business Rules

PB-001

Every Production Batch belongs to exactly one Freeze Dryer.

---

PB-002

A Draft Production Batch may temporarily contain zero Trays while it is being assembled.

A Production Batch must contain at least one Tray before it can transition to Running.

---

PB-003

A Production Batch cannot be completed until every Tray is completed.

Completion requires explicit user confirmation.

---

PB-004

Completed Production Batches are historical records.

They are never deleted.

---

PB-005

Trays may only belong to one Production Batch.

---

PB-006

Production Batches organize production only.

Inventory is tracked at the Package level.

---

# Notes

The Production Batch represents the production session.

Product-specific information belongs on the Tray.

This allows a single Production Batch to contain multiple products, recipes, and preparation methods while maintaining complete historical traceability.
