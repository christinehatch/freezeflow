# Tray

## Purpose

A Tray represents one physical tray loaded into a Freeze Dryer during a Production Batch.

The Tray is the primary production record in Freezeflow.

It records:

- what product was dried
- how it was prepared
- its drying progress
- its final dry weight
- its contribution to one Packaging Operation

Every Tray preserves its own production history.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| productionBatchId | Yes | No | Parent Production Batch |
| trayNumber | Yes | No* | Position within the Production Batch |
| recipeId | No | No | Optional Recipe template used |
| productName | Yes | Yes** | Historical product name |
| preparation | Yes | Yes** | Historical preparation snapshot |
| notes | No | Yes | Optional production notes |
| status | Yes | System | Lifecycle state |
| startingWeightGrams | No | Yes*** | Recorded before drying |
| finalDryWeightGrams | No | System | Recorded when the Tray is completed |
| completedAt | No | System | Automatically set when the Tray is completed |

\* Tray numbers may only be changed while the Batch is still in Draft.

\** Product information may only be edited before drying begins.

\*** Starting Weight may be corrected through the Audit History system.

---

# Relationships

A Tray:

- belongs to one Production Batch
- may reference one Recipe
- has many Weight Checks
- belongs to zero or one Packaging Operation

A Tray never belongs to more than one Packaging Operation.

---

# Historical Behavior

The Tray owns its historical production information.

When a Recipe is selected:

- the Recipe is copied onto the Tray
- future Recipe edits do not affect the Tray

The Tray remains the permanent historical record of how that product was produced.

---

# Lifecycle

Trays follow the lifecycle defined in ADR-0004.

Typical progression:

```text
Draft
    ↓
Running
    ↓
Completed
    ↓
Packaged

or

Cancelled
```

Once Packaged, a Tray cannot return to an earlier state.

---

# Weight Information

Each Tray records:

- one Starting Weight
- many Weight Checks
- one Final Dry Weight

Weight values are stored in grams.

Weight tracking behavior is defined separately in the Weight Check documentation.

---

# Completion

A Tray is completed when:

- Final Dry Weight has been recorded
- the user explicitly completes the Tray

Completing a Tray:

- records completedAt
- prevents additional Weight Checks
- allows the Tray to participate in Packaging

---

# Packaging

A completed Tray may participate in one Packaging Operation.

Once packaged:

- the Tray is considered consumed
- it cannot participate in another Packaging Operation

The resulting product may be divided into multiple Packages through that Packaging Operation.

---

# Business Rules

TR-001

Every Tray belongs to exactly one Production Batch.

---

TR-002

A Tray contains exactly one prepared product.

---

TR-003

A Tray preserves its own historical preparation information.

---

TR-004

A Tray may reference one optional Recipe.

---

TR-005

A Tray records one Starting Weight.

---

TR-006

A Tray records one Final Dry Weight.

---

TR-007

A Tray may have many Weight Checks.

---

TR-008

Weight Checks are not permitted after the Tray is completed.

---

TR-009

A Tray may participate in only one Packaging Operation.

---

TR-010

Once a Tray has been included in a Packaging Operation, it is considered fully consumed by that operation.

The resulting product may be divided into one or more Packages.

---

TR-011

Completed Trays remain historical production records.

They are never deleted.

---

# Notes

The Tray is the central production entity within Freezlow.

Production history, drying progress, recipe snapshots, and packaging traceability all originate from the Tray.

Most historical reports are ultimately derived from Tray records.

