# 09 - API Design

# Purpose

This document defines the public API used by Freezeflow.

The API is designed around user workflows rather than database tables.

Endpoints should represent meaningful business actions and preserve the terminology defined elsewhere in the project.

The API should remain predictable, RESTful, and easy to extend.

---

# Design Principles

## Workflow-Oriented

Endpoints should represent user actions.

Good examples:

* Create Production Batch
* Record Weight Check
* Start or Resume Packaging
* Search Inventory

Avoid exposing database implementation details.

---

## Stable Resource Identifiers

Every major entity should have a permanent unique identifier.

Examples:

* Production Batch
* Tray
* Package
* Preparation Preset
* Storage Location

Identifiers should never change.

Some internal entities may have stable identifiers without being exposed as top-level public API resources.

---

## Immutable History

Historical production data should never be modified in destructive ways.

Whenever practical:

* append new information
* preserve old information
* avoid overwriting history

---

## Predictable Responses

Responses should be consistent across the API.

Every successful response should include:

* resource identifier
* timestamps
* current status

Errors should provide meaningful messages.

---

# Production Batch Endpoints

## Create Production Batch

```http
POST /api/production-batches
```

Creates a new Production Batch.

The server may suggest or accept a Batch Number during Draft creation.

The user may edit the suggested Batch Number before the Draft is saved.

---

## List Production Batches

```http
GET /api/production-batches
```

Returns all Production Batches.

Supports:

* pagination
* sorting
* filtering

---

## Get Production Batch

```http
GET /api/production-batches/{id}
```

Returns:

* batch details
* trays
* status
* freeze dryer

---

## Update Production Batch

```http
PATCH /api/production-batches/{id}
```

Updates editable production information.

Historical records remain preserved.

---

## Start Production Batch

```http
POST /api/production-batches/{id}/start
```

Transitions a Draft Production Batch to the Running state.

### Behavior

When production starts:

* The Production Batch status becomes Running.
* `startedAt` is set to the provided actual start time, or the current timestamp if no start time is provided.
* Every Draft Tray in the Batch transitions to Running.
* The first Drying Run is created automatically.
* The first Drying Run records `startedAt`.

### Request

The request may include an optional `startedAt` value representing the actual production start time.

### Response

Returns the updated Production Batch.

### Validation

* The Production Batch must be in the Draft state.
* The Production Batch must contain at least one Tray.
* Every Tray in the Production Batch must have a Starting Weight.
* The assigned Freeze Dryer must not already have a Running Production Batch.
* The assigned Freeze Dryer must not be archived.
* The Production Batch cannot already be Running, Completed, or Cancelled.

If validation fails, the request returns an appropriate error response.

---

## Cancel Production Batch

```http
POST /api/production-batches/{id}/cancel
```

Transitions a Draft or Running Production Batch to the Cancelled state.

### Request

No request body is required.

### Response

Returns the updated Production Batch.

### Validation

* Completed Production Batches cannot be cancelled.
* Cancelled Production Batches cannot be cancelled again.

If validation fails, the request returns an appropriate error response.

---

## Complete Production Batch

```http
POST /api/production-batches/{id}/complete
```

Completes a Running Production Batch after every Tray has been completed.

### Behavior

When the Batch completes:

* The Production Batch status becomes Completed.
* `completedAt` is recorded.
* The Production Batch becomes a historical record ready for Packaging.

### Validation

* The Production Batch must be Running.
* Every Tray in the Production Batch must be Completed.
* There must be no Active Drying Run.
* Completed, Cancelled, or Draft Batches cannot be completed.

The system may show that the Batch is ready to complete, but completion requires this explicit user action.

---

# Drying Run Endpoints

Drying Run endpoints manage freeze dryer machine-cycle intervals within a Running Production Batch.

## Start Another Drying Run

```http
POST /api/production-batches/{id}/drying-runs
```

Starts another Drying Run for a Running Production Batch.

The first Drying Run is created automatically by Start Production Batch.

### Request

The request may include:

* `startedAt`, the actual time the freeze dryer cycle started
* optional notes

### Behavior

When another Drying Run starts:

* a new Drying Run is created
* `startedAt` is recorded
* the Drying Run status becomes Active

### Validation

* The Production Batch must be Running.
* No Active Drying Run may already exist for the Production Batch.
* At least one Tray in the Production Batch must still be Running.
* Every Running Tray must have a Weight Check for the most recently completed non-voided Drying Run.

Completed Trays are excluded from Weight Check requirements for later Drying Runs.

---

## Current Run Complete

```http
POST /api/drying-runs/{id}/complete
```

Marks the active Drying Run complete.

This action represents the freeze dryer cycle ending.

It does not complete any Tray or Production Batch.

### Request

The request may include:

* `endedAt`, the actual time the freeze dryer cycle ended
* optional notes

