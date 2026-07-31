# 05 - Terminology

# Purpose

This document defines the official terminology used throughout Freezeflow.

These definitions establish a shared language for users, developers, documentation, APIs, and future contributors.

Whenever possible, terminology should reflect how users naturally describe their freeze-drying workflow rather than technical implementation details.

Every feature, screen, API, and database model should use these terms consistently.

---

# Production

## Production Batch

A Production Batch represents one complete freeze-drying production session for one Freeze Dryer load.

It begins when the user starts production and ends when the user explicitly completes the Batch after every Tray has completed drying.

A Production Batch is the primary production record.

Examples:

* Tuesday Chicken Batch
* Freeze Dryer #2 - April 18

---

## Freeze Dryer

A Freeze Dryer is a physical machine used to dry food.

Examples:

* Freeze Dryer #1
* Freeze Dryer #2

Each freeze dryer performs many Production Batches over time.

---

## Tray Slot

A Tray Slot is a position inside a Freeze Dryer.

Tray Slots define how many trays a Freeze Dryer can hold during one Production Batch.

Examples:

* Slot 1
* Slot 2
* Slot 3
* Slot 4

A Tray Slot is not the same thing as a reusable Physical Tray.

---

## Physical Tray

A Physical Tray is a reusable removable tray owned by the user.

Physical Trays exist independently from any single Freeze Dryer or Production Batch.

Examples:

* Physical Tray 1
* Physical Tray 7
* Stainless Tray A

A Physical Tray may be placed into a Tray Slot during Production Batch setup.

---

## Tray

A Tray represents one loaded tray record inside a Production Batch.

Each Tray contains one prepared product.

A Tray is tracked independently throughout the drying process.

Tray refers to the production record for that Batch, including Tray Slot, Physical Tray, product, preparation, weights, notes, and status.

A Tray may reference the Physical Tray and Tray Slot used during that Production Batch.

Examples:

* Tray 1
* Tray 2
* Tray 3
* Tray 4

---

## Drying Run

A Drying Run represents one freeze dryer cycle or timer interval within a Running Production Batch.

A Production Batch may contain multiple Drying Runs.

Starting a Production Batch automatically creates the first Drying Run.

Drying Runs record actual machine runtime through `startedAt` and `endedAt`.

Total drying time is derived from non-voided Drying Run durations.

---

## Current Run Complete

Current Run Complete is the user action that ends the active Drying Run.

It means the freeze dryer cycle has ended and the user is ready to inspect or weigh Trays.

Current Run Complete does not mean:

* any Tray is complete
* the Production Batch is complete
* Weight Check entry is finished

---

## Weight Check

A Weight Check is a recorded weight measurement taken during the drying process.

Multiple Weight Checks may exist for a single Tray.

Every Weight Check belongs to one Tray and one Drying Run.

Weight Checks preserve the drying history.

Weight Checks are recorded after Current Run Complete and before another Drying Run starts.

---

## Complete Tray

Complete Tray is the user action that marks one Tray as finished drying.

Completing a Tray records Finished Product Weight and prevents additional Weight Checks for that Tray.

Complete Tray is separate from Current Run Complete.

---

## Complete Batch

Complete Batch is the user action that marks a Production Batch as finished after every Tray in the Batch has been completed.

The system may show that a Batch is ready to complete, but the user must explicitly confirm completion.

---

# Product

## Product

A Product is the food being freeze dried.

Examples:

* Chicken
* Strawberries
* Apples
* Skittles

A Product describes *what* is being dried.

---

## Preparation Metadata

Preparation Metadata describes what was freeze dried and how it was prepared.

Examples:

* Taco Chicken
* Garlic Chicken
* Sliced Strawberries

Preparation Metadata may include:

* primary Product
* Ingredients and seasonings
* Preparation Methods
* processing Notes

It is production history, not a cooking Recipe.

## Preparation Preset

A Preparation Preset is an optional saved combination of Product, Ingredients,
Preparation Methods, and default Notes.

Preparation Presets reduce repeated entry but are never required.

When applied, preset values are copied into the Tray's Preparation Metadata snapshot.

Editing a Preparation Preset affects future use only.

## Ingredient

An Ingredient is a reusable suggestion for a food component or seasoning, such
as Salt, Pepper, Salsa, or Onion Powder. Users may enter a new Ingredient inline
without visiting a setup screen.

## Preparation Method

