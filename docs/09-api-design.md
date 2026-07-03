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
* Package Trays
* Search Inventory

Avoid exposing database implementation details.

---

## Stable Resource Identifiers

Every major entity should have a permanent unique identifier.

Examples:

* Production Batch
* Tray
* Package
* Recipe
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

The request may include a Recipe identifier.

When a Recipe is provided, the server copies the relevant Recipe information onto the Tray.

The copied preparation information becomes historical data for that Tray.

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

# Packaging Endpoints

## Package Trays

```http
POST /api/v1/packages
```

Packages one or more completed Trays.

The server creates the internal Packaging Operation, records the source Trays, and creates one or more Packages.

The request includes:

* selected trays
* package weights
* storage locations
* sealed weights
* oxygen absorber information
* notes

Example request:

```json
{
  "trayIds": ["tray1", "tray2", "tray3", "tray4"],
  "packages": [
    {
      "weight": 10.7,
      "oxygenAbsorber": "300cc",
      "storageLocationId": "storage-location-1"
    },
    {
      "weight": 10.6,
      "oxygenAbsorber": "300cc",
      "storageLocationId": "storage-location-1"
    },
    {
      "weight": 10.7,
      "oxygenAbsorber": "300cc",
      "storageLocationId": "storage-location-2"
    }
  ]
}
```

Business Rules determine whether the request is valid.

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
* recipe
* package
* storage location
* status

---

## Mark Package Depleted

```http
POST /api/packages/{id}/deplete
```

Updates Inventory Status.

Historical production information remains unchanged.

---

# Recipe Endpoints

## List Recipes

```http
GET /api/recipes
```

---

## Create Recipe

```http
POST /api/recipes
```

---

## Update Recipe

```http
PATCH /api/recipes/{id}
```

Historical Production Batches remain unaffected.

Historical Trays that were previously created from the Recipe remain unaffected.

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
/api/v1/recipes
```

Future breaking changes should create new API versions rather than modifying existing endpoints.

---

# Future API Expansion

Possible future endpoints include:

* QR code generation
* Label printing
* Barcode scanning
* User management
* Cloud synchronization
* Mobile synchronization
* Batch import/export

Future endpoints should continue to follow the same workflow-oriented design philosophy.