### Behavior

When Current Run Complete is recorded:

* the Drying Run records `endedAt`
* the Drying Run status becomes Complete
* Weight Checks may be recorded for Running Trays

### Validation

* The Drying Run must be Active.
* The parent Production Batch must be Running.
* A completed Drying Run cannot be completed again.

---

## Void Drying Run

```http
POST /api/drying-runs/{id}/void
```

Marks a mistaken Drying Run as Voided while preserving the historical record.

### Request

The request should include notes explaining why the Drying Run was voided.

### Behavior

Voided Drying Runs remain visible in history but are excluded from derived drying-time calculations.

---

## List Drying Runs

```http
GET /api/production-batches/{id}/drying-runs
```

Returns Drying Runs for a Production Batch in chronological order.

---

# Tray Endpoints

## Add Tray

```http
POST /api/production-batches/{id}/trays
```

Adds a Tray to a Production Batch.

The request identifies the Tray Slot and Physical Tray selected for that Production Batch, and always carries the actual `product_name`, `ingredients`, and `preparation_methods` to persist — whether the operator typed them manually or started from a Preparation Preset and edited some or all of the pre-filled values before saving.

The request may also include a `preparation_preset_id`. **A Preparation Preset is a template, never an authoritative source of record** (ADR-0013): when `preparation_preset_id` is provided, the server's only use for it is validating that the Preset exists and is not archived, and capturing the Preset's *current* name into `preparation_preset_name_at_use` for provenance. The server never overwrites the request's own `product_name`/`ingredients`/`preparation_methods` with the Preset's stored values — whatever was actually submitted becomes the Tray's immutable historical snapshot.

When `preparation_preset_id` is omitted, `product_name` is required, and at least one of `ingredients` or `preparation_methods` must be non-empty — not necessarily both. Sparse, asymmetric Preparation Metadata (an ingredient list with no distinct named method, or vice versa) is expected and fully supported, not a validation gap.

Trays created before Milestone 6 shipped carry their original freeform text in a deprecated, read-only `preparation` field instead of structured `ingredients`/`preparation_methods`; new Trays never write to it.

---

# Tray Slot Endpoints

Tray Slot endpoints manage Freeze Dryer capacity and slot labels.

## List Tray Slots

```http
GET /api/freeze-dryers/{id}/tray-slots
```

Returns the Tray Slots configured for a Freeze Dryer.

## Configure Tray Slots

```http
PUT /api/freeze-dryers/{id}/tray-slots
```

Updates the Tray Slot setup for a Freeze Dryer when allowed by business rules.

Historical Production Batches must remain traceable to the Tray Slots selected at the time of production.

---

# Physical Tray Endpoints

Physical Tray endpoints manage reusable removable trays owned by the user.

## Create Physical Tray

```http
POST /api/physical-trays
```

Creates a reusable Physical Tray.

## List Physical Trays

```http
GET /api/physical-trays
```

Returns Physical Trays available for production setup.

## Update Physical Tray

```http
PATCH /api/physical-trays/{id}
```

Updates editable Physical Tray setup information.

Historical Tray records remain preserved.

---

## Get Tray

```http
GET /api/trays/{id}
```

Returns:

* tray information
* production batch
* historical preparation information
* weight history
* package information (if packaged)

---

## Update Tray

```http
PATCH /api/trays/{id}
```

Updates the editable fields of a Tray.

### Request

Only editable Tray fields may be modified.

### Validation

* Only Draft Trays may be edited unless otherwise allowed by the business rules.
* Historical production information must be preserved.

### Response

Returns the updated Tray.

---

## Delete Tray

```http
DELETE /api/trays/{id}
```

Removes a Draft Tray from its Production Batch.

### Validation

* Only Draft Trays may be deleted.
* Running, Completed, Packaged, or Cancelled Trays cannot be deleted.

### Response

Returns a successful response with no body.

---

## Complete Tray

```http
POST /api/trays/{id}/complete
```

Marks a Tray as completed.

Validation:

* final dry weight required
* Tray must be Running
* The active Drying Run, if any, must not be in progress
* Completion is an explicit user action

---

# Weight Check Endpoints

## Record Weight Check

```http
POST /api/trays/{id}/weight-checks
```

Adds a Weight Check.

Historical checks remain unchanged.

### Request

The request includes:

* `dryingRunId`
* `weight`
* `observedAt`
* optional notes

`observedAt` is the time the Tray was weighed.

`recordedAt` is set by the server when the entry is saved.

### Validation

* The Tray must be Running.
* The Drying Run must belong to the same Production Batch as the Tray.
* The Drying Run must be Complete.
* The Drying Run must not be Voided.
* A Weight Check for the same Tray and Drying Run must not already exist.

---

## List Weight Checks

