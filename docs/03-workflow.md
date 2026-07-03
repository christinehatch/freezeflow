# 03 - Workflow

# Purpose

This document describes the complete user workflow within Freezeflow.

Unlike the Domain Model, which defines the objects in the system, this document explains how a user interacts with those objects from beginning to end.

The workflow is written from the user's perspective and should guide user interface design, navigation, and feature development.

The goal is for Freezeflow to support the user's existing process rather than requiring the user to adapt to the software.

---

# Overview

Every freeze-dried product follows the same high-level lifecycle.

```text
Prepare Food
      ↓
Create Draft Production Batch
      ↓
Load Trays
      ↓
Enter Starting Weights
      ↓
Start Production
      ↓
Drying Run Active
      ↓
Current Run Complete
      ↓
Record Weight Checks
      ↓
Complete Trays or Start Another Drying Run
      ↓
Complete Batch
      ↓
(Optional) Combine Compatible Trays
      ↓
Package Product
      ↓
Assign Storage Location
      ↓
Manage Inventory
```

Each step builds upon the previous one while preserving the complete production history.

---

# Workflow 1 — Create a Production Batch

The user begins by creating a new production batch.

The batch represents one freeze-drying production session for one Freeze Dryer load.

The user records information such as:

* Freeze dryer
* Date
* Batch notes

Freezeflow should automatically suggest the next Batch Number.

The suggested Batch Number should be visible before creation and editable before the Draft Production Batch is saved.

Once the production batch has been created, trays can be loaded.

---

# Workflow 2 — Load Trays

The user selects which Physical Trays are used in the Freeze Dryer's Tray Slots.

Each selected Physical Tray becomes a Tray record within the Production Batch.

Each tray contains one prepared product.

The user records:

* Tray Slot
* Physical Tray
* Product
* Recipe (optional)
* Preparation details
* Notes

Starting Weight is recorded when drying begins, not during Milestone 2 production setup.

During Milestone 2, users load Trays and organize the Production Batch without entering weight information.

Starting Weight belongs to Milestone 3, when the user begins tracking drying progress.

Each tray becomes independently trackable throughout the drying process.

If the user chooses a Recipe, Freezeflow copies the Recipe information onto the Tray.

The copied preparation information becomes part of the Tray's permanent production history.

---

# Workflow 3 — Start Production

Once all required Trays have been added and Starting Weights have been recorded, the user starts the Production Batch.

Starting Production transitions the Production Batch from the Draft state to the Running state.

Before Production can begin:

* The Production Batch must contain at least one Tray.
* Every Tray must have a Starting Weight.
* The user may continue editing the Production Batch while it is in the Draft state.

Once Production has started:

* Additional production setup is no longer permitted.
* Every Draft Tray in the Batch transitions to Running.
* `startedAt` is recorded on the Production Batch.
* The first Drying Run is created automatically.
* The first Drying Run records `startedAt`.
* The Production Batch becomes an active production record.

The Freeze Dryer now has an active Running Production Batch until the Batch completes or is cancelled.

The user then waits for the current freeze dryer cycle to finish.

---

# Workflow 4 — Complete the Current Drying Run

When the freeze dryer cycle ends, the user marks the current run complete.

The user-facing action is:

```text
Current Run Complete
```

Current Run Complete means the freeze dryer cycle has ended and the user is ready to inspect or weigh Trays.

It does not mean:

* any Tray is complete
* the Production Batch is complete
* Weight Check entry has already been finished

When the user marks the Current Run Complete:

* `endedAt` is recorded on the active Drying Run.
* The Drying Run becomes historical production context.
* Weight Checks may now be recorded for Running Trays.

`DryingRun.endedAt` represents the actual time the freeze dryer cycle ended.

If the user records the run late, the user may correct `endedAt` through the correction workflow.

---

# Workflow 5 — Record Weight Checks

After a Drying Run has completed, the user weighs every Running Tray.

For each tray the user records:

* Current weight
* Observation time
* Optional notes

Every Running Tray must receive a Weight Check for the completed Drying Run before another Drying Run can begin.

Completed Trays are excluded from later Weight Check requirements.

The system preserves every recorded weight.

Historical measurements are never replaced.

Weight Checks continue across Drying Runs until the user decides each Tray is complete.

---

# Workflow 6 — Complete a Tray

Once the tray weight remains constant, the tray is considered complete.

The system records:

* Final dry weight
* Number of weight checks

Completed trays become available for packaging.

Completing a Tray is an explicit user decision.

The application may suggest that a Tray appears stable, but it must not automatically complete the Tray.

