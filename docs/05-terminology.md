# 05 - Terminology

# Purpose

This document defines the official terminology used throughout Freezeflow.

These definitions establish a shared language for users, developers, documentation, APIs, and future contributors.

Whenever possible, terminology should reflect how users naturally describe their freeze-drying workflow rather than technical implementation details.

Every feature, screen, API, and database model should use these terms consistently.

---

# Production

## Production Batch

A Production Batch represents one complete freeze-dryer run.

It begins when trays are loaded into a freeze dryer and ends when every tray has completed drying.

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

## Tray

A Tray represents one physical tray inside a freeze dryer.

Each tray contains one prepared product.

A tray is tracked independently throughout the drying process.

Examples:

* Tray 1
* Tray 2
* Tray 3
* Tray 4

---

## Weight Check

A Weight Check is a recorded weight measurement taken during the drying process.

Multiple Weight Checks may exist for a single Tray.

Weight Checks preserve the drying history.

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

This value is used to determine moisture loss and production yield.

---

## Package Weight

The final sealed weight of a Package.

This measurement is used to verify package integrity during long-term storage.

---

# Historical Records

## Production History

Production History includes every recorded step from preparation through packaging.

Production History is never deleted.

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
| Package          | Bag, Pouch                     |
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