```http
GET /api/trays/{id}/weight-checks
```

Returns chronological weight history.

---

## Correct Weight Check

```http
POST /api/weight-checks/{id}/correct
```

Corrects the canonical weight for an existing Weight Check when the user entered
the wrong value or unit.

### Request

```json
{
  "weightGrams": 272.155,
  "reason": "Selected pounds instead of grams."
}
```

### Behavior

* The Weight Check keeps its original observation time and Drying Run relationship.
* The corrected weight becomes the current canonical value used by the application.
* The previous weight and corrected weight are preserved in an append-only Audit Entry.
* Correcting a Weight Check does not reverse Tray or Production Batch lifecycle states.

This action follows ADR-0005. It is a correction to an existing historical
observation, not the creation of another Weight Check.

---

# Packaging Endpoints

Packaging is a resumable workflow. A Packaging Operation is the aggregate root,
and the API exposes business actions within that workspace rather than generic
CRUD for its child entities.

## Start or Resume Packaging

```http
POST /api/v1/production-batches/{batchId}/packaging-operation
```

Returns the existing Open Packaging Operation for the Production Batch or
creates one when none exists. A Production Batch may have at most one Open
operation. A conflict is returned if the Batch is not Completed or another
request races to create a second Open operation.

```http
GET /api/v1/production-batches/{batchId}/packaging-operation
GET /api/v1/packaging-operations/{operationId}
```

The response includes operation status and notes, Allocations, source Trays,
planned Package rows, recorded Packages and Labels, and derived Selected,
Allocated, and Remaining Weight. Reloading this response restores all Open work.
The Batch-scoped GET returns `404 Not Found` when the Production Batch has no
Packaging Operation yet; callers may treat that response as the normal
Start Packaging state.

## Allocate Completed Trays

```http
POST /api/v1/packaging-operations/{operationId}/allocate-trays
```

Example request:

```json
{ "trayIds": ["tray-1", "tray-2", "tray-3"] }
```

Creates a Packaging Allocation with stable identity. Every Tray must be
Completed, belong to the operation's Production Batch, and not participate in
another active Allocation. The Allocation may initially contain no Packages.
Separate product combinations use separate Allocations.

```http
PATCH /api/v1/packaging-operations/{operationId}/allocations/{allocationId}
```

Updates source Tray selection, shared label defaults, planned Package rows, or
Allocation notes while the operation is Open. Removing a Tray is rejected when
doing so would make recorded Package Finished Product Weight exceed the selected
source weight.

The `planned_packages` array, when present, describes the Allocation's
complete set of *unrecorded* planned Package rows: a row with no `id` is
created, a row with an existing `id` is updated, and an existing unrecorded
row whose `id` is absent from the array is removed. Recorded rows — those
with a `recordedPackageId` — are immutable historical records and are
excluded from this reconciliation entirely. A recorded row is left untouched
whether the request includes or omits its `id`; it is never created, edited,
or removed through this endpoint.

## Record Packages

```http
POST /api/v1/packaging-operations/{operationId}/allocations/{allocationId}/packages
```

Records one or more Packages when the operator intentionally chooses to do so.
The API does not infer when a physical bag exists and does not require physical
tasks to occur in a prescribed order.

```json
{
  "packages": [
    {
      "packageTypeId": "package-type-1",
      "finishedProductWeightGrams": 240.0,
      "sealedPackageWeightGrams": 254.0,
      "oxygenAbsorber": "500cc",
      "storageLocationId": null,
      "packagedAt": "2026-07-18T14:30:00Z",
      "notes": "First bag",
      "label": {
        "displayName": "Martin's Taco Meal",
        "subtitle": "Chicken, cabbage, and salsa",
        "ingredientsSummary": "Chicken, cabbage, tomato, onion, cilantro",
        "preparationSummary": "Cubed and seasoned",
        "rehydrationInstructions": "Add 2 cups water",
        "servingNotes": "Two servings",
        "notes": null
      }
    }
  ]
}
```

The server generates identifiers, creates one Package Label per Package, and
appends initial In Storage Package Status History and Storage Location History.
Null storage resolves to Unassigned. Package facts and label presentation are
returned separately.

Validation:

* The operation must be Open and the Allocation must belong to it.
* Package Type must be active.
* Finished Product Weight and Sealed Package Weight must be positive.
* Total recorded Finished Product Weight may not exceed selected source weight.
* Sealed Package Weight never reduces Remaining Weight.
* Small sealed-weight differences may warn but do not block recording.
* Every Package Label requires a Display Name.

Package and label fields may be updated while the operation is Open. After
completion, changes use the Milestone 8 Corrections workflow.

## Record Packaging Loss

```http
POST /api/v1/packaging-operations/{operationId}/allocations/{allocationId}/losses
```

