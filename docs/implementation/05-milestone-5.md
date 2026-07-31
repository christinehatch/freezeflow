# Milestone 5 - Inventory

## Status

Planned - Documentation blockers remain.

Milestone 5 is not ready for implementation until the blocking Open Decisions in this document are resolved in the authoritative architecture and persistence documentation.

---

# Goal

Build the Inventory workflow for locating, reviewing, moving, and retiring finished Packages while preserving complete production and storage history.

Milestone 5 begins after Packaging has created Packages. It allows the user to answer where a Package is now, how it reached that Storage Location, and whether it remains available.

---

# Objectives

Implement:

* Storage Location setup and lifecycle management
* Package-level Inventory browsing
* Inventory search and filtering
* Package Details with production and Packaging traceability
* Package movement between Storage Locations
* append-only Storage Location History
* Package Status History and Inventory Status changes to Given Away or Depleted
* historical visibility for terminal Packages
* clear handling of the system-provided Unassigned Storage Location

---

# Scope

Milestone 5 includes:

* creating, viewing, editing, archiving, and restoring user-managed Storage Locations
* browsing Packages as Inventory
* searching and filtering Packages using documented Inventory information
* viewing current Package location and Inventory Status
* viewing Package, Package Label, Packaging, Tray, Production Batch, Freeze Dryer, Preparation Metadata, and Weight Check history when available
* moving an In Storage Package to another active Storage Location
* recording every Package movement as append-only Storage Location History
* marking an In Storage Package Given Away
* marking an In Storage Package Depleted
* excluding Given Away and Depleted Packages from the default active Inventory view
* retaining Given Away and Depleted Packages in historical search and Package Details

Inventory remains Package-based. Milestone 5 does not introduce remaining-quantity accounting inside a Package.

---

# Out of Scope

Do not include:

* partial Package consumption
* splitting or merging existing Packages
* reopening Given Away or Depleted Packages
* deleting Packages or production history
* Preparation Preset CRUD
* recipe archive or restore
* production reports or Inventory analytics
* corrections UI
* audit history UI
* automatic storage recommendations
* barcode or QR-code workflows
* Package movement in bulk unless separately documented
* sales, recipients, transfer destinations, or customer management for Given Away Packages

Preparation Preset management belongs to Milestone 6. Reports belong to Milestone 7. Corrections and Audit History belong to Milestone 8.

---

# Workflow Summary

1. The user opens Inventory.
2. The application displays Packages currently In Storage by default.
3. The user searches or filters Inventory to locate a Package.
4. The user opens Package Details to review its current state and complete traceability.
5. For an In Storage Package, the user may:
   * move it to a different active Storage Location
   * edit mutable Package notes where permitted by the documented lifecycle
   * mark it Given Away
   * mark it Depleted
6. A move atomically updates the Package's current Storage Location and appends a Storage Location History record.
7. Given Away and Depleted Packages leave the default active view but remain available in historical search and Package Details.

---

# Storage Locations

Storage Locations represent real places where Packages are stored, such as a bin, shelf, pantry, or cabinet.

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

Renaming a Storage Location changes its displayed name throughout the application. It does not represent Package movement and must not create a Storage Location History record.

Storage Location naming, uniqueness, and case-sensitivity rules require clarification before implementation.

---

# Inventory Browsing

Inventory is a Package search and discovery experience, not a Production workspace.

The default Inventory view should:

* return Packages, not Trays or aggregate product quantities
* show only Packages with Inventory Status In Storage
* show the current Storage Location
* make Product, Package identifier, Package Type, Package weight, Packaging date, and current status scannable
* provide a direct path to Package Details
* provide a clear empty state and load-failure state

Given Away and Depleted Packages should not appear in default active Inventory counts or results. Users must be able to include them when searching historical Inventory.

---

# Search and Filtering

Inventory search should support documented Package information, including:

* Package identifier
* Product
* preparation information
* immutable Preparation Metadata snapshot information
* Package notes
* Storage Location
* Inventory Status
* Package Type where available

Filters should allow users to narrow results by current Storage Location and Inventory Status. The default status filter is In Storage.

The documentation does not yet define:

* matching semantics, including partial and case-insensitive matching
* default sort order
* pagination or result limits
* how multiple search fields and filters combine
* whether archived Storage Locations appear as selectable filters by default
* the Preparation Metadata and Package Label fields used by Inventory search before Preparation Preset management is implemented

