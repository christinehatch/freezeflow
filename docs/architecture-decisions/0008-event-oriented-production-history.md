# ADR-0008 - Production History is Event-Oriented

# Status

Accepted

---

# Context

Freezeflow models a real freeze-drying workflow, not only the current state of inventory.

User research shows that the working record is naturally chronological:

* food is prepared
* a Production Batch is started
* the machine runs
* the user observes tray weights
* the user may add time
* trays may be rotated
* trays complete
* completed tray contents are combined
* Packages are created
* Packages are stored, moved, depleted, or noted for special attention

The user's notebook is organized around what happened over time.

If Freezeflow stores only the latest state, it will lose the evidence needed to explain how the current state was reached.

---

# Decision

Freezeflow treats production history as event-oriented.

The application may store current state on primary entities for simple daily use, but important workflow events must be preserved as historical records whenever practical.

Examples of historical records include:

* Weight Checks
* Packaging Operations
* Storage Location History
* Audit Entries
* lifecycle timestamps such as `startedAt`, `completedAt`, and `packagedAt`
* notes attached to production observations and packaging decisions

Current state answers:

> What is true now?

Historical records answer:

> How did it get that way?

Both are required.

---

# Event Sourcing

Freezeflow is **not** adopting full event sourcing for Version 1.

Primary entities such as Production Batch, Tray, Package, Recipe, Freeze Dryer, and Storage Location continue to store canonical current state.

Historical event records supplement that state so the application can preserve traceability, explain changes, and support future reporting.

---

# Domain Implications

## Freeze Dryers

A Freeze Dryer is a long-lived physical machine.

Its identity, nickname, reliability, and performance history matter to users.

Version 1 tracks Freeze Dryers as first-class records and derives performance from Production Batches and Weight Checks.

Maintenance history and detailed machine diagnostics are future enhancements.

## Trays

The word Tray describes the production record for one selected Physical Tray in one Tray Slot within a Production Batch.

User research also revealed related setup concepts: reusable numbered Physical Trays and Freeze Dryer Tray Slots.

Freezeflow keeps Tray as the production record and uses Physical Tray and Tray Slot to preserve the equipment selected for that production event.

Future Physical Tray enhancements may store tare weight, calibration notes, preferred machine, and physical characteristics.

Until tare behavior is documented, Tray weight values follow ADR-0003 and represent food weight only.

## Drying Progress

Drying progress is not just one final value.

It is a sequence of observations and decisions over time.

Weight Checks are the primary Version 1 drying observations.

Future versions may add explicit Drying Run or Drying Session records if the application needs to distinguish machine-run intervals from weight observations.

## Packaging

Packaging is a transformation event.

Completed Trays are consumed by one Packaging Operation and produce one or more Packages.

The Packaging Operation preserves the moment where completed dry product becomes sealed inventory.

## Supplies

Packaging supplies such as Mylar bags, oxygen absorbers, and labels are real concepts in the user's workflow.

They are not part of the Version 1 inventory model.

Future supply tracking should be documented before implementation so it does not get confused with finished food inventory.

---

# Alternatives Considered

## Store Only Current State

Rejected.

Only storing current state would make it difficult to explain drying progress, corrections, reruns, storage movement, and packaging decisions.

It would also weaken the reporting value of the system.

## Full Event Sourcing

Rejected for Version 1.

Full event sourcing would add implementation complexity that is not required for the current single-user workflow.

The accepted approach preserves important events while keeping current state easy to query and display.

## Treat Notes as Disposable Metadata

Rejected.

Notes often contain observations, corrections, reasons, and warnings that explain production history.

They must remain part of the production record.

---

# Consequences

Freezeflow screens should show current state clearly while allowing users to inspect the events that created it.

Reports should be derived from historical records and canonical current values rather than from freeform assumptions.

Future features such as physical tray tare weights, machine maintenance history, rerun tracking, supply inventory, and intelligent product suggestions should extend the event-oriented model instead of replacing it.

Implementation should avoid flattening meaningful workflow events into one mutable field when the event itself matters for traceability.