Records that a portion of an Allocation's Selected Source Weight will never
become a Package (ADR-0016). Reduces Remaining Weight the same way recording
a Package does, without modifying source Tray weights or existing Packages.

```json
{
  "weightGrams": 6.0,
  "reason": "Crumbs",
  "reasonDetail": null
}
```

`reason` is one of `Sampled`, `Spilled`, `Crumbs`, `Other`. `reasonDetail` is
optional free text, accepted only when `reason` is `Other`.

Validation:

* The operation must be Open and the Allocation must belong to it.
* Weight must be positive.
* Weight may not exceed the Allocation's current Remaining Weight.
* `reasonDetail` is rejected unless `reason` is `Other`.

Packaging Loss entries are append-only: no update or delete endpoint exists.
An incorrectly recorded entry is corrected under the Milestone 8 Corrections
workflow, the same as other Milestone 8 fields.

## Complete Packaging

```http
POST /api/v1/packaging-operations/{operationId}/complete
```

Explicitly completes the operation. Completion is rejected when any Allocation
has Remaining Weight, invalid planned work, or incomplete required Package or
Label information. On success, source Trays transition to Packaged and the
operation records `completedAt`. No remaining product is discarded; product
that will never become a Package must be recorded as Packaging Loss first.

## Get Package Label

```http
GET /api/v1/packages/{id}/label
```

Returns the Package's current Package Label plus the authoritative Package Identifier and Packaging Date used when rendering it.

## Update Package Label

```http
PATCH /api/v1/packages/{id}/label
```

Updates editable Package Label presentation fields and returns the updated
label. It does not modify Production History, Package facts, or inventory.
Editing printable content after a Print Event changes the label to Needs Reprint.

## Preview and Print Selected Labels

```http
POST /api/v1/package-labels/preview
POST /api/v1/package-labels/print
```

Both actions accept `packageLabelIds`. Selection may represent one Package, an
Allocation, an Operation, a Production Batch, today's Ready or Needs Reprint
labels, or a custom set. Printing operates on Labels, never Trays.

Preview returns label count and Avery 5163 pagination. Print returns the same
output and appends one Print Event per Label with `printedAt`, `printRequestId`,
and `Initial` or `Reprint`. Printed and Reprinted are events, not label states.
Printing does not alter Production History, Package status, or Storage Location.

Avery 5163 output uses Letter paper, two columns by five rows, and creates a new
sheet after every ten labels. Display Name and weight information are primary;
Package Identifier remains visible but secondary.

QR codes, barcodes, and automated label integrations are future enhancements.

---

## Package Types

```http
GET /api/v1/package-types
```

Returns active Package Types available during Packaging.

```http
POST /api/v1/package-types
```

Creates a reusable Package Type.

```http
PATCH /api/v1/package-types/{id}
```

Updates or archives a Package Type.

Historical Packages preserve the Package Type selected at packaging time.

Package Type defaults may include oxygen absorber and printable label template.

Package Types may be created or edited inline during Packaging.

---

## Get Package

```http
GET /api/v1/packages/{id}
```

Returns:

* package details
* source trays
* packaging history
* storage location
* inventory status

---

# Storage Location Endpoints

Storage Location management uses explicit CRUD-style endpoints for descriptive
fields plus explicit action endpoints for the archive/restore lifecycle
transitions, consistent with how Packaging Operation lifecycle transitions are
modeled.

## List Storage Locations

```http
GET /api/v1/storage-locations
```

Returns active and archived Storage Locations. Supports an `includeArchived`
query flag; omitted or `false` returns only active locations.

## Create Storage Location

```http
POST /api/v1/storage-locations
```

```json
{
  "name": "Bin A",
  "notes": "Top shelf, garage freezer"
}
```

### Validation

* `name` is required, is trimmed, and must not be blank after trimming.
* `name` must be case-insensitively unique across active and archived Storage
  Locations.
* `name` must not be `Unassigned`.

### Response

Returns the created Storage Location.

## Get Storage Location

```http
GET /api/v1/storage-locations/{id}
```

Returns Storage Location details, including whether it is archived.

## Update Storage Location

```http
PATCH /api/v1/storage-locations/{id}
```

Updates the Storage Location's mutable descriptive fields: `name` and `notes`.
It does not archive, restore, or otherwise change lifecycle state.

### Validation

* Same `name` rules as Create.
* `Unassigned` cannot be renamed.
* Renaming does not create a Storage Location History record (ADR-0006).

## Archive Storage Location

```http
POST /api/v1/storage-locations/{id}/archive
```

Transitions an active, user-managed Storage Location to archived. Archived
locations remain visible in historical records and cannot receive new
Packages, but Packages already assigned to them are unaffected until moved.

### Validation

* `Unassigned` cannot be archived.
* An already-archived Storage Location cannot be archived again.

