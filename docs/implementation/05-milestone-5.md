# Milestone 5 - Inventory

## Status

Planned - Ready for implementation.

All Open Decisions below have been resolved in the authoritative architecture, business-rules, persistence, and API documentation. See each decision's entry under Open Decisions for where its resolution now lives.

---

# Goal

Build the day-to-day Inventory experience for locating, reviewing, storing, moving, and retiring finished Packages while preserving complete Production, Packaging, and storage history.

Milestone 5 begins after Packaging has created Packages.

At this point, the operator's primary questions change from:

- What am I producing?
- Is this food finished drying?
- How should I package it?

to practical Inventory questions such as:

- Do I already have this product?
- Where did I put it?
- How many Packages are still available?
- Which Package should I use first?
- Has this Package already been used or given away?

Inventory should feel like managing a well-organized pantry rather than operating an administrative system.

The primary goal is retrieval: helping the operator find stored food quickly while preserving complete historical traceability when deeper information is needed.

---

# Objectives

Implement:

* fast, product-focused Inventory browsing
* fast Inventory search and filtering
* Storage Location setup and lifecycle management
* Package Details with complete Production, Packaging, storage, and status traceability
* Package movement between Storage Locations
* append-only Storage Location History
* Package Status History
* Inventory Status changes to Given Away or Depleted
* historical visibility for terminal Packages
* clear handling of the system-provided Unassigned Storage Location

The Inventory workflow should prioritize finding and using stored food over managing Package records.

---

# Scope

Milestone 5 includes:

* creating, viewing, editing, archiving, and restoring user-managed Storage Locations
* browsing completed Packages as Inventory
* presenting Inventory in a product-focused way where appropriate
* grouping Packages by Product where useful for discovery
* searching and filtering Packages using documented Inventory information
* viewing current Package location and Inventory Status
* viewing Package, Package Label, Packaging, Tray, Production Batch, Freeze Dryer, Preparation Metadata, and Weight Check history when available
* moving an In Storage Package to another active Storage Location
* recording every Package movement as append-only Storage Location History
* marking an In Storage Package Given Away
* marking an In Storage Package Depleted
* excluding Given Away and Depleted Packages from the default active Inventory view
* retaining Given Away and Depleted Packages in historical search and Package Details

Inventory remains Package-based for persistence and traceability.

Product grouping is a presentation and discovery mechanism over Packages. It does not create aggregate Inventory records or replace Package-level history.

Milestone 5 does not introduce remaining-quantity accounting inside a Package.

---

# Out of Scope

Do not include:

* partial Package consumption
* splitting or merging existing Packages
* reopening Given Away or Depleted Packages
* deleting Packages or Production history
* Preparation Preset CRUD
* recipe archive or restore
* production reports or Inventory analytics
* corrections UI
* audit history UI
* automatic storage recommendations
* barcode or QR-code workflows
* Package movement in bulk unless separately documented
* sales, recipients, transfer destinations, or customer management for Given Away Packages

Preparation Preset management belongs to Milestone 6.

Reports belong to Milestone 7.

Corrections and Audit History belong to Milestone 8.

---

# Workflow Summary

1. Packaging creates one or more Packages.
2. Packages enter Inventory with an Inventory Status and current Storage Location.
3. The operator stores Packages in physical locations.
4. Later, the operator opens Inventory to find food.
5. The application defaults to food that is currently available.
6. The operator may browse by Product, search, or filter Inventory.
7. The operator opens a Product group or individual Package when more detail is needed.
8. For an In Storage Package, the operator may:
   * move it to a different active Storage Location
   * mark it Given Away
   * mark it Depleted

   Package notes are visible and searchable but read-only in Milestone 5; editing follows in Milestone 8 (ADR-0005).
9. A move atomically updates the Package's current Storage Location and appends a Storage Location History record.
10. Given Away and Depleted Packages leave the default active view but remain available in historical search and Package Details.

Inventory never modifies Production or Packaging history.

---

