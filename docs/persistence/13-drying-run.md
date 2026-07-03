# Drying Run

## Purpose

A Drying Run represents one freeze dryer cycle or timer interval within a Running Production Batch.

Drying Runs preserve actual machine runtime history.

They provide the cycle context for Weight Checks and allow total drying time to be derived without relying on Production Batch wall-clock duration.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| productionBatchId | Yes | No | Parent Production Batch |
| status | Yes | System | Active, Complete, or Voided |
| startedAt | Yes | Yes* | Actual time the freeze dryer cycle started |
| endedAt | No | Yes* | Actual time the freeze dryer cycle ended |
| notes | No | Yes | Optional run notes |
| createdAt | Yes | No | Creation timestamp |
| updatedAt | Yes | No | Last update timestamp |

\* Corrections follow the Audit History model defined in ADR-0005.

---

# Relationships

A Drying Run:

- belongs to exactly one Production Batch
- may have many Weight Checks

A Production Batch:

- has one or more Drying Runs after it starts

A Weight Check:

- belongs to exactly one Drying Run

---

# Lifecycle

Drying Runs use the following persisted status values:

- Active
- Complete
- Voided

## Active

The freeze dryer cycle is currently in progress.

Only one Active Drying Run may exist for a Production Batch at a time.

Weight Checks are not recorded while a Drying Run is Active.

## Complete

The freeze dryer cycle has ended.

Current Run Complete records `endedAt` and moves the Drying Run to Complete.

Weight Checks may be recorded for Running Trays after the Drying Run is Complete and before another Drying Run starts.

## Voided

The Drying Run was started by mistake or should not count as production runtime.

Voided Drying Runs remain historical records.

Voided Drying Runs are excluded from derived total drying time.

---

# Timestamp Semantics

`startedAt` represents the actual time the freeze dryer cycle started.

`endedAt` represents the actual time the freeze dryer cycle ended.

These values may differ from when the user entered them into Freezeflow.

Corrections to `startedAt` or `endedAt` create Audit Entries.

---

# Historical Behavior

Drying Runs are historical production context.

They should not be deleted during normal workflow.

If a run was started by mistake, it should be marked Voided with notes rather than removed.

---

# Business Rules

DR-001

Every Drying Run belongs to exactly one Production Batch.

---

DR-002

A Production Batch may have one or more Drying Runs.

Starting a Production Batch automatically creates the first Drying Run.

---

DR-003

Only one Active Drying Run may exist for a Production Batch at a time.

---

DR-004

A Drying Run records `startedAt`.

---

DR-005

Current Run Complete records `endedAt` and moves the Drying Run to Complete.

---

DR-006

Before another Drying Run can start, every Running Tray must have a Weight Check for the most recently completed non-voided Drying Run.

Completed Trays are excluded from this requirement.

---

DR-007

Voided Drying Runs remain historical records and are excluded from total drying time.

---

# Notes

Drying Runs are distinct from Weight Checks.

The Drying Run records the machine-cycle interval.

The Weight Check records the Tray observation after that interval.
