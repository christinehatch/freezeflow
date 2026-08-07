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

A Production Batch represents one freeze-drying production session for one Freeze Dryer load.

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

Production Batch completion requires explicit user confirmation.

A Production Batch must not automatically become Completed only because every Tray is Complete.

---

## PB-005

Once completed, a Production Batch remains part of the permanent production history.

Production Batches are never deleted.

---

## PB-006

When a Production Batch transitions from Draft to Running:

* `startedAt` is set to the time production began.
* Every Draft Tray in the Batch transitions to Running.
* The first Drying Run is created automatically.
* The first Drying Run records `startedAt`.

Tray setup is complete after this transition.

Draft Trays may no longer be added, edited, or removed.

---

## PB-007

A Freeze Dryer may have at most one Running Production Batch at a time.

A Draft Production Batch cannot be started while its Freeze Dryer already has a Running Production Batch.

---

# Drying Run Rules

## DR-001

A Drying Run represents one freeze dryer cycle or timer interval within a Running Production Batch.

---

## DR-002

A Drying Run belongs to exactly one Production Batch.

---

## DR-003

A Production Batch may have one or more Drying Runs.

Starting a Production Batch automatically creates the first Drying Run.

---

## DR-004

Only one active Drying Run may exist for a Production Batch at a time.

---

## DR-005

A Drying Run must record `startedAt`.

`startedAt` represents the actual time the freeze dryer cycle started.

---

## DR-006

Current Run Complete records `endedAt` on the active Drying Run.

`endedAt` represents the actual time the freeze dryer cycle ended.

---

## DR-007

Current Run Complete does not complete any Tray.

Current Run Complete does not complete the Production Batch.

---

## DR-008

Weight Checks may only be recorded after a Drying Run has ended and before another Drying Run starts.

---

## DR-009

Before another Drying Run can start, every Running Tray must have a Weight Check for the completed Drying Run.

Completed Trays are excluded from this requirement.

---

## DR-010

A mistaken Drying Run should be marked Voided with notes rather than deleted.

Voided Drying Runs remain historical records.

---

## DR-011

Corrections to Drying Run timestamps follow the Audit History model.

---

## DR-012

Total drying time is derived from the sum of non-voided Drying Run durations.

Production Batch wall-clock duration must not be used as actual drying time.

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

Starting Weight is required before the Production Batch can transition to Running.

---

## TR-007

A Tray has one recorded Finished Product Weight.

The persisted production concept may be named Final Dry Weight, but the user-facing label should emphasize the finished food weight rather than the reusable tray.

---

## TR-008

A Tray may have zero or more Weight Checks.

---

## TR-009

Once a Tray has been marked complete, no additional Weight Checks may be recorded.

---

## TR-010

A completed Tray may be referenced by only one active Packaging Allocation at a time.

The Packaging Allocation, not the Packaging Operation itself, records which completed Trays supply product to one or more Packages.

---

## TR-011

A Packaging Allocation may reference one completed Tray or combine multiple completed Trays from the same Production Batch.

Separate product combinations within one Production Batch use separate Packaging Allocations inside the same open Packaging Operation.

---

## TR-012

Completed product must not disappear when Packaging is interrupted or partially recorded.

Selected Source Weight, Allocated Weight, and Remaining Weight are derived for each Packaging Allocation. A Packaging Operation cannot complete while any Allocation has Remaining Weight greater than zero. Product that will never become a Package, for example a small amount lost to sampling or spillage, is explicitly recorded as Packaging Loss (PK-024) rather than left unaccounted for or corrected away on a Tray's historical weight.

---

# Weight Check Rules

## WC-001

Each Weight Check belongs to exactly one Tray.

Each Weight Check also belongs to exactly one Drying Run.

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

## WC-005

Weight Checks may only be recorded after Current Run Complete and before the next Drying Run starts.

---

## WC-006

Weight Checks record:

* observedAt, the time the Tray was weighed
* recordedAt, the time the entry was saved

---

# Packaging Rules

## PK-001

Packaging begins only after a Tray has completed drying.

---

## PK-002

A Packaging Operation is the resumable aggregate root for converting completed
product from one Production Batch into labeled inventory.

---

## PK-003

A Packaging Operation has status `Open` or `Completed` and is completed only by
an explicit user action.

---

## PK-004

A Production Batch may have at most one Open Packaging Operation.

---

## PK-005

A Packaging Allocation is an identified child of one Packaging Operation. It
references the exact completed Trays supplying product for one or more Packages.
It may exist before any Package is recorded but never independently of its
Packaging Operation.

---

## PK-006

All source Trays in a Packaging Allocation must belong to the Packaging
Operation's Production Batch. Separate product combinations use separate
Packaging Allocations.

---

## PK-007

Completed product may only be allocated to one active Packaging Allocation at a
time. A completed Tray already fully represented by completed Packaging work is
not eligible again.

---

## PK-008

Selected source weight, allocated weight, and remaining weight are derived from
source Tray Final Dry Weights and Package Finished Product Weights. Remaining
weight is not stored as an independently editable field.

Remaining weight also nets out any recorded Packaging Loss weight for the
Allocation (PK-024).

---

## PK-009

Every Package belongs to exactly one Packaging Allocation and therefore exactly
one Packaging Operation.

---

## PK-010

Each Package records its Sealed Package Weight and its Package Finished Product
Weight as separate measurements. Sealed Package Weight must never be used to
calculate fresh-weight equivalence.

---

## PK-011

Each Package records a Package Type.

Package Type may provide a default oxygen absorber size, but the user may override the oxygen absorber recorded on the Package.

---

## PK-012

Packages are the primary inventory units.

Inventory is tracked at the Package level, not the Tray level.

---

## PK-013