## Restore Storage Location

```http
POST /api/v1/storage-locations/{id}/restore
```

Transitions an archived Storage Location back to active, making it eligible to
receive Packages again.

### Validation

* Only archived Storage Locations may be restored.
* Restoring is rejected if another active or archived Storage Location now
  shares the same case-insensitive name.

---

# Inventory Endpoints

Inventory endpoints are read-heavy and Package-centric. Storage and status
transitions use explicit action endpoints, matching the Packaging Operation
pattern rather than generic field-level PATCH semantics, because moving,
giving away, or depleting a Package is a domain transition rather than an
ordinary edit.

## Search Inventory

```http
GET /api/v1/inventory
```

Query parameters:

* `query` — free-text search. Case-insensitive partial match against Product
  name, Package identifier, Package Label Display Name, Package notes,
  immutable Preparation Metadata preparation summary, Storage Location name,
  and Package Type name. Leading and trailing whitespace is trimmed before
  matching.
* `status` — Inventory Status filter (`In Storage`, `Given Away`, `Depleted`).
  Defaults to `In Storage`. Pass an explicit historical status, or omit the
  default by requesting multiple values, to include terminal Packages.
* `storageLocationId` — restrict to one Storage Location, active or archived.
* `productName` — restrict to one Product's historical name.
* `packageTypeId` — restrict to one Package Type.
* `limit` — page size. Defaults to 50, maximum 100.
* `offset` — pagination offset. Defaults to 0.

`query` and every supplied filter combine with AND: a query match narrows
within the filtered set, it does not substitute for a missing filter.

### Response

Returns a page of Packages (the same shape as `GET /api/v1/packages/{id}`)
plus `meta.total`, `meta.limit`, and `meta.offset`.

### Default Behavior

With no parameters, returns In Storage Packages sorted by Product name
ascending, then by Packaging Date oldest first within each Product, so the
Package an operator should use first sorts first.

## Product Groups

```http
GET /api/v1/inventory/products
```

Returns the default Product-grouped Inventory presentation (ADR-0018). One
entry per Product:

```json
{
  "productName": "Chicken",
  "availablePackageCount": 8,
  "storageLocations": ["Bin A", "Bin C"],
  "oldestPackagedAt": "2026-05-03T00:00:00Z",
  "newestPackagedAt": "2026-07-18T00:00:00Z"
}
```

Product identity is the historical Product name from source Tray Preparation
Metadata, never the editable Package Label Display Name. Counts and dates
reflect only In Storage Packages by default; Given Away and Depleted Packages
are reachable through `GET /api/v1/inventory?status=...` instead of a separate
grouped historical projection. This is a derived read projection; no
`InventoryProduct` entity is persisted.

## Get Package Storage History

```http
GET /api/v1/packages/{id}/storage-history
```

Returns the Package's append-only Storage Location History (ADR-0006) ordered
by `movedAt`. Each item includes the previous Storage Location (null for the
initial placement), the new Storage Location, the movement time, and optional
notes.

## Move Package

```http
POST /api/v1/packages/{id}/move
```

```json
{
  "storageLocationId": "storage-location-2",
  "movedAt": "2026-07-21T10:42:00Z",
  "notes": "Consolidated into the garage freezer"
}
```

`movedAt` is optional and defaults to the current time. `notes` is optional.

### Behavior

Atomically updates the Package's current Storage Location and appends one
Storage Location History record in the same transaction.

### Validation

* Only an In Storage Package may move.
* The destination Storage Location must be active (not archived).
* The destination must differ from the Package's current Storage Location; a
  same-location request is rejected and creates no history record.
* A Package already assigned to an archived Storage Location may move out to
  an active destination.

## Mark Package Depleted

```http
POST /api/v1/packages/{id}/deplete
```

```json
{
  "effectiveAt": "2026-07-21T10:42:00Z",
  "notes": "Made soup"
}
```

`effectiveAt` is optional and defaults to the current time. `notes` is optional.

Atomically updates Inventory Status to Depleted and appends one Package Status History record.

Historical production information remains unchanged.

---

## Mark Package Given Away

```http
POST /api/v1/packages/{id}/give-away
```

```json
{
  "effectiveAt": "2026-07-21T10:42:00Z",
  "notes": "Gift for Mary"
}
```

`effectiveAt` is optional and defaults to the current time. `notes` is optional.

Atomically updates Inventory Status to Given Away and appends one Package Status History record.

Historical production information remains unchanged.

This workflow belongs to Milestone 5 Inventory, not Milestone 4 Packaging.

---

## Get Package Status History

```http
GET /api/v1/packages/{id}/status-history
```

Returns the Package's append-only Package Status History ordered by Effective Time and then Recorded Time.

Each item includes:

* previous status
* current status
* effective time
* recorded time
* optional notes

---

