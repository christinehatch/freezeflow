# 04 - Business Rules

# Purpose

This document defines the business rules that govern Freezeflow.

Business rules are permanent constraints that describe how the system must behave regardless of implementation details.

These rules are independent of the user interface, database, or API.

All application code should enforce these rules.

---

# Guiding Principle

Production history is more valuable than convenience.

Whenever possible, the system should preserve historical information rather than overwrite or delete it.

---

# Production Batch Rules

## PB-001

A Production Batch represents one freeze-dryer run.

---

## PB-002

A Production Batch belongs to exactly one Freeze Dryer.

---

## PB-003

A Production Batch must contain at least one Tray.

---

## PB-004

A Production Batch cannot be marked complete until every Tray within the batch has been completed.

---

## PB-005

Once completed, a Production Batch remains part of the permanent production history.

Production Batches are never deleted.

---

# Tray Rules

## TR-001

A Tray belongs to exactly one Production Batch.

---

## TR-002

A Tray represents one physical tray within a freeze dryer.

---

## TR-003

A Tray contains exactly one prepared product.

Different products may not exist on the same tray.

---

## TR-004

A Tray has one recorded starting (fresh) weight.

---

## TR-005

A Tray has one recorded final dry weight.

---

## TR-006

A Tray may have zero or more Weight Checks.

---

## TR-007

Once a Tray has been marked complete, no additional Weight Checks may be recorded.

---

## TR-008

A completed Tray may participate in only one Packaging Operation.

---

## TR-009

A Packaging Operation may either:

* package one completed Tray individually, or
* combine multiple compatible completed Trays before packaging.

A Tray may never participate in more than one Packaging Operation.

---

## TR-010

A Tray cannot be split between multiple Packaging Operations.

Once a Tray is included in a Packaging Operation, the entire Tray is considered consumed by that operation.

The resulting product may be divided into one or more Packages.

---

# Weight Check Rules

## WC-001

Each Weight Check belongs to exactly one Tray.

---

## WC-002

Weight Checks are recorded in chronological order.

---

## WC-003

Historical Weight Checks are never deleted.

---

## WC-004

Weight Checks represent observations made during production.

They should not be overwritten once recorded.

Corrections should preserve the original value whenever practical.

---

# Packaging Rules

## PK-001

Packaging begins only after a Tray has completed drying.

---

## PK-002

A Packaging Operation represents one packaging action.

The system creates a Packaging Operation when the user packages one or more completed Trays.

---

## PK-003

A Packaging Operation may contain one or more completed Trays.

---

## PK-004

A Tray may participate in only one Packaging Operation.

---

## PK-005

Only compatible products should be included in the same Packaging Operation.

Compatibility is determined by the user.

The system may provide suggestions but should not automatically combine products.

---

## PK-006

A Packaging Operation may produce one or more Packages.

---

## PK-007

A Packaging Operation records the total source weight of the completed Trays included in the operation.

---

## PK-008

The total source weight should be compared with the total weight of the Packages produced.

The system should warn the user when the values differ unexpectedly.

---

## PK-009

Every Package belongs to exactly one Packaging Operation.

---

## PK-010

Each Package records its final sealed weight.

---

## PK-011

Packages are the primary inventory units.

Inventory is tracked at the Package level, not the Tray level.

---

# Storage Rules

## ST-001

A Package occupies one Storage Location at a time.

---

## ST-002

Packages may be moved between Storage Locations.

Location history should be preserved whenever practical.

---

## ST-003

A Storage Location may contain any number of Packages.

---

# Inventory Rules

## IN-001

A Package has exactly one Inventory Status.

Examples include:

* In Storage
* Depleted

---

## IN-002

Marking a Package as Depleted does not remove it from the system.

---

## IN-003

Historical production information remains available after depletion.

---

## IN-004

Inventory searches should include depleted packages when historical information is requested.

---

# Recipe Rules

## RC-001

Recipes are reusable preparation templates.

---

## RC-002

Recipes may be reused across many Trays.

---

## RC-003

When a Tray is created from a Recipe, the relevant Recipe information is copied onto the Tray.

---

## RC-004

A Tray owns its historical preparation information.

The historical preparation information on a Tray is the source of truth for what was actually prepared.

---

## RC-005

Editing a Recipe does not modify historical Trays that previously used that Recipe.

Historical Trays preserve the preparation information that existed when they were created.

---

## RC-006

A Tray may be created without a Recipe.

In that case, the user records the product and preparation information directly on the Tray.

---

# Historical Data Rules

## HD-001

Historical production information is never deleted.

---

## HD-002

Production history should remain traceable from Package back to Production Batch.

---

## HD-003

Every Package must always be traceable to:

* the Production Batch
* the Tray or Trays that produced it
* the Freeze Dryer used
* the recorded Weight Checks
* the historical preparation information
* the Recipe, if one was used

---

## HD-004

Changes to inventory must never destroy production history.

---

# Reporting Rules

## RP-001

Reports are generated from historical production data.

Reports never become the source of truth.

---

## RP-002

Historical production records are immutable.

Reports should always reflect those records.

---

# Validation Rules

The application should prevent users from performing actions that violate these rules.

Whenever possible, invalid operations should be prevented rather than corrected afterward.

Examples include:

* Packaging the same Tray twice.
* Recording Weight Checks after a Tray has completed drying.
* Completing a Production Batch before every Tray has completed.
* Assigning a Package to multiple Storage Locations simultaneously.

---

# Future Expansion

Future features must continue to respect every business rule defined in this document.

New functionality should extend the workflow without violating production history, traceability, or inventory integrity.

Any rule changes should be documented before implementation.