Package Fresh Equivalent is derived from source Tray Starting and Final Dry
Weights and the Package Finished Product Weight. It is not persisted as an
independently editable value.

For multiple source Trays, the calculation uses their combined weights. For
multiple Packages, each Package is calculated separately. Missing source
weights or a zero Final Dry Weight make the equivalent unavailable and do not
block printing.

---

## PK-014

Permanent package labels include Packaging Date and historical preparation or
contents from the source Trays. They do not include Storage Location because a
Package may move after the label is printed.

---

## PK-015

Completing a Packaging Operation must allocate the entire selected source
Finished Product Weight across Packages in its Allocations.

The sum of Package Finished Product Weights must equal the total Final Dry Weight
of the selected source Trays. Packaging remains in preparation while product is
unallocated or overallocated so that no source product silently disappears.

This allocation rule is distinct from the Finished Product Weight and Sealed
Package Weight distinction in PK-010. Differences involving Sealed Package Weight remain warnings because bags,
oxygen absorbers, labels, crumbs, and normal measurement variation may affect the
sealed weight.

---

## PK-016

Every persisted Package owns exactly one Package Label with state `Draft`,
`Ready`, or `Needs Reprint`.

A Package Label is presentation data and must not rewrite Production History,
Weight Checks, source Tray Preparation Metadata, or Packaging Operation facts.

---

## PK-017

Open Packaging work is durable. Allocations, planned package rows, draft label
information, recorded Packages, notes, and progress must survive navigation and
application restart. Planned package rows are not Packages or inventory.

---

## PK-018

A Package is created when the operator intentionally records it in Freezeflow.
The system does not infer the physical sequence and does not use a Draft Package
inventory state.

---

## PK-019

Package Label content may be edited after Package creation. Editing a previously
printed label sets its state to `Needs Reprint`. Before Milestone 8, the current
content is overwritten; Milestone 8 adds label-edit Audit history.

---

## PK-020

Printing and reprinting append Print Events. `Printed` and `Reprinted` are events,
not Package Label states, and Print Events must not modify inventory or Production
History.

---

## PK-021

One selection-based print engine supports Package, Packaging Allocation,
Packaging Operation, Production Batch, today's Ready labels, and custom Package
selection scopes. Avery 5163 output supports ten labels per sheet.

---

## PK-022

Package creation automatically creates the initial `In Storage` Package Status
History record and initial Storage Location History using the selected Storage
Location or the implicit Unassigned Storage Location.

---

## PK-023

The application must not require the operator to perform filling, weighing,
label preparation, printing, and storage assignment in one fixed physical order.
All required information must be present before the Packaging Operation completes.

---

## PK-024

A Packaging Allocation may record zero or more Packaging Loss entries for
Selected Source Weight that will never become a Package, for example product
lost to sampling, spillage, or crumbs. Each Packaging Loss records a weight
greater than zero and a required reason, cannot exceed the Allocation's
Remaining Weight, and is append-only once saved. See ADR-0016.

Recording a Packaging Loss reduces Remaining Weight the same way allocating
that weight to a Package would, but it never modifies a source Tray's Final
Dry Weight or any other historical production record.

---

# Storage Rules

## ST-001

A Package occupies one Storage Location at a time.

If the user does not choose a Storage Location during Packaging, the Package uses the implicit Unassigned Storage Location.

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
* Given Away
* Depleted

---

## IN-002

Marking a Package as Depleted does not remove it from the system.

---

## IN-003

Marking a Package as Given Away means the Package left the user's inventory as a gift or transfer.

Given Away Packages remain historical records and are excluded from default active inventory counts.

---

## IN-004

Historical production information remains available after depletion.

---

## IN-005

Inventory searches should include depleted packages when historical information is requested.

Inventory searches should also include Given Away packages when historical information is requested.

---

## IN-006

Creating a Package automatically creates its initial Package Status History record with status In Storage.

---

## IN-007

Every Package Inventory Status transition appends one Package Status History record.

Package Status History is never edited or deleted.

---

## IN-008

Package status transitions record both the Effective Time of the real-world event and the system-assigned Recorded Time.

The Effective Time defaults to the current time and may be changed by the user before confirming the transition.

---

## IN-009

Package status transitions may include optional Notes.

Notes provide context without creating Recipient, Gift, Consumption, or Disposal entities.

---

## IN-010

Correction is not an Inventory Status.

Incorrect lifecycle actions follow the correction and audit policy and never silently overwrite Package Status History.

---

# Preparation Metadata and Preset Rules

## RC-001

Preparation Presets are optional reusable combinations of Product, Ingredients,
Preparation Methods, and default Notes.

---

## RC-002

Preparation Presets may be reused across many Trays.

---

## RC-003

When a Preparation Preset is applied, its relevant values are copied into the
Tray's Preparation Metadata snapshot.

---

## RC-004

A Tray owns its immutable historical Preparation Metadata snapshot.

The historical preparation information on a Tray is the source of truth for what was actually prepared.

---

## RC-005

Editing a Preparation Preset or reusable suggestion does not modify historical
Trays that previously used it.

Historical Trays preserve the preparation information that existed when they were created.

---

## RC-006

A Tray may be created without a Preparation Preset.

Users may enter one-off Product, Ingredient, and Preparation Method values inline
without first creating reusable catalog records.

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

Fresh-to-dry yield compares Starting Weight to Finished Product Weight for a Tray.

It answers how much finished dry product resulted from the fresh input loaded onto the tray.

---

## YD-002

Yield depends on Starting Weight and Finished Product Weight.

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
* the Preparation Metadata snapshot
* the Preparation Preset, if one supplied defaults

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

Future enhancements may include deeper packaging supply tracking such as stock counts, reorder reminders, and package label automation.