A Preparation Method is a reusable suggestion describing processing, such as
Cubed, Shredded, Raw, Pan Fried, Store Bought, or Home Canned. Users may enter a
new value inline.

---

## Tray Preparation

Tray Preparation is the historical preparation information stored on a Tray.

It records what was actually prepared for that specific Tray.

Tray Preparation is the Tray's immutable Preparation Metadata snapshot. It may
be copied from a Preparation Preset or entered directly by the user.

Tray Preparation should support freeform notebook-style entry.

Examples may include:

* product source
* cut or size
* seasoning
* cooking method
* store-bought or home-processed notes
* blanching, pre-freezing, or other preparation details

---

# Packaging

## Packaging

Packaging is the process of converting completed trays into sealed storage bags.

Packaging occurs only after drying has completed.

---

## Packaging Session

A Packaging Session is the user-facing experience provided by an Open Packaging
Operation. It may be paused and resumed while the operator allocates completed
product, records Packages, prepares labels, prints, and finishes Packaging.

---

## Packaging Worksheet

A Packaging Worksheet is the planning view used during a Packaging Session.

It summarizes the selected Production Batch, Packaging Allocations, source
Trays, Finished Product Weights, planned package rows, recorded Packages, Package
Labels, and remaining product.

## Planned Package Row

A Planned Package Row is durable planning information inside an Open Packaging
Operation. It may hold expected Package Type and draft label information before
the operator records a Package.

A Planned Package Row is not a Package, has no Package Identifier, and is not
inventory. It survives navigation and application restart.

---

## Packaging Operation

A Packaging Operation is the resumable aggregate root for converting completed
product from one Production Batch into labeled inventory.

It has an `Open` or `Completed` lifecycle and contains Packaging Allocations,
planned package rows, Packages, Package Labels, Print Events, notes, and progress.
Users start, resume, and complete the workspace without managing its internal
entities directly.

## Packaging Allocation

A Packaging Allocation is an identified child entity within one Packaging
Operation. It references the exact completed Tray or Trays supplying product for
one or more Packages.

An Allocation may exist before Packages are recorded. It has stable identity but
never exists independently of its Packaging Operation and is not an aggregate root.

---

## Package

A Package is one sealed storage bag.

A Package becomes the primary inventory unit.

Each Package contains product from one Packaging Allocation and therefore belongs
to one Packaging Operation.

Examples:

* 5.2 oz Taco Chicken
* 6.1 oz Strawberries

---

## Package Type

A Package Type is a reusable packaging format used when creating Packages.

Examples:

* Pint Jar
* 1 qt Mylar
* 2 gallon Mylar

Package Types may provide Packaging defaults such as oxygen absorber and printable label template.

---

## Package Identifier

A Package Identifier is the system-generated human-readable identifier for a Package.

It should be suitable for printed labels.

---

## Package Label

A Package Label is the persistent, editable human-readable presentation owned by
exactly one Package.

It includes a Display Name, optional Description, Ingredients Summary,
Preparation Summary, Rehydration Instructions, Serving Notes, and weight or
fresh-equivalent display content.

Package Identifier and Packaging Date are rendered from source records and are
not rewritten by Package Label edits.

Package Label state is `Draft`, `Ready`, or `Needs Reprint`. Users may edit and
reprint a Package Label after Package creation. Editing a printed label changes
its state to `Needs Reprint`. Before Milestone 8, edits replace the current label
content; Milestone 8 adds Audit history.

QR codes and barcodes are future enhancements.

## Print Event

A Print Event is an append-only record that a selected Package Label was printed
or reprinted at a recorded time using a label template. `Printed` and `Reprinted`
are events, not Package Label states.

---

## Package Weight

Package Weight refers to the weight of the completely sealed package, including:

* food
* Mylar bag
* oxygen absorber
* label (if applicable)

Package Weight is preserved for long-term verification of package integrity.

The preferred user-facing term is **Sealed Package Weight**. It is distinct
from Package Finished Product Weight.

## Package Finished Product Weight

The weight of freeze-dried food placed into one Package, excluding the Package
and other packaging material.

## Package Fresh Equivalent

The derived amount of source fresh food represented by one Package. It is
calculated proportionally from the source Trays and is not stored independently.

---

## Supplies

Supplies are materials used to create Packages.

Examples:

* Mylar bags
* oxygen absorbers
* labels

Supplies are distinct from food inventory.

