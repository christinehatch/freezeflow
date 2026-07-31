# Tray

## Purpose

A Tray represents one loaded tray record within a Production Batch.

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
| traySlotId | Yes | No* | Freeze Dryer Tray Slot used during the Batch |
| physicalTrayId | Yes | No* | Reusable Physical Tray used during the Batch |
| preparationPresetId | No | No | Optional Preparation Preset used |
| productName | Yes | Yes** | Historical product name |
| ingredients | No | Yes** | Immutable Ingredient snapshot |
| preparationMethods | No | Yes** | Immutable Preparation Method snapshot |
| notes | No | Yes | Optional production notes |
| status | Yes | System | Lifecycle state |
| startingWeightGrams | No | Yes*** | Recorded before drying |
| finalDryWeightGrams | No | System | Recorded when the Tray is completed |
| completedAt | No | System | Automatically set when the Tray is completed |

\* Tray Slot and Physical Tray selections may only be changed while the Batch is still in Draft.

\** Product information may only be edited before drying begins.

\*** Starting Weight may be corrected through the Audit History system.

---

# Relationships

A Tray:

- belongs to one Production Batch
- references one Tray Slot
- references one Physical Tray
- may reference one Preparation Preset
- has many Weight Checks
- belongs to zero or one Packaging Operation

A Tray never belongs to more than one Packaging Operation.

---

# Historical Behavior

The Tray owns its historical production information.

When a Preparation Preset is selected:

- its Product, Ingredients, Preparation Methods, and Notes are copied onto the Tray
- future Preparation Preset edits do not affect the Tray

Users may also enter one-off Ingredients and Preparation Methods without creating reusable records.

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

Every Tray records which Tray Slot and Physical Tray were used during the Production Batch.

---

TR-003

A Tray contains exactly one prepared product.

---

TR-004

A Tray preserves its own historical preparation information.

---

TR-005

A Tray may reference one optional Preparation Preset.

---

TR-006

A Tray records one Starting Weight.

---

TR-007

A Tray records one Final Dry Weight.

---

TR-008

A Tray may have many Weight Checks.

---

TR-009

Weight Checks are not permitted after the Tray is completed.

---

TR-010

A Tray may participate in only one Packaging Operation.

---

TR-011

Once a Tray has been included in a Packaging Operation, it is considered fully consumed by that operation.

The resulting product may be divided into one or more Packages.

---

TR-012

Completed Trays remain historical production records.

They are never deleted.

---

# Notes

The Tray is the central production entity within Freezeflow.

Production history, drying progress, Preparation Metadata snapshots, and packaging traceability all originate from the Tray.

Most historical reports are ultimately derived from Tray records.

Physical Tray identity and Tray Slot selection are part of the Tray's traceability record.

Tare weight, calibration notes, and preferred machine behavior are future Physical Tray enhancements.