# Preparation Preset Endpoints

Preparation Preset management uses explicit CRUD-style endpoints for
descriptive fields plus explicit action endpoints for the archive/restore
lifecycle transitions, consistent with how Storage Location lifecycle
transitions are modeled.

Preparation Presets are optional data-entry conveniences, never historical
records (ADR-0013). Tray APIs accept one-off Ingredients and Preparation
Methods directly, without requiring a Preparation Preset to exist first.

## List Preparation Presets

```http
GET /api/v1/preparation-presets
```

Returns active and archived Preparation Presets. Supports an
`includeArchived` query flag; omitted or `false` returns only active Presets.

## Create Preparation Preset

```http
POST /api/v1/preparation-presets
```

```json
{
  "name": "Sliced Chicken Tacos",
  "product_name": "Chicken Breast",
  "ingredients": ["Salt", "Pepper", "Salsa"],
  "preparation_methods": ["Sliced", "Cooked"],
  "notes": null
}
```

### Validation

* `name` is required, is trimmed, and must not be blank after trimming.
* `name` must be case-insensitively unique across active and archived
  Preparation Presets.
* `product_name` is required.
* `ingredients` and `preparation_methods` are each optional lists of strings;
  a Preparation Preset may supply only one of the two, or both, or neither —
  sparse and asymmetric entry is expected, not a validation gap.

### Response

Returns the created Preparation Preset.

## Get Preparation Preset

```http
GET /api/v1/preparation-presets/{id}
```

Returns Preparation Preset details, including whether it is archived.

## Update Preparation Preset

```http
PATCH /api/v1/preparation-presets/{id}
```

Updates the Preparation Preset's mutable descriptive fields: `name`,
`product_name`, `ingredients`, `preparation_methods`, and `notes`. It does not
archive, restore, or otherwise change lifecycle state.

Historical Production Batches remain unaffected. Historical Trays that were
previously created from the Preparation Preset remain unaffected — a Tray's
Preparation Metadata is an immutable snapshot captured at Tray-creation time,
never a live reference to the Preset's current values (ADR-0013).

### Validation

* Same `name` rules as Create.

## Archive Preparation Preset

```http
POST /api/v1/preparation-presets/{id}/archive
```

Transitions an active Preparation Preset to archived. Archived Presets remain
visible on historical Trays that reference them but cannot be selected for
new Trays.

### Validation

* An already-archived Preparation Preset cannot be archived again.

## Restore Preparation Preset

```http
POST /api/v1/preparation-presets/{id}/restore
```

Transitions an archived Preparation Preset back to active, making it
selectable for new Trays again.

### Validation

* Only archived Preparation Presets may be restored.
* Restoring is rejected if another active or archived Preparation Preset now
  shares the same case-insensitive name.

## Preparation Preset Suggestions

```http
GET /api/v1/preparation-presets/suggestions?field=ingredients
GET /api/v1/preparation-presets/suggestions?field=preparation_methods
```

Returns the distinct set of previously-used values for the requested field,
scanned across **both** Preparation Presets and Trays — so a one-off value an
operator typed directly on a Tray (without ever saving a Preset) also
surfaces as a future suggestion, not just values saved on a Preset. Used to
power inline autocomplete while entering Ingredients or Preparation Methods;
typing a value not in the returned list is always allowed and does not
require creating a catalog record first.

---

# Freeze Dryer Endpoints

## List Freeze Dryers

```http
GET /api/freeze-dryers
```

---

## Create Freeze Dryer

```http
POST /api/freeze-dryers
```

---

## Update Freeze Dryer

```http
PATCH /api/freeze-dryers/{id}
```

---

# Reporting Endpoints

Reporting endpoints are read-only, derived views over historical production
data (ADR-0019). No report result is ever cached or persisted; every request
recomputes its answer directly from current historical records at query
time. Reports never become the source of truth, and editing a Preparation
Preset must never change a report that already reflects Trays created from
it — reports read each Tray's immutable Preparation Metadata snapshot
(`product_name`, `ingredients`, `preparation_methods`,
`preparation_preset_name_at_use`), never a live join to the current
Preparation Preset row.

Unless noted otherwise, every report scopes to completed production history:
Production Batches only contribute when `status` is `Completed`; Trays only
contribute when `status` is `Completed` or `Packaged`. Draft, Running, and
Cancelled Batches and Trays are excluded everywhere except Inventory
Summary, which includes Packages of every status.

## Common Filters

Every report endpoint accepts whichever subset of the following query
parameters is listed under it; parameters that don't apply to a given
report are ignored rather than rejected as an error.

* `date_from`, `date_to` — inclusive UTC date-range bounds. Applied to
  `completed_at` for Production Batch-level and Tray-level reports, and to
  `packaged_at` for Inventory Summary.