These behaviors must be documented before implementation rather than inferred in code.

---

# Package Details

Package Details should organize information by purpose so presentation data is not confused with immutable production history.

It should contain these sections:

1. Package
2. Package Label
3. Production History
4. Packaging
5. Inventory History

The Package Label section should show the editable human-facing label owned by the Package. Package Label editing and reprinting remain Milestone 4 behavior. Inventory may display Package Label fields for identification, but it must not use label edits to rewrite Production History.

Across those sections, Package Details should show:

* Package identifier
* Product and preparation snapshot
* Package Type
* Finished Product Weight
* Sealed Package Weight
* Packaging date and Package notes
* Oxygen absorber information
* current Inventory Status
* current Storage Location
* source Packaging Operation
* source Tray or Trays
* Production Batch and Freeze Dryer
* Starting Weight, Weight Checks, Final Dry Weight, and drying history
* Preparation Preset reference when one was used
* Storage Location History
* Package Status History

For an In Storage Package, Package Details should expose the permitted Inventory actions. Given Away and Depleted Packages are historical and must not expose actions that reopen or move them.

The preservation behavior for edits to mutable Package notes is not yet fully documented and is listed as an Open Decision.

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

An archived Storage Location cannot receive a Package. An In Storage Package already assigned to an archived Storage Location may be moved out to an active location.

Movement never changes Package production traceability or Inventory Status.

---

# Storage Location History

Storage Location History is append-only.

Every Package receives an initial Storage Location History record when Packaging creates it. The first record has no previous Storage Location and identifies the selected location or Unassigned as the current Storage Location.

Every later movement appends a new record. Existing history records are never edited or deleted.

The Package's current Storage Location must always match the current Storage Location on its latest history record.

Package Details should display the movement timeline in chronological order with previous location, new location, movement time, and notes when present.

---

# Package Status History

Package Status History is the append-only lifecycle record defined by ADR-0012 and `docs/persistence/15-package-status-history.md`.

Creating a Package automatically creates its initial In Storage Package Status History record. Every later transition atomically updates the Package's current Inventory Status and appends one history record.

Each record preserves:

* previous status, null for initial Package creation
* current status
* Effective Time supplied by the user or defaulted to the current time
* system-assigned Recorded Time
* optional Notes

Package Status History is never edited or deleted. Correction is not an Inventory Status and follows ADR-0005.

---

# Given Away

Given Away means the entire Package left active Inventory as a gift or transfer.

Rules:

* only an In Storage Package may become Given Away
* the transition is explicit and user-confirmed
* the entire Package becomes unavailable
* the Package is excluded from default active Inventory counts and results
* the Package remains searchable when historical statuses are included
* Package Details and all production traceability remain available
* the Package cannot be moved, depleted, returned to In Storage, or deleted

Milestone 5 records the status and historical transition. It does not manage recipients or transfers as separate domain entities.

---

# Depleted

Depleted means the entire Package has been consumed or is otherwise no longer available.

Rules:

* only an In Storage Package may become Depleted
* the transition is explicit and user-confirmed
* the entire Package becomes unavailable
* the Package is excluded from default active Inventory counts and results
* the Package remains searchable when historical statuses are included
* Package Details and all production traceability remain available
* the Package cannot be moved, given away, returned to In Storage, or deleted

Milestone 5 does not track partial Package consumption.

---

# Historical Visibility

Terminal Inventory states affect availability, not history.

Given Away and Depleted Packages must remain:

* persisted
* addressable by Package identifier
* searchable through an explicit historical-status filter
* visible in Package Details
* linked to Storage Location History
* linked to Packaging and Production history

Archiving a Storage Location must not hide or break Package movement history.

---

# Traceability

Every Inventory Package must remain traceable to:

* its Package identifier and Package Type
* its Packaging Operation
* its source Tray or Trays
* its Production Batch
* its Freeze Dryer
* Preparation Metadata and Preparation Preset information when available
* Starting Weight, Weight Checks, and Final Dry Weight
* current and historical Storage Locations
* current Inventory Status and Package Status History

Inventory actions must never rewrite Packaging or Production history.

---

# UI Expectations

The Inventory UI should:

* open as a focused search and browsing screen
* default to currently available Packages
* keep search and common filters immediately accessible
* show active, Given Away, and Depleted states clearly
* make the current Storage Location easy to scan
* preserve search context when returning from Package Details where practical
* use explicit confirmation for terminal status changes
* explain that Given Away and Depleted Packages remain in history
* prevent move controls from offering archived destinations
* display Storage Location History and Package Status History timelines on Package Details
* provide loading, empty, validation, confirmation, success, and failure states

