# ADR-0004 - Lifecycle States

# Status

Accepted

---

# Context

Freezeflow manages several long-lived entities that change over time.

Examples include:

* Production Batches
* Trays
* Packaging Operations
* Package Labels
* Packages
* Preparation Presets

Without clearly defined lifecycle states, different parts of the application may interpret the same entity differently.

For example:

* Can a completed Tray become Running again?
* Is a Package ever "undepleted"?
* When is a Production Batch considered complete?

This ADR defines the lifecycle of the primary domain entities.

---

# Decision

Every lifecycle in Freezeflow is designed to move **forward**.

State transitions represent real-world events that have occurred.

Historical events are never undone.

If incorrect information is recorded, it is corrected through the audit process rather than by reversing lifecycle states.

The lifecycle states defined in this ADR are the authoritative persisted state values used throughout the application.

---

# Production Batch Lifecycle

A Production Batch progresses through the following states:

```text
Draft
    |
    v
Running
    |
    v
Completed

or

Cancelled
```

Persisted status values:

- Draft
- Running
- Completed
- Cancelled

## Draft

The Production Batch has been created but has not started.

Users may:

* Add or edit Trays
* Edit Batch information
* Delete the Batch if no production has occurred

---

## Running

Freeze drying has begun.

When a Production Batch enters Running:

* `startedAt` is set if not already recorded.
* Every Draft Tray in the Batch transitions to Running.

Users may:

* Record Weight Checks
* Complete individual Trays
* Edit Batch notes

Running Batches may not return to Draft.

---

## Completed

A Production Batch becomes Completed only after every Tray has been completed and the user explicitly chooses Complete Batch.

When every Tray has been completed, the Batch is ready to complete.

The system may make this action obvious, but it must not complete the Batch without user confirmation.

Completed Batches:

* become historical records
* cannot return to Running
* remain available for reporting

Packaging may occur after completion.

---

## Cancelled

A Batch may be cancelled before completion if production cannot continue.

Examples:

* Power failure
* Equipment failure
* Product spoilage
* User cancellation

Cancelled Batches remain part of the historical record but may be excluded from reports when appropriate.

---

# Tray Lifecycle

Each Tray progresses independently.

```text
Draft
    |
    v
Running
    |
    v
Completed
    |
    v
Packaged

or

Cancelled
```

Persisted status values:

- Draft
- Running
- Completed
- Packaged
- Cancelled

## Draft

The Tray has been created but drying has not begun.

---

## Running

The Tray is actively drying.

Users may:

* Record Weight Checks
* Edit notes
* Correct production information according to audit rules

---

## Completed

The Tray has reached its final dry weight.

No additional Weight Checks may be recorded.

The Tray is now eligible for Packaging.

---

## Packaged

The Tray's completed product has been fully allocated through a completed
Packaging Operation.

Once Packaged, the Tray cannot return to Completed.

---

## Cancelled

The Tray was removed from production before completion.

Cancelled Trays remain part of the historical record.

---

# Package Lifecycle

Packages represent finished inventory.

```text
In Storage
    |
    +--> Given Away
    |
    +--> Depleted
```

Persisted status values:

- In Storage
- Given Away
- Depleted

## In Storage

The Package is available.

Users may:

* Move the Package
* Edit notes
* View history

---

## Depleted

The Package has been consumed, discarded, or is no longer available.

Depleted Packages:

* remain searchable
* remain part of historical reporting
* are hidden from the default Inventory view

Version 1 does not support reopening or partially consuming Packages.

---

## Given Away

The Package left the user's inventory as a gift or transfer.

Given Away Packages:

* remain searchable
* remain part of historical reporting
* are hidden from the default active Inventory view

Given Away is not the same as deleted, depleted, or Storage Location.

---

# Packaging Operation Lifecycle

```text
Open
  |
  v
Completed
```

Persisted status values:

- Open
- Completed

An Open operation is resumable and may contain Allocations, planned Package
rows, Labels, and recorded Packages. Completion requires explicit operator
action and zero Remaining Weight for every Allocation. Completed operations are
historical; later changes use Corrections.

---

# Package Label Lifecycle

```text
Draft --> Ready --> Needs Reprint --> Ready
```

Persisted status values:

- Draft
- Ready
- Needs Reprint

Printing is an append-only Print Event, not a state. Editing printable content
after a label has been printed makes it Needs Reprint. Printing a complete label
returns it to Ready while preserving every Print Event.

---

# Preparation Preset Lifecycle

Preparation Presets are optional reusable combinations of Preparation Metadata.

```text
Active
    |
    v
Archived
```

Persisted status values:

- Active
- Archived

## Active

The Preparation Preset may be selected during Production to preload editable metadata.

---

## Archived

Archived Preparation Presets:

* cannot be selected for new Production
* remain referenced by historical Trays that used them
* may be restored in the future

Historical Production is never affected by archiving.

---

# Lifecycle Principles

All entity lifecycles follow these principles:

* States move forward.
* Historical events are never erased.
* State transitions represent real-world events.
* Corrections do not reverse lifecycle history.

When an error occurs, the correction process records the correction rather than pretending the event never happened.

---

# Automatic vs User-Driven Transitions

Some transitions occur automatically.

Examples:

* Production Batch → Ready to complete when all Trays are completed.
* Tray → Packaged when its Packaging Operation is explicitly completed.

Other transitions require explicit user action.

Examples:

* Start Production
* Complete Tray
* Complete Batch
* Complete Packaging Operation
* Cancel Batch
* Mark Package Depleted
* Mark Package Given Away
* Archive Preparation Preset

Automatic transitions should occur only when there is no ambiguity.

User judgment should always be respected.

---

# Reporting

Reports should recognize lifecycle states.

Examples:

* Running Batches are excluded from completed production reports.
* Cancelled Batches may be excluded from averages.
* Depleted Packages remain part of historical inventory reports.
* Given Away Packages remain part of historical inventory reports.
* Archived Preparation Presets remain associated with historical Production.

---

# Future Considerations

Future versions may introduce additional states.

Examples:

Packages:

```text
In Storage
    |
    v
Opened
    |
    v
Depleted
```

Production:

```text
Running
    |
    v
Paused
    |
    v
Running
```

These future states must extend the lifecycle rather than reinterpret existing states.

---

# Consequences

## Benefits

* Consistent behavior throughout the application.
* Simpler business rules.
* Predictable reporting.
* Clear state transitions.
* Strong historical integrity.

---

## Tradeoffs

* Some mistakes require audit corrections rather than reversing state.
* Future features must extend existing lifecycles instead of replacing them.

These tradeoffs are acceptable because Freezeflow prioritizes historical accuracy and traceability over allowing arbitrary state changes.
