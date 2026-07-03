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

Completing a Tray records Final Dry Weight and prevents additional Weight Checks for that Tray.

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

## Recipe

A Recipe is a reusable preparation template.

It describes *how* a product is commonly prepared before freeze drying.

Examples:

* Taco Chicken
* Garlic Chicken
* Sliced Strawberries

A Recipe may include:

* preparation instructions
* seasonings
* notes
* default settings

A Recipe may be reused across many Trays.

When a Tray is created from a Recipe, the relevant Recipe information is copied onto the Tray.

The copied preparation information becomes the historical record for that Tray.

Editing a Recipe affects future Trays only.

---

## Tray Preparation

Tray Preparation is the historical preparation information stored on a Tray.

It records what was actually prepared for that specific Tray.

Tray Preparation may be copied from a Recipe or entered directly by the user.

---

# Packaging

## Packaging

Packaging is the process of converting completed trays into sealed storage bags.

Packaging occurs only after drying has completed.

---

## Packaging Operation

A Packaging Operation is the internal record created when completed trays are packaged.

It connects the selected source trays to the Packages produced from them.

Users do not need to manage Packaging Operations directly.

---

## Package

A Package is one sealed storage bag.

A Package becomes the primary inventory unit.

Each Package contains product from one Packaging Operation.

Examples:

* 5.2 oz Taco Chicken
* 6.1 oz Strawberries

---

## Package Weight

Package Weight refers to the weight of the completely sealed package, including:

* food
* Mylar bag
* oxygen absorber
* label (if applicable)

Package Weight is preserved for long-term verification of package integrity.

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

## Inventory Status

Inventory Status describes the current state of a Package.

Examples include:

* In Storage
* Depleted

Inventory Status never removes historical production information.

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

---

## Yield

Fresh-to-dry yield compares Starting Weight to Final Dry Weight.

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

---

## Package Type

A reusable description of a common packaging format.

Examples include:

* 1 qt Mylar
* 2 qt Mylar
* Pint Jar
* Half Gallon Jar

Package Types are a future concept.

They may eventually provide defaults such as oxygen absorber size, label behavior, expected sealed weight, or packaging notes.

Milestone 4 records package attributes directly on each Package.

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
* the Recipe, if one was used

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
| Final Dry Weight | Finished Weight                |
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