* `freeze_dryer_id` — restrict to one Freeze Dryer.
* `product_name` — restrict to one Product (exact match against the Tray's
  immutable `product_name`).
* `preparation_preset_id` — restrict to one Preparation Preset.
* `production_batch_id` — restrict to one Production Batch.

An unrecognized id (a non-existent `freeze_dryer_id`, `preparation_preset_id`,
or `production_batch_id`) is treated identically to "no matching data" and
returns an empty result, not a 404 — consistent with how Inventory search
behaves.

## Freeze Dryer Performance

```http
GET /api/v1/reports/freeze-dryer-performance
```

Applicable filters: `date_from`, `date_to`, `freeze_dryer_id`.

One entry per Freeze Dryer with at least one contributing Completed
Production Batch in range — a Freeze Dryer with none is omitted entirely,
not returned with zeroed fields.

```json
[
  {
    "freeze_dryer_id": "freeze-dryer-1",
    "freeze_dryer_name": "Black",
    "completed_production_batch_count": 82,
    "average_dry_time_seconds": 152280,
    "average_weight_loss_percent": 76.4,
    "average_time_to_completion_seconds": 165600
  }
]
```

* `average_dry_time_seconds` is the average, across contributing Batches, of
  each Batch's own total drying time (the sum of its non-voided Drying Run
  durations). It is averaged at the Batch level, not weighted by how many
  Trays a Batch contained — a 100-Tray Batch and a 10-Tray Batch each
  contribute one value to the average.
* `average_time_to_completion_seconds` is wall-clock `completed_at -
  started_at`, averaged the same way. It is computed and named separately
  from `average_dry_time_seconds` per business rule DR-012: Production
  Batch wall-clock duration must never be reported as drying time.
* `average_weight_loss_percent` is Tray-level
  (`(starting_weight_grams - final_dry_weight_grams) / starting_weight_grams`),
  averaged across every qualifying Tray in that Freeze Dryer's contributing
  Batches. Trays missing `starting_weight_grams` are excluded from this
  average; if every contributing Tray lacks it, the field is `null`, not `0`.

## Product History

```http
GET /api/v1/reports/product-history
```

Applicable filters: `date_from`, `date_to`, `product_name`.

One entry per distinct `product_name` with at least one qualifying Tray.

```json
[
  {
    "product_name": "Chicken",
    "times_produced": 14,
    "average_drying_time_seconds": 148200,
    "average_yield_percent": 27.8,
    "last_batch_completed_at": "2026-07-18T00:45:00Z"
  }
]
```

* `average_drying_time_seconds` averages the total drying time of every
  Production Batch that included at least one Tray of this Product. A Batch
  that dried two different Products simultaneously contributes its one
  shared duration to both Products' averages — a deliberate, documented
  choice, not accidental double-counting, since a mixed Batch genuinely has
  one shared duration.
* `average_yield_percent` is `final_dry_weight_grams / starting_weight_grams`
  per Tray, averaged. Trays with a null or zero `starting_weight_grams` are
  excluded from the average, not treated as zero yield.

## Preparation History

```http
GET /api/v1/reports/preparation-history
```

Applicable filters: `date_from`, `date_to`, `preparation_preset_id`.

Same shape as Product History, grouped by `preparation_preset_name_at_use`
instead of `product_name`:

```json
[
  {
    "preparation_preset_name": "Sliced Chicken Tacos",
    "used_preset": true,
    "times_used": 9,
    "average_drying_time_seconds": 151200,
    "average_yield_percent": 28.1,
    "last_used_completed_at": "2026-07-12T00:30:00Z"
  },
  {
    "preparation_preset_name": "No Preset",
    "used_preset": false,
    "times_used": 5,
    "average_drying_time_seconds": 144000,
    "average_yield_percent": 26.9,
    "last_used_completed_at": "2026-07-15T00:15:00Z"
  }
]
```