# Inventory Philosophy

Inventory is the operator's daily workspace after Production and Packaging are complete.

Unlike Production and Packaging, Inventory is primarily a retrieval workflow rather than a creation workflow.

Operators naturally think in terms of food and products rather than Package identifiers.

An operator is more likely to think:

> "Where is my taco chicken?"

than:

> "Where is Package PKG-2026-000184?"

The Inventory experience should therefore make it easy to answer:

* Do I already have this Product?
* Where is it stored?
* How many Packages are still available?
* Which Package is oldest?
* Which Package should I grab?

Package identifiers remain essential for traceability but are secondary to finding food.

Internal implementation concepts such as Packaging Operations, Packaging Allocations, Planned Package Rows, and persistence relationships should not dominate everyday Inventory workflows.

Those concepts remain available when the operator intentionally reviews historical traceability.

Inventory Status affects availability, not history.

No Package disappears from Freezeflow simply because it is no longer active Inventory.

---

# Storage Locations

Storage Locations represent real physical places where food is stored, such as a bin, shelf, pantry, cabinet, or other storage area.

Their primary purpose is to help the operator answer:

> "Where did I put this?"

Milestone 5 should support:

* listing active and archived Storage Locations
* creating a user-managed Storage Location
* editing its name and notes
* archiving a user-managed Storage Location
* restoring an archived Storage Location
* showing the Packages currently assigned to a Storage Location

Storage Locations are archived rather than deleted.

An archived Storage Location:

* may retain Packages already assigned to it
* remains visible in historical records
* cannot receive new Packages
* must allow an In Storage Package to be moved out to an active Storage Location

Renaming a Storage Location changes its displayed name throughout the application.

Renaming does not represent Package movement and must not create a Storage Location History record.

Storage Location names are trimmed and non-blank, and are case-insensitively unique across both active and archived locations. `Unassigned` is reserved and cannot be created, renamed, archived, or restored by the user. See business rules ST-004 through ST-006 and `docs/persistence/08-storage-location.md` (SL-007 through SL-009).

---

# Inventory Browsing

Inventory is a product-focused search and discovery experience, not a Production workspace or Package administration screen.

The default Inventory view should:

* show currently available Inventory first
* default to Packages with Inventory Status In Storage
* make Product names the primary visual identifier
* make current Storage Location easy to scan
* make available Package count easy to understand
* make Package identifier available but visually secondary
* make Package Type, relevant Package weight, Packaging date, and current status available when useful
* provide a direct path to individual Package Details
* provide a clear loading state
* provide a useful empty state
* provide a clear load-failure state

Given Away and Depleted Packages should not appear in default active Inventory counts or results.

Users must be able to intentionally include terminal Packages when searching historical Inventory.

---

# Product Groups

Inventory may group Packages by Product to improve browsing and retrieval.

Product grouping exists for the operator's convenience. It does not replace Package-level Inventory records.

A Product group may summarize:

* Product name
* available Package count
* Given Away Package count when historical information is requested
* Depleted Package count when historical information is requested
* current Storage Locations containing available Packages
* oldest available Package
* newest available Package

Operators should be able to expand or open a Product group to see its individual Packages.

Each individual Package remains independently:

* identifiable
* stored
* movable
* depletable
* historically traceable

Product grouping must never obscure Package-level history or imply that quantities from multiple Packages have been merged.

---

# Search and Filtering

Searching Inventory should be one of the fastest workflows in the application.

An operator should be able to begin typing a Product name and quickly answer whether that food exists and where it is stored.

Inventory search should support documented Package information, including:

* Product
* Package identifier
* Package Label presentation fields used for identification
* preparation information
* immutable Preparation Metadata snapshot information
* Package notes
* Storage Location
* Inventory Status
* Package Type where available

Filters should allow users to narrow results by:

* current Storage Location
* Inventory Status
* Product where useful
* Package Type where useful

The default Inventory Status filter is In Storage.

