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
* Preparation Preset (optional)
* Ingredients
* Preparation Methods
* Notes

Preparation Metadata should be fast, structured where useful, and tolerant of
real-world shorthand.

Preparation Presets may provide reusable defaults, but the user may enter or
create one-off Product, Ingredient, and Preparation Method values inline.

Starting Weight is recorded when drying begins, not during Milestone 2 production setup.

During Milestone 2, users load Trays and organize the Production Batch without entering weight information.

Starting Weight belongs to Milestone 3, when the user begins tracking drying progress.

Each tray becomes independently trackable throughout the drying process.

If the user chooses a Preparation Preset, Freezeflow copies its values onto the Tray.

The resulting Preparation Metadata snapshot becomes part of the Tray's permanent
production history and is never rewritten by later preset or catalog changes.

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

Once the tray weight remains constant and the user decides the food is finished, the tray may be marked complete.

The system records:

* Finished Product Weight

Completed trays become available for packaging.

Completing a Tray is an explicit user decision.

The application may suggest that a Tray appears stable, but it must not automatically complete the Tray.

Some Trays may complete while other Trays remain Running.

Running Trays may continue into another Drying Run.

Packaging does not begin until every Tray in the Production Batch has completed and the Production Batch has been explicitly completed.

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

# Workflow 8 — Convert Completed Product into Labeled Inventory

Packaging is a flexible, resumable workspace. Freezeflow records the final
traceable result without requiring the operator to fill, weigh, label, print,
and store bags in one prescribed physical order.

## Start or Resume Packaging

The user selects a completed Production Batch and starts or resumes its Open
Packaging Operation. A Production Batch may have at most one Open Packaging
Operation. The operation remains Open until the user explicitly completes it.

## Allocate Completed Product

Within the operation, the user selects one or more eligible completed Trays for
a Packaging Allocation. Every Allocation references the exact Trays supplying
one or more Packages. Separate combinations, such as chicken and strawberries,
use separate Allocations within the same operation.

Trays must come from the operation's Production Batch. Completed product may
only be allocated once at a time. The UI derives and displays selected source
weight, allocated Package Finished Product Weight, and remaining weight.

## Plan or Record Packages

An Allocation may contain durable planned package rows before Packages are
recorded. Planned rows and draft label information survive navigation and closing
the application, but they are not inventory and do not receive Package identifiers.

The operator may plan first or record Packages as physical work proceeds. A
Package is created when the operator intentionally records it. Each Package records:

* system-generated Package Identifier
* Package Type
* Package Finished Product Weight
* Sealed Package Weight
* oxygen absorber
* Packaging Date
* Storage Location or Unassigned
* notes
* one editable Package Label

Package Finished Product Weight reduces the Allocation's remaining product.
Sealed Package Weight does not. Packaging cannot be completed while selected
product remains unallocated or is overallocated.

Package creation also records the initial `In Storage` Package Status History
and initial Storage Location History using the selected location or Unassigned.

## Prepare and Print Labels

Every Package owns one persistent Package Label with editable human-readable
presentation. Label state is `Draft`, `Ready`, or `Needs Reprint`. Editing a
previously printed label changes it to `Needs Reprint`.

Printing is selection-based and independent of package creation order. The user
may print one Package, one Allocation, one Packaging Operation, one Production
Batch, today's Ready labels, or a custom Package selection through the same print
engine. Each print records an append-only Print Event. Avery 5163 output lays out
up to ten labels per sheet.

## Complete Packaging

The user explicitly completes the Packaging Operation after all Allocations are
fully allocated and required Package information is present. Completion records
`completedAt` and locks ordinary workflow edits. Later corrections follow the
project correction and audit rules.

---

# Workflow 9 — Store Inventory

Each Package has a current Storage Location.

Examples include:

* Bin A
* Bin B
* Pantry
* Shelf 3
* Unassigned

If the user does not choose a Storage Location during Packaging, the Package uses the implicit Unassigned Storage Location.

Packages may later be moved to different locations while preserving location history.

Marking a Package Given Away is an Inventory workflow that records that the Package left active inventory as a gift or transfer while preserving history.

---

# Workflow 10 — Search Inventory

The user may search for inventory at any time.

Common searches include:

* Product name
* Package Label Display Name
* Product
* Ingredients
* Preparation Preset, when one was used
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

# Workflow 11 — Mark Inventory as Depleted or Given Away

When a Package has been consumed, the user marks it as Depleted.

When a Package leaves inventory as a gift or transfer, the user marks it as Given Away.

The user confirms the Effective Time of the event, which defaults to the current time, and may add optional Notes.

Every transition appends a Package Status History record with both the Effective Time and the system-assigned Recorded Time.

The Package remains in the system.

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

Milestone 3 records the underlying weights (Starting Weight and Finished Product Weight).

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

* Preparation Preset management
* QR code labels
* Barcode scanning
* Mobile weight entry
* Cloud synchronization
* Multi-user collaboration

These additions should extend the workflow rather than replace it.