Trays with no Preparation Preset (free-typed Ingredients/Preparation
Methods, per ADR-0013's Core Principle) are grouped into their own row
rather than excluded — a user who mostly enters Preparation Metadata inline
would otherwise be invisible in this report. That row is distinguished by
`used_preset: false`, never by matching the display label against a literal
string, since a real Preparation Preset could itself be named "No Preset."

## Drying Time

```http
GET /api/v1/reports/drying-time
```

Applicable filters: `date_from`, `date_to`, `freeze_dryer_id`,
`production_batch_id`.

One entry per Completed Production Batch — the Batch-level detail that
Freeze Dryer Performance's per-machine averages roll up from.

```json
[
  {
    "production_batch_id": "batch-42",
    "batch_number": "Batch 042",
    "freeze_dryer_name": "Black",
    "completed_at": "2026-07-18T00:45:00Z",
    "total_drying_time_seconds": 151200,
    "drying_run_count": 2,
    "voided_drying_run_count": 1
  }
]
```

## Production History

```http
GET /api/v1/reports/production-history
```

Applicable filters: `date_from`, `date_to`, `freeze_dryer_id`,
`product_name`, `preparation_preset_id`, `preparation_preset_name`,
`production_batch_id`.

The general-purpose historical browse view — one entry per Completed
Production Batch, supporting every filter. Replaces the earlier unversioned
`/api/reports/production` stub, which predated this milestone's full report
set and was never implemented against.

`preparation_preset_name` narrows to Batches containing a Tray whose
immutable `preparation_preset_name_at_use` snapshot exactly matches the
given string — the same field Preparation History groups its own rows by.
It is deliberately name-based rather than ID-based: Preparation History's
rows have no Preset ID to filter by (by design, per ADR-0019/RP-005 — a
report never carries a live-joinable identity for a Preset), and matching
by the immutable snapshot name is the only way to guarantee this filter
returns exactly the Batches that produced a given Preparation History row's
aggregate, even in the edge case where a Preset was renamed and its old
name later reused by a different Preset.

```json
[
  {
    "production_batch_id": "batch-42",
    "batch_number": "Batch 042",
    "freeze_dryer_name": "Black",
    "completed_at": "2026-07-18T00:45:00Z",
    "tray_count": 4,
    "products": ["Chicken", "Apples"],
    "total_drying_time_seconds": 151200
  }
]
```

## Inventory Summary

```http
GET /api/v1/reports/inventory-summary
```

Applicable filters: `date_from`, `date_to`, `product_name`.

A single object, not a list — the only report scoped to Packages of every
Inventory Status rather than only completed production, since "how much
inventory have I produced" includes Packages that have since left storage.

```json
{
  "packages_in_storage": 42,
  "packages_given_away": 11,
  "packages_depleted": 30,
  "total_packaged_weight_grams": 123400,
  "total_dried_weight_grams": 118900,
  "most_common_products": [
    { "product_name": "Chicken", "package_count": 21 },
    { "product_name": "Strawberries", "package_count": 14 }
  ]
}
```

* `total_packaged_weight_grams` sums `finished_product_weight_grams` across
  every Package ever created, any status. `total_dried_weight_grams` sums
  `final_dry_weight_grams` across every qualifying Tray. **These two figures
  are intentionally not expected to match** — the gap represents dried
  product not yet packaged plus ordinary packaging weight differences, not
  an error.

## Product Names

```http
GET /api/v1/reports/product-names
```

Returns the distinct set of `product_name` values across qualifying Trays,
used to populate the Product filter's options. There is no `Product` entity
in the persistence model — `product_name` is a free-text column on both Tray
and Preparation Preset, with no normalization or uniqueness enforcement (a
Tray entered as "Chicken" and one entered as "chicken" are distinct values
here — a known, pre-existing limitation this milestone does not fix). The
Freeze Dryer, Preparation Preset, and Production Batch filters reuse the
existing `GET /freeze-dryers`, `GET /preparation-presets`, and
`GET /production-batches` list endpoints instead of a dedicated lookup.

---

# Common Response Format

Successful responses should follow a consistent structure.

```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```

Error responses should follow:

```json
{
  "success": false,
  "error": {
    "code": "TRAY_ALREADY_PACKAGED",
    "message": "The selected tray has already been packaged."
  }
}
```

---

# Versioning

The API should be versioned.

Initial version:

```
/api/v1/production-batches
/api/v1/trays
/api/v1/preparation-presets
```

Future breaking changes should create new API versions rather than modifying existing endpoints.

---

# Future API Expansion

Possible future endpoints include:

* QR code generation
* Server-managed printable label layouts, styles, and printer integrations
* Barcode scanning
* User management
* Cloud synchronization
* Mobile synchronization
* Batch import/export

Future endpoints should continue to follow the same workflow-oriented design philosophy.

---

# Developer Tool Endpoints

Developer Tool endpoints exist only when Freezeflow runs in the `development` or
`test` environment. They must not be registered in a production application.

Developer Tool responses use the common success response format and return the
action performed plus current entity counts. Scenario seeds replace the contents
of the connected development database so repeated runs remain deterministic and
internally consistent.

The basic demo endpoint is:

```text
POST /dev/demo/basic
```

It creates representative Freeze Dryers, Tray Slots, Physical Trays, Preparation Presets,
Production Batches, Drying Runs, Weight Checks, Packaging Operations, Package
Types, Packages, Storage Locations, Storage Location History, and inventory
states while preserving valid relationships and lifecycle states.

Additional development-only actions may provide empty, inventory, packaging,
weight-history, busy-day, random-batch, and edge-case scenarios. Reset and seed
actions are destructive and require an explicit user confirmation in the
Developer Tools interface.