The search contract is fully defined in business rules IN-011 and IN-012 and in `09-api-design.md`'s Search Inventory endpoint:

* matching is case-insensitive and partial, against Product name, Package identifier, Package Label Display Name, Package notes, immutable Preparation Metadata preparation summary, Storage Location name, and Package Type name
* a free-text query and structured filters combine with AND
* default sort is Product name ascending, then Packaging Date oldest first within each Product
* pagination uses `limit` (default 50, max 100) and `offset` (default 0)
* archived Storage Locations are not offered as move destinations but may still be used as a search filter to find historically stored Packages
* the searchable Preparation Metadata and Package Label fields before Milestone 6 are the immutable Tray preparation summary and the current Package Label Display Name; a future Preparation Preset library is not searched (see business rule IN-011 and ADR-0013)

---

# Package Selection and Oldest-First Use

Inventory should make it easy to understand which available Package is oldest.

This supports a natural oldest-first usage pattern without introducing expiration management or automatic recommendations.

Where multiple Packages of the same Product are available, the UI should make Packaging date readily visible and should not make the operator inspect individual Production history merely to identify the oldest Package.

Default sorting is Product name ascending, then Packaging Date oldest first within each Product (business rule IN-012), so the oldest available Package of a Product surfaces first without the operator needing to inspect Production history.

---

# Package Details

Package Details are the complete historical view of one Package.

They should organize information around operator questions rather than persistence entities.

Package Details should answer:

* What is this?
* Where did it come from?
* How was it packaged?
* Where is it now?
* Where has it been?
* Is it still available?
* What has happened to it?

Package Details should contain these conceptual sections:

1. Package
2. Package Label
3. Production
4. Packaging
5. Storage
6. History

The Package Label section should show the editable human-facing label owned by the Package.

Package Label editing and reprinting remain Milestone 4 behavior.

Inventory may display Package Label fields for identification, but it must never use label edits to rewrite Production History.

Across these sections, Package Details should show:

* Package identifier
* Product and preparation snapshot
* Package Type
* Finished Product Weight
* Sealed Package Weight
* derived Fresh Equivalent when available
* Packaging date
* Package notes
* oxygen absorber information
* current Inventory Status
* current Storage Location
* source Packaging Operation
* source Packaging Allocation when needed for traceability
* source Tray or Trays
* Production Batch
* Freeze Dryer
* Starting Weight
* Weight Checks
* Final Dry Weight
* drying history
* Preparation Preset reference when one was used
* Storage Location History
* Package Status History

For an In Storage Package, Package Details should expose permitted Inventory actions.

Given Away and Depleted Packages are historical and must not expose actions that reopen or move them.

Package identifiers exist primarily for traceability rather than everyday navigation.

Package notes display as read-only in Milestone 5. Editing Package notes with append-only correction history is introduced in Milestone 8 (ADR-0005, business rule PA-016).

---

# Package Movement

Only a Package with Inventory Status In Storage may be moved.

A movement must:

* identify the Package
* identify a different active destination Storage Location
* record the previous Storage Location
* record the new Storage Location
* record the movement timestamp
* preserve optional movement notes when supplied
* atomically update the Package's current Storage Location
* append one Storage Location History record

A movement to the Package's current Storage Location must be rejected and must not create history.

An archived Storage Location cannot receive a Package.

An In Storage Package already assigned to an archived Storage Location may be moved out to an active location.

Movement never changes:

* Production history
* Packaging traceability
* Package identity
* Inventory Status

Package movement is expected to be less common than finding Inventory. The UI should support movement clearly without allowing movement controls to dominate the primary retrieval experience.

---

# Storage Location History

Storage Location History is append-only.

Every Package receives an initial Storage Location History record when Packaging creates it.

The first record:

* has no previous Storage Location
* identifies the selected location or Unassigned as the current Storage Location

Every later movement appends a new record.

Existing history records are never edited or deleted.

The Package's current Storage Location must always match the current Storage Location on its latest history record.

