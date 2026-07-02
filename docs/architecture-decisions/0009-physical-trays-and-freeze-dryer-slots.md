# ADR-0009 - Physical Trays and Freeze Dryer Slots

# Status

Accepted

---

# Context

Freezeflow previously used Tray to describe the production record inside a Production Batch.

User workflow has clarified that there are three related but distinct concepts:

* the Freeze Dryer has a fixed number of tray slots
* the user owns reusable physical trays
* a Production Batch records what happened on selected physical trays during one run

For example, a black Freeze Dryer may have four tray slots, while the user may own twelve reusable physical trays. During a Production Batch, the user chooses which physical trays are placed into the available slots.

Treating the Freeze Dryer as if it owns the physical trays would be inaccurate because physical trays can be reused, moved, cleaned, replaced, or shared independently of one machine.

---

# Decision

Freezeflow separates these concepts:

## Freeze Dryer

A Freeze Dryer is the physical machine.

It has a configured number of Tray Slots.

## Tray Slot

A Tray Slot is a position inside a Freeze Dryer.

Tray Slots belong to the Freeze Dryer configuration.

They define capacity and slot position, not reusable equipment identity.

## Physical Tray

A Physical Tray is a reusable piece of equipment owned by the user.

Physical Trays exist independently from any single Freeze Dryer or Production Batch.

## Tray

Tray continues to mean the historical production record inside a Production Batch.

When a Physical Tray is selected for a Tray Slot during Production Batch setup, Freezeflow creates or updates a Tray record for that batch. That Tray records the selected slot, selected Physical Tray, product, preparation, weights, notes, and status.

---

# Workflow Implications

Freeze Dryer setup should allow the user to configure:

* the Freeze Dryer
* its number of Tray Slots
* reusable Physical Trays available to the workflow

Production Batch setup should allow the user to:

* create a Draft Production Batch from an idle Freeze Dryer
* see the Freeze Dryer's available Tray Slots
* select which Physical Tray is used in each slot
* add product and preparation information for each selected tray

The user-facing workflow should be described as selecting trays used in a Production Batch, not as adding trays directly to a Freeze Dryer.

---

# Milestone Scope

Milestone 2 should document and support the basic setup model needed to create Draft Production Batches from a Freeze Dryer and select the trays used.

Starting Weight, Weight Checks, tray completion, and automatic tare-weight calculations remain deferred to later milestones unless separately documented.

---

# Alternatives Considered

## Treat Freeze Dryer Trays as Fixed Machine Children

Rejected.

This would incorrectly imply that a physical tray belongs permanently to one Freeze Dryer.

## Keep Physical Tray as Future-Only

Rejected.

The create-batch workflow requires the user to select which reusable trays are being used. Without documenting Physical Trays, the UI would confuse equipment setup with historical production records.

## Rename Production Tray Immediately

Rejected for now.

The term Tray is already used throughout the documentation and implementation for the historical production record. Documentation now clarifies the distinction between Physical Tray, Tray Slot, and Tray.

---

# Consequences

Implementation must preserve traceability from Packages back to:

* Production Batch
* Freeze Dryer
* Tray Slot used during the batch
* Physical Tray used during the batch
* product and preparation history
* Weight Checks

Physical Tray configuration should not overwrite historical Production Batch records.

If a Physical Tray is renamed, archived, or corrected later, completed Production Batches must still preserve what was selected at the time of production.
