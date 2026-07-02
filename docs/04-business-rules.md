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

A Draft Production Batch may temporarily contain zero Trays while it is being assembled.

A Production Batch must contain at least one Tray before it can transition to the Running state.

A Production Batch cannot contain more Trays than the assigned Freeze Dryer's configured Tray Slot count.

---

## PB-004

A Production Batch cannot be marked complete until every Tray within the batch has been completed.

---

## PB-005

Once completed, a Production Batch remains part of the permanent production history.

Production Batches are never deleted.

---

## PB-006

When a Production Batch transitions from Draft to Running:

* `startedAt` is set to the time production began.
* Every Draft Tray in the Batch transitions to Running.

Tray setup is complete after this transition.

Draft Trays may no longer be added, edited, or removed.

---

## PB-007

A Freeze Dryer may have at most one Running Production Batch at a time.

A Draft Production Batch cannot be started while its Freeze Dryer already has a Running Production Batch.

---

# Freeze Dryer Rules

## FD-001

Every Production Batch must belong to exactly one Freeze Dryer.

---

## FD-002

A Freeze Dryer may have any number of Production Batches over its lifetime.

---

## FD-003

A Freeze Dryer may have at most one Running Production Batch at a time.

---

## FD-004

Archived Freeze Dryers cannot be selected when creating or starting a new Production Batch.

---

## FD-005

Freeze Dryers cannot be deleted if historical Production Batches reference them.

Freeze Dryers should normally be archived rather than deleted.

---

## FD-006

A Freeze Dryer has a configured Tray Slot count.

Tray Slots define the machine's capacity for a Production Batch.

---

## FD-007

A Tray Slot is a position inside a Freeze Dryer.

A Tray Slot does not represent a reusable Physical Tray.

---

# Physical Tray Rules

## PT-001

A Physical Tray is reusable equipment owned by the user.

---

## PT-002

A Physical Tray does not belong permanently to one Freeze Dryer.

---

## PT-003

A Physical Tray may be selected for use in a Tray Slot during Production Batch setup.

---

## PT-004

Changing or archiving a Physical Tray must not alter historical Tray records from completed or running Production Batches.

---

# Tray Rules

## TR-001

A Tray belongs to exactly one Production Batch.

---

## TR-002

A Tray represents one loaded tray record within a Production Batch.

A Tray records the Physical Tray and Tray Slot used for that Production Batch when those setup records are available.

---

## TR-003

A Tray Slot may be used at most once within a single Production Batch.

---

## TR-004

A Physical Tray may be selected at most once within a single Production Batch.

---

## TR-005

A Tray contains exactly one prepared product.

Different products may not exist on the same tray.

---

## TR-006

A Tray has one recorded Starting Weight.

Starting Weight is recorded when drying begins, not during Milestone 2 production setup.

---

## TR-007

A Tray has one recorded final dry weight.

---

## TR-008

A Tray may have zero or more Weight Checks.

---

## TR-009

Once a Tray has been marked complete, no additional Weight Checks may be recorded.

---

## TR-010

A completed Tray may participate in only one Packaging Operation.

---

## TR-011

A Packaging Operation may either:

* package one completed Tray individually, or
* combine multiple compatible completed Trays before packaging.

A Tray may never participate in more than one Packaging Operation.

---

## TR-012

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

# Production Notes Rules

## NT-001

Production notes are first-class production history.

Notes may appear on Production Batches, Trays, Weight Checks, Packaging Operations, and Packages.

---

## NT-002

Notes may include shorthand, corrections, calculations, observations, "same as above," and other imperfect real-world record keeping.

The system should preserve notes faithfully rather than requiring formal structure.

---

## NT-003

Notes are never deleted as part of normal production workflow.

Corrections to notes follow the audit process defined in ADR-0005.

---

## NT-004

Notes should be searchable where appropriate so users can locate past observations, preparation details, and packaging decisions.

---

## NT-005

Notes are not disposable metadata.

They contribute to traceability and historical understanding alongside structured production data.

---

# Yield Rules

## YD-001

Fresh-to-dry yield compares Starting Weight to Final Dry Weight for a Tray.

It answers how much finished dry product resulted from the fresh input loaded onto the tray.

---

## YD-002

Yield depends on Starting Weight and Final Dry Weight.

Both values are recorded in Milestone 3.

Yield calculations and historical yield insights belong in Reporting (Milestone 7).

---

## YD-003

Reports may also compare total packaged output to source tray weight after Milestone 4 introduces Packaging.

That comparison answers a related but distinct question about packaging efficiency.

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

## HD-005

Important workflow events should be preserved as historical records whenever practical.

Examples include Weight Checks, Packaging Operations, Storage Location History, Audit Entries, lifecycle timestamps, and production notes.

---

## HD-006

Current state may be stored for usability, but it must not replace the historical records needed to explain how that state was reached.

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

Future enhancements may include Package Types as reusable packaging templates with defaults for oxygen absorber, label behavior, expected weight, and packaging notes.

Package Types are not part of Milestone 2.