Package Details should display the movement timeline in chronological order with:

* previous location
* new location
* movement time
* notes when present

---

# Package Status History

Package Status History is the append-only lifecycle record defined by ADR-0012 and `docs/persistence/15-package-status-history.md`.

Creating a Package automatically creates its initial In Storage Package Status History record.

Every later transition atomically:

* updates the Package's current Inventory Status
* appends one Package Status History record

Each record preserves:

* previous status, null for initial Package creation
* current status
* Effective Time supplied by the user or defaulted to the current time
* system-assigned Recorded Time
* optional Notes

Package Status History is never edited or deleted.

Correction is not an Inventory Status and follows ADR-0005.

---

# Given Away

Given Away means the entire Package left active Inventory as a gift or transfer.

Rules:

* only an In Storage Package may become Given Away
* the transition is explicit and user-confirmed
* the entire Package becomes unavailable
* the Package is excluded from default active Inventory counts and results
* the Package remains searchable when historical statuses are included
* Package Details and all Production traceability remain available
* the Package cannot be moved
* the Package cannot be depleted
* the Package cannot return to In Storage
* the Package cannot be deleted

Milestone 5 records the status and historical transition.

It does not manage recipients, transfers, sales, or destinations as separate domain entities.

---

# Depleted

Depleted means the entire Package has been consumed or is otherwise no longer available.

Rules:

* only an In Storage Package may become Depleted
* the transition is explicit and user-confirmed
* the entire Package becomes unavailable
* the Package is excluded from default active Inventory counts and results
* the Package remains searchable when historical statuses are included
* Package Details and all Production traceability remain available
* the Package cannot be moved
* the Package cannot be Given Away
* the Package cannot return to In Storage
* the Package cannot be deleted

Milestone 5 does not track partial Package consumption.

---

# Historical Visibility

Inventory Status affects availability, never history.

Given Away and Depleted Packages remain part of the permanent Production record.

Terminal Packages must remain:

* persisted
* addressable by Package identifier
* searchable through an explicit historical-status filter
* visible in Package Details
* linked to Package Status History
* linked to Storage Location History
* linked to Packaging history
* linked to Production history

Archiving a Storage Location must not hide or break Package movement history.

Search should make historical Packages available intentionally without allowing terminal Packages to clutter the default active Inventory experience.

---

# Traceability

Every Inventory Package must remain traceable to:

* its Package identifier
* its Package Type
* its Packaging Operation
* its Packaging Allocation when needed to preserve exact source relationships
* its source Tray or Trays
* its Production Batch
* its Freeze Dryer
* Preparation Metadata and Preparation Preset information when available
* Starting Weight
* Weight Checks
* Final Dry Weight
* current Storage Location
* historical Storage Locations
* current Inventory Status
* Package Status History

Inventory actions must never rewrite Packaging or Production history.

Everyday Inventory browsing should not require the operator to navigate through this entire chain.

Traceability should remain available when requested rather than dominating the primary Inventory experience.

---

# UI Expectations

The Inventory interface should optimize for finding food rather than managing database records.

Operators should spend minimal time navigating and maximum time finding what they need.

Historical information should always be available without overwhelming everyday workflows.

The Inventory UI should:

* open as a focused search and browsing screen
* default to currently available food
* make Product names prominent
* support product-focused grouping where documented
* keep search immediately accessible
* keep common filters immediately accessible
* make available Package counts understandable
* make current Storage Locations easy to scan
* make Packaging dates available so older Packages can be identified
* keep Package identifiers available but secondary
* show active, Given Away, and Depleted states clearly
* preserve search context when returning from Package Details where practical
* use explicit confirmation for terminal status changes
* explain that Given Away and Depleted Packages remain in history
* prevent move controls from offering archived destinations
* display Storage Location History and Package Status History timelines on Package Details
* provide loading states
* provide empty states
* provide validation states
* provide confirmation states
* provide success states
* provide failure states

Storage Location setup should be available without turning Inventory into an administrative dashboard.