Storage Location setup should be available without turning the Inventory screen into an administrative dashboard.

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
* retrieving Package Details with traceability
* retrieving Storage Location History
* retrieving Package Status History
* moving an In Storage Package
* marking an In Storage Package Given Away
* marking an In Storage Package Depleted

Commands must enforce lifecycle and Storage Location rules in backend business logic. The client must not be the only enforcement layer.

The existing API documentation describes list, move, search, Depleted, and Given Away capabilities, but it does not fully define Storage Location management, history retrieval, search contracts, or consistent versioned endpoint paths. Exact routes, request schemas, response schemas, validation errors, and pagination behavior must be documented before implementation.

---

# Persistence Expectations

Use the authoritative persistence model:

* Package stores one current Storage Location
* Package stores one current Inventory Status
* Package Status History records initial In Storage state and every later transition
* Package Status History is append-only
* Storage Location stores its current name, notes, and archive state
* Storage Location History records initial placement and every later move
* Storage Location History is append-only
* Unassigned is a protected system Storage Location

Moving a Package must occur in one transaction that updates the Package's current Storage Location and inserts its new Storage Location History record.

Terminal Inventory transitions must preserve the Package and all relationships.

Database constraints and indexes must enforce or support:

* exactly one current Storage Location per Package
* exactly one current Inventory Status per Package
* initial Package Status History creation
* most recently recorded Package Status History consistency
* latest Storage Location History consistency
* protected Unassigned behavior
* active destination validation
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
* Inventory actions never delete or alter production traceability

Storage Location name validation and Inventory search validation require the Open Decisions to be resolved.

---

# Testing Expectations

## Backend

Add tests for:

* Storage Location create, edit, archive, and restore
* protected Unassigned behavior
* assigning Packages to Unassigned during Packaging when no location is selected
* default Inventory results including only In Storage Packages
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
* search and filters
* historical-status inclusion
* Inventory load, empty, and error states
* Storage Location setup and archive states
* Package Details traceability and timelines
* move validation and confirmation
* Given Away confirmation and resulting historical state
* Depleted confirmation and resulting historical state
* terminal Package read-only behavior

## Browser E2E

Extend the reusable Playwright mock API and add user-flow tests for:

* locating a Package through Inventory search
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
* Storage Location backend workflows and frontend setup UI
* Inventory search and browsing API and page
* Package Details Inventory actions and history timelines
* Package movement with append-only Storage Location History
* Given Away and Depleted workflows
* backend business-rule tests
* frontend component tests
* Playwright Inventory workflow tests
* real-backend Inventory smoke-test notes
* documentation cleanup for stale Inventory and Storage Location wording

---

# Open Decisions

## Blocking

### 1. Inventory and Storage Location API contracts

The API documentation does not fully define versioned routes, request and response schemas, validation errors, history retrieval, or Storage Location create/edit/archive/restore behavior.

### 2. Inventory search contract

Matching behavior, field combination, default sorting, pagination, result limits, and archived-location filtering are not defined.

## Clarification Required

### 3. Storage Location naming rules

The documentation must define blank-name rejection, uniqueness, whitespace normalization, and case sensitivity.

### 4. Package notes corrections

The lifecycle documentation permits editing notes for In Storage Packages, but it does not define whether prior note values require append-only correction history before Milestone 8.

### 5. Preparation information in Inventory search

Inventory search includes immutable Preparation Metadata and Package Label
presentation fields. Preparation Preset management begins in Milestone 6.

### 6. Wireframe consistency

The Package Details wireframe both requires Storage Location history and lists the storage movement timeline as future work. It also needs consistent Given Away action placement. The stale language should be corrected before implementation.

---

# Definition of Done

Milestone 5 is complete when:

* all blocking Open Decisions have been resolved in authoritative documentation
* Package Status History is implemented without overwriting prior transitions
* Package creation automatically records initial In Storage status history
* status transitions preserve Effective Time, Recorded Time, and optional Notes
* Storage Locations can be created, edited, archived, and restored according to documented rules
* Unassigned remains protected
* Inventory defaults to In Storage Packages
* users can search and filter active and historical Packages according to a documented contract
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

Until the blocking Open Decisions are resolved, Milestone 5 cannot be implemented without inventing architecture.
