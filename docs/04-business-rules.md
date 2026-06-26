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

A completed Tray may only be packaged once.

---

## TR-009

A Tray may either:

* be packaged individually, or
* be combined with other compatible trays before packaging.

It may never participate in both.

---

## TR-010

A Tray cannot be split between multiple packaging operations.

The entire tray always stays together.

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

A packaging operation may contain one or more completed Trays.

---

## PK-003

A Tray may only participate in one packaging operation.

---

## PK-004

Only compatible products should be packaged together.

Compatibility is determined by the user.

The system may provide suggestions but should not automatically combine products.

---

## PK-005

Every Package belongs to exactly one packaging operation.

---

## PK-006

Each Package records its final sealed weight.

---

## PK-007

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

Recipes exist to simplify data entry.

---

## RC-002

Recipes may be reused across many Production Batches.

---

## RC-003

Editing a Recipe does not modify historical Production Batches that previously used that Recipe.

Historical batches preserve the information that existed when they were created.

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