Internal implementation concepts should not appear in primary Inventory UI unless they are necessary to explain traceability or a validation failure.

The final placement of Storage Location management and the exact responsive result layout should follow the wireframes and established navigation patterns.

---

# API Expectations

Milestone 5 requires workflow-oriented API capabilities for:

* listing active and archived Storage Locations
* creating a Storage Location
* editing a Storage Location
* archiving a Storage Location
* restoring a Storage Location
* searching and filtering Inventory Packages
* supporting Product-focused Inventory projections where documented
* retrieving Package Details with traceability
* retrieving Storage Location History
* retrieving Package Status History
* moving an In Storage Package
* marking an In Storage Package Given Away
* marking an In Storage Package Depleted

Commands must enforce lifecycle and Storage Location rules in backend business logic.

The client must not be the only enforcement layer.

`09-api-design.md` fully defines the versioned `/api/v1` routes, request and
response schemas, and validation behavior for Storage Location management
(list, create, get, update, archive, restore), Inventory search and Product
Groups, Package storage and status history retrieval, and Package move, Given
Away, and Depleted actions. Storage Location archive/restore and Package
move/Given-Away/Depleted use explicit action endpoints rather than generic
field PATCH because each represents a domain transition, not an ordinary edit.

---

# Persistence Expectations

Use the authoritative persistence model.

Package stores:

* one current Storage Location
* one current Inventory Status

Package Status History:

* records initial In Storage state
* records every later transition
* is append-only

Storage Location stores:

* current name
* notes
* archive state

Storage Location History:

* records initial placement
* records every later move
* is append-only

Unassigned is a protected system Storage Location.

Product groups are derived Inventory views over Packages and are not independently persisted Inventory aggregates.

Moving a Package must occur in one transaction that:

1. updates the Package's current Storage Location
2. inserts the new Storage Location History record

Terminal Inventory transitions must preserve the Package and all relationships.

Database constraints and indexes must enforce or support:

* exactly one current Storage Location per Package
* exactly one current Inventory Status per Package
* initial Package Status History creation
* most recently recorded Package Status History consistency
* latest Storage Location History consistency
* protected Unassigned behavior
* active destination validation
* common Product search access paths
* common Inventory search and filter access paths

Package creation and terminal status commands must update current state and append required history records atomically.

---

# Validation Rules

Backend business logic must enforce:

* every Package has exactly one current Storage Location
* every Package has exactly one current Inventory Status
* omitted Packaging location resolves to Unassigned before Inventory begins
* only In Storage Packages may move
* only In Storage Packages may become Given Away or Depleted
* Given Away and Depleted are terminal
* every successful status transition appends one Package Status History record
* status transitions accept an Effective Time defaulted to the current time and optional Notes
* a Package cannot move to its current Storage Location
* same-location rejection creates no history
* a Package cannot move into an archived Storage Location
* a Package in an archived Storage Location may move out to an active location
* every successful move atomically updates current location and appends one history record
* renaming a Storage Location creates no Package movement history
* Storage Locations are archived rather than deleted
* Unassigned cannot be renamed, archived, or deleted
* Inventory actions never delete or alter Production traceability
* Product grouping never replaces Package-level persistence or history
* Storage Location names are trimmed, non-blank, and case-insensitively unique across active and archived locations (ST-004, ST-005)
* `Unassigned` cannot be created, renamed, archived, or restored by the user (ST-006)
* Inventory search combines a free-text query and structured filters with AND (IN-011)

---

# Testing Expectations

## Backend

Add tests for:

* Storage Location create, edit, archive, and restore
* protected Unassigned behavior
* assigning Packages to Unassigned during Packaging when no location is selected
* default Inventory results including only In Storage Packages
* Product grouping behavior where implemented
* available Package counts by Product
* oldest and newest Package projection where implemented
* historical searches including Given Away and Depleted Packages
* documented search fields and filters
* Package Details traceability
* moving an In Storage Package
* atomic current-location update and history insertion
* initial Storage Location History
* repeated Package movements preserving all history
* same-location move rejection without history insertion
* archived destination rejection
* moving a Package out of an archived location
* Storage Location rename without movement history
* In Storage to Given Away transition
* In Storage to Depleted transition
* rejection of transitions from terminal states
* rejection of movement for terminal Packages
* automatic initial In Storage Package Status History creation
* initial status Effective Time inherited from the Package's `packagedAt`
* transitional Package Status History with user-supplied Effective Time and system-assigned Recorded Time
* optional transition Notes
* append-only Package Status History that cannot be edited or deleted
* rollback behavior when an Inventory command fails

## Frontend

Add component tests for:

* default active Inventory view
* Product-focused browsing
* Product-group display where implemented
* fast Product search workflow
* search and filters
* historical-status inclusion
* Inventory load state
* Inventory empty state
* Inventory error state
* Storage Location setup and archive states
* Package Details traceability and timelines
* move validation and confirmation
* Given Away confirmation and resulting historical state
* Depleted confirmation and resulting historical state
* terminal Package read-only behavior
* Package identifiers remaining secondary to Product discovery

## Browser E2E

Extend the reusable Playwright mock API and add user-flow tests for:

* locating food by Product through Inventory search
* opening a Product group and locating an individual Package
* identifying where an available Product is stored
* identifying the oldest available Package where applicable
* moving a Package and seeing its updated location and history
* marking a Package Given Away
* marking a Package Depleted
* excluding terminal Packages from the default view
* finding terminal Packages with historical filters
* opening Package Details and preserving Packaging-to-Production traceability
* creating, archiving, and restoring Storage Locations

Use a real-backend smoke test for the critical Inventory workflow after automated mock-backed coverage passes.

---

# Deliverables

Milestone 5 deliverables are:

* accepted Package Status History ADR
* Package Status History persistence documentation
* updated Package persistence documentation
* completed versioned Inventory API contracts
* documented Inventory search contract
* documented Product-focused Inventory projection where used
* Storage Location backend workflows
* Storage Location frontend setup UI
* Product-focused Inventory browsing experience
* fast Inventory search experience
* Inventory search and browsing API
* Inventory page
* Package Details Inventory actions and history timelines
* Package movement with append-only Storage Location History
* Given Away workflow
* Depleted workflow
* backend business-rule tests
* frontend component tests
* Playwright Inventory workflow tests
* real-backend Inventory smoke-test notes
* documentation cleanup for stale Inventory and Storage Location wording

---

# Open Decisions

Every decision below is resolved. Each entry keeps its original question for
context and records where the resolution now lives in the authoritative
documentation.

## Previously Blocking

### 1. Inventory and Storage Location API contracts — Resolved

Resolved in `09-api-design.md`: versioned `/api/v1` routes, request and
response schemas, and validation for Storage Location list, create, get,
update, archive, and restore; and for Inventory search, Product Groups,
Package storage history, and Package move. Errors use the project's existing
common error envelope; business-rule violations (archived destination,
terminal Package, duplicate name, same-location move) return descriptive
error codes and messages through that same envelope. Storage Location
archive/restore and Package move/Given-Away/Depleted use explicit action
endpoints because they are domain transitions, not field edits; `PATCH
/storage-locations/{id}` is limited to descriptive fields (name, notes).

### 2. Inventory Search Contract — Resolved

Resolved in business rules IN-011 and IN-012 and in `09-api-design.md`'s
Search Inventory endpoint: case-insensitive partial matching, trimmed
whitespace, AND-combination between a free-text query and structured filters,
default status `In Storage`, default sort Product name ascending then
Packaging Date oldest first, and `limit`/`offset` pagination (default 50, max
100). See Decision 5 for which Preparation and Package Label fields are
searchable before Milestone 6.

---

## Previously Needing Clarification

### 3. Storage Location Naming Rules — Resolved

