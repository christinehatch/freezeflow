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

# Tray Endpoints

## Add Tray

```http
POST /api/production-batches/{id}/trays
```

Adds a Tray to a Production Batch.

The request may include a Recipe identifier.

When a Recipe is provided, the server copies the relevant Recipe information onto the Tray.

The copied preparation information becomes historical data for that Tray.

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

## Complete Tray

```http
POST /api/trays/{id}/complete
```

Marks a Tray as completed.

Validation:

* final dry weight required

---

# Weight Check Endpoints

## Record Weight Check

```http
POST /api/trays/{id}/weight-checks
```

Adds a Weight Check.

Historical checks remain unchanged.

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
/api/v1/
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
