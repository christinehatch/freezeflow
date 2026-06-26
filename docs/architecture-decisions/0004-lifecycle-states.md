# ADR-0004 - Lifecycle States

# Status

Accepted

---

# Context

Freezeflow manages several long-lived entities that change over time.

Examples include:

* Production Batches
* Trays
* Packages
* Recipes

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

## Draft

The Production Batch has been created but has not started.

Users may:

* Add or edit Trays
* Edit Batch information
* Delete the Batch if no production has occurred

---

## Running

Freeze drying has begun.

Users may:

* Record Weight Checks
* Complete individual Trays
* Edit Batch notes

Running Batches may not return to Draft.

---

## Completed

A Production Batch automatically becomes Completed when every Tray has been completed.

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

The Tray has been included in a Packaging Operation.

A Tray may belong to only one Packaging Operation.

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
    v
Depleted
```

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

# Recipe Lifecycle

Recipes are reusable templates.

```text
Active
    |
    v
Archived
```

## Active

The Recipe may be selected during Production.

---

## Archived

Archived Recipes:

* cannot be selected for new Production
* remain associated with historical Trays
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

* Production Batch -> Completed, when all Trays are completed
* Tray -> Packaged, when included in a Packaging Operation

Other transitions require explicit user action.

Examples:

* Start Production
* Complete Tray
* Cancel Batch
* Mark Package Depleted
* Archive Recipe

Automatic transitions should occur only when there is no ambiguity.

User judgment should always be respected.

---

# Reporting

Reports should recognize lifecycle states.

Examples:

* Running Batches are excluded from completed production reports.
* Cancelled Batches may be excluded from averages.
* Depleted Packages remain part of historical inventory reports.
* Archived Recipes remain associated with historical Production.

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