Resolved in business rules ST-004 through ST-006 and
`docs/persistence/08-storage-location.md` (SL-007 through SL-009): names are
trimmed and must not be blank; names are case-insensitively unique across
both active and archived locations, so reusing a name requires restoring the
archived location rather than creating a new one; `Unassigned` is reserved
and cannot be created, renamed, archived, or restored by the user.

---

### 4. Package Notes Corrections — Resolved

Resolved: Package notes are read-only in Milestone 5's Inventory. Milestone 5
does not invent correction semantics or ship a notes-editing endpoint.
Editing Package notes with append-only correction history follows in
Milestone 8, consistent with ADR-0005. See business rule IN-013,
`docs/persistence/07-package.md` (PA-016), and the Workflow Summary and
Package Details sections above, which have been updated to reflect this.

---

### 5. Preparation Information in Inventory Search — Resolved

Resolved in business rule IN-011: Inventory search uses the immutable
Preparation Metadata preparation summary captured on the source Tray (ADR-0013)
and the current Package Label Display Name and ingredients/preparation
summary. It does not search a future Preparation Preset library; Preset
search and management remain Milestone 6.

---

### 6. Wireframe Consistency — Verified, no stale language found

`docs/wireframes/06-package-details.md` was re-reviewed against this
description. Its current Screen Layout already shows an Inventory History
timeline with movement entries (not listed as future work), its States
section already gates Move/Given Away/Depleted to In Storage only, and Given
Away/Depleted states are already documented as read-only history. No edit was
required there.

`docs/wireframes/05-inventory.md` did need an update: its Screen Layout,
Search, and Empty Search sections showed a flat Package list as the default
view, which contradicted Decision 7 below once Product grouping became the
default presentation. It has been updated to show Product groups by default,
with search or opening a group returning individual Packages, and its
searchable-fields list now matches business rule IN-011.

---

### 7. Product Grouping Contract — Resolved

Resolved in ADR-0018 (Inventory Product Grouping) and business rule IN-014:
Product grouping is the default Inventory presentation, exposed through the
derived read projection `GET /api/v1/inventory/products` (see
`09-api-design.md`). Product identity for grouping is the historical Product
name from the source Tray's Preparation Metadata snapshot, never the editable
Package Label Display Name, so relabeling a Package cannot silently create or
merge groups. Group counts and oldest/newest Packaging Date reflect only In
Storage Packages by default; Given Away and Depleted Packages are reachable
through historical Inventory search instead of a separate grouped historical
projection. No `InventoryProduct` or similar aggregate entity is persisted.

---

# Definition of Done

Milestone 5 is complete when:

* all blocking Open Decisions have been resolved in authoritative documentation
* operators can quickly determine whether a Product exists in Inventory
* operators can quickly determine where available food is stored
* operators can identify individual Packages within a Product
* Inventory is organized around finding and using food rather than administering records
* Product names are the primary discovery mechanism while Package identifiers remain available for traceability
* Package Status History is implemented without overwriting prior transitions
* Package creation automatically records initial In Storage status history
* status transitions preserve Effective Time, Recorded Time, and optional Notes
* Storage Locations can be created, edited, archived, and restored according to documented rules
* Unassigned remains protected
* Inventory defaults to In Storage Packages
* users can search and filter active and historical Packages according to a documented contract
* Product grouping behaves according to the documented presentation contract
* Package Details preserves complete Packaging, Production, storage, and status traceability
* In Storage Packages can be moved with atomic current-location and append-only history updates
* same-location and archived-destination moves are rejected without corrupting history
* users can explicitly mark Packages Given Away or Depleted
* terminal Packages cannot move or return to active Inventory
* terminal Packages remain historically searchable and viewable
* backend, frontend, and Playwright Milestone 5 tests pass
* lint, formatting, type checks, and production builds pass
* a real-backend Inventory smoke test passes
* no Milestone 6 or later functionality has been introduced

All Open Decisions are resolved as of this revision; see the Open Decisions section above for where each resolution is authoritatively documented.