Supply tracking is a future enhancement unless explicitly added through updated documentation.

---

# Inventory

## Inventory

Inventory consists of every Package currently tracked by the system.

Inventory is managed at the Package level.

---

## Storage Location

A Storage Location represents where a Package is physically stored.

Examples:

* Bin A
* Bin B
* Pantry
* Shelf 3

---

## Unassigned Storage Location

Unassigned is a system-provided Storage Location used when the user does not select a Storage Location during Packaging.

It allows Packaging to continue before the user has organized physical inventory.

---

## Inventory Status

Inventory Status describes the current state of a Package.

Examples include:

* In Storage
* Given Away
* Depleted

Inventory Status never removes historical production information.

Given Away means the Package left the user's inventory as a gift or transfer.

Given Away is not the same as deleted, depleted, or Storage Location.

---

## Package Status History

An append-only record of one Package Inventory Status lifecycle event.

Each record preserves the previous status, current status, Effective Time, Recorded Time, and optional Notes.

Creating a Package automatically creates its initial In Storage Package Status History record.

Package Status History is distinct from Audit History. Package Status History records lifecycle events; Audit History records corrections.

---

# Measurements

## Starting Weight

The weight of a Tray before freeze drying begins.

Sometimes referred to as:

* Fresh Weight
* Wet Weight

Within Freezeflow the official term is:

**Starting Weight**

---

## Final Dry Weight

The weight of a Tray after drying has completed.

This value is used to determine moisture loss and fresh-to-dry yield.

The preferred user-facing label is **Finished Product Weight** because the user is weighing finished food, not the reusable tray.

Within persistence and older documentation this may appear as Final Dry Weight.

---

## Yield

Fresh-to-dry yield compares Starting Weight to Finished Product Weight.

It answers how much finished dry product resulted from the fresh input loaded onto a Tray.

Within Freezeflow the official term is:

**Yield**

Yield is a key production insight, not merely a calculated field.

Milestone 3 records the underlying weights.

Milestone 7 (Reporting) provides yield analysis across production history.

---

## Package Weight

The final sealed weight of a Package.

This measurement is used to verify package integrity during long-term storage.

The preferred user-facing term is **Sealed Package Weight**.

---

## Package Type

A reusable description of a common packaging format.

Examples include:

* 1 qt Mylar
* 2 qt Mylar
* Pint Jar
* Half Gallon Jar

They provide defaults such as oxygen absorber size, label behavior, expected sealed weight, or packaging notes.

Package Types are part of the Packaging workflow.

Package Types are not implemented in Milestone 2.

---

# Historical Records

## Production History

Production History includes every recorded step from preparation through packaging.

Production History is never deleted.

---

## Production Notes

Freeform notes recorded during production.

Production Notes may appear on Production Batches, Trays, Weight Checks, Packaging Operations, and Packages.

Notes may include shorthand, corrections, calculations, observations, "same as above," and other imperfect real-world record keeping.

Production Notes are first-class production history, not disposable metadata.

---

## Traceability

Traceability is the ability to follow a Package backward through every stage of production.

Every Package should always be traceable to:

* the Production Batch
* the Freeze Dryer
* the Tray or Trays used
* the recorded Weight Checks
* the historical preparation information
* the Preparation Preset, if one was used

---

# Preferred Terminology

The following terms should be used consistently throughout the project.

| Preferred        | Avoid                          |
| ---------------- | ------------------------------ |
| Production Batch | Batch, Run, Job                |
| Freeze Dryer     | Machine                        |
| Tray             | Shelf                          |
| Weight Check     | Reading                        |
| Starting Weight  | Wet Weight, Fresh Weight       |
| Finished Product Weight | Tray Weight, Finished Weight   |
| Final Dry Weight | Tray Weight in user-facing UI  |
| Yield            | Dry yield, Moisture loss alone |
| Package          | Bag, Pouch                     |
| Package Type     | Container, Bag size            |
| Storage Location | Bin (when referring generally) |
| Inventory Status | State                          |

Specific storage locations (such as **Bin A**) are still referred to by their actual names.

---

# Naming Guidelines

Whenever possible:

* Use terms that match the user's workflow.
* Avoid manufacturing jargon unless it improves clarity.
* Prefer descriptive names over abbreviations.
* Use one term consistently rather than multiple synonyms.

The terminology defined in this document should be considered the official vocabulary of the Freezeflow project.