Some Trays may complete while other Trays remain Running.

Running Trays may continue into another Drying Run.

---

# Workflow 7 — Continue Drying or Complete the Batch

After Weight Checks have been recorded for the completed Drying Run, the user decides what happens next.

If one or more Trays remain Running, the user may start another Drying Run.

Starting another Drying Run:

* creates a new Drying Run for the same Production Batch
* records `startedAt`
* includes only Trays that are still Running

If every Tray has been marked Complete, the Production Batch becomes ready to complete.

The Production Batch does not complete automatically.

The user must explicitly choose:

```text
Complete Batch
```

Completing the Batch records `completedAt` and makes the Batch available for Packaging.

Total drying time is derived from the sum of non-voided Drying Run durations, not from Production Batch wall-clock duration.

---

# Workflow 8 — Package Finished Product

There are two common packaging paths.

## Package Individually

If the tray will remain separate, the user packages it immediately.

The package records:

* Package date
* Sealed weight
* Oxygen absorber
* Notes

The system automatically records a Packaging Operation for this packaging action.

The user does not manage the Packaging Operation directly.

---

## Combine Compatible Trays

If multiple completed trays contain the same product, the user may combine them before packaging.

Examples include:

* Multiple trays from the same production batch
* Trays from different production batches
* Trays from different freeze dryers

The user selects which completed trays will be packaged together.

Important:

A completed tray may only be packaged once.

Once assigned to a Packaging Operation, it is no longer available for future packaging actions.

The system automatically creates a Packaging Operation and permanently records which trays were packaged together.

The Packaging Operation appears as part of package history rather than as a separate user-managed page.

---

# Workflow 7 — Create Packages

The selected tray contents are divided into one or more storage bags.

For every package the user records:

* Sealed weight
* Oxygen absorber
* Package date
* Notes

Packages become the primary inventory units.

Each Package is connected to the Packaging Operation that produced it.

---

# Workflow 8 — Store Inventory

Each package is assigned to a storage location.

Examples include:

* Bin A
* Bin B
* Pantry
* Shelf 3

Packages may later be moved to different locations while preserving location history.

---

# Workflow 9 — Search Inventory

The user may search for inventory at any time.

Common searches include:

* Product name
* Recipe
* Storage location

Search results should immediately show:

* Package
* Weight
* Storage location
* Inventory status

The goal is to answer the question:

> "Where is my product?"

within seconds.

---

# Workflow 10 — Mark Inventory as Depleted

When a package has been consumed, the user marks it as depleted.

The package remains in the system.

Historical production information is never deleted.

This preserves accurate reporting while keeping current inventory up to date.

---

# Reporting Workflow

As production history grows, users may view reports that summarize historical data.

Examples include:

### Freeze Dryer Reports

* Average drying time
* Number of completed batches
* Average moisture loss

---

### Product Reports

* Average drying time
* Fresh-to-dry yield
* Production frequency

Fresh-to-dry yield is a key production insight.

It answers: "How much finished dry product do I actually get from this fresh input?"

Yield reporting belongs in Milestone 7 (Reporting).

Milestone 3 records the underlying weights (Starting Weight and Final Dry Weight).

Milestone 4 adds packaged output, which enables related packaging-efficiency comparisons in reports.

---

### Preparation Reports

* Compare preparation methods
* Compare seasoning variations
* Compare drying performance

---

### Inventory Reports

* Current inventory
* Recently packaged products
* Depleted inventory
* Inventory by storage location

---

# Workflow Principles

Every workflow within Freezeflow should follow these principles.

## Preserve History

Never overwrite historical production data.

---

## Minimize User Input

Reduce repetitive typing whenever possible.

---

## Complete One Task at a Time

The user should always understand the next step in the workflow.

---

## Preserve Traceability

Every package should remain traceable back through every stage of production.

---

## Preserve Freeform Notes

Production notes are first-class history.

Users should be able to record observations, shorthand, calculations, and imperfect records as quickly as they would in a paper notebook.

Freezeflow should preserve and search notes where appropriate rather than treating them as disposable metadata.

---

## Keep Inventory Separate from Production

Inventory is the result of production.

Production history should exist independently from inventory management.

---

# Future Workflow Expansion

The workflow is intentionally modular.

Future versions may add additional workflows without changing the existing production process.

Examples include:

* Recipe management
* Package Types
* QR code labels
* Barcode scanning
* Mobile weight entry
* Cloud synchronization
* Multi-user collaboration

These additions should extend the workflow rather than replace it.
