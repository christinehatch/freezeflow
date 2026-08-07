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

The request identifies the Tray Slot and Physical Tray selected for that Production Batch.

The request may include a Preparation Preset identifier.

When a Preparation Preset is provided, the server copies its Product, Ingredients, Preparation Methods, and Notes onto the Tray.

The copied Preparation Metadata becomes the immutable historical snapshot for that Tray. The same fields may be entered inline without a preset.

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

# Storage Endpoints

## List Storage Locations

```http
GET /api/storage-locations
```

Returns all storage locations.

---

## Move Package

```http
POST /api/packages/{id}/move
```

Moves a Package to a different storage location.

---

# Inventory Endpoints

## Search Inventory

```http
GET /api/inventory
```

Supports searching by:

* product
* product or Preparation Metadata
* package
* storage location
* status

---

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

## List Preparation Presets

```http
GET /api/preparation-presets
```

## Create Preparation Preset

```http
POST /api/preparation-presets
```

## Update Preparation Preset

```http
PATCH /api/preparation-presets/{id}
```

Historical Production Batches remain unaffected.

Historical Trays that were previously created from the Preparation Preset remain unaffected.

Preparation Presets are optional. Tray APIs accept one-off Ingredients and Preparation Methods without requiring preset creation.

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

## Production Summary

```http
GET /api/reports/production
```

---

## Freeze Dryer Performance

```http
GET /api/reports/freeze-dryers
```

---

## Product Statistics

```http
GET /api/reports/products
```

---

## Inventory Summary

```http
GET /api/reports/inventory
```

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
