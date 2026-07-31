# Packaging Allocation

## Purpose

A Packaging Allocation is an identified child entity of a Packaging Operation.
It defines which completed Tray or Trays supply product for one or more Packages.

# Fields

| Field | Required | Editable while Open | Notes |
| --- | --- | --- | --- |
| id | Yes | No | Stable UUID |
| packagingOperationId | Yes | No | Owning aggregate root |
| notes | No | Yes | Optional context |
| createdAt | Yes | System | Record timestamp |
| updatedAt | Yes | System | Last update timestamp |

# Relationships

* An Allocation belongs to exactly one Packaging Operation.
* It references one or more completed Trays through Allocation Source Tray rows.
* It owns zero or more planned package rows.
* It owns zero or more recorded Packages.

An Allocation may exist with zero Packages. It never exists independently of its
Packaging Operation and is not managed as an aggregate root.

# Allocation Source Tray

| Field | Notes |
| --- | --- |
| packagingAllocationId | References the Allocation |
| trayId | References one completed Tray |

The combination is unique. A completed Tray may belong to only one active
Allocation. All source Trays must belong to the Operation's Production Batch and
must not already be consumed by a completed Packaging Allocation.

# Derived Weight

* Selected Source Weight = sum of source Tray Finished Product Weights.
* Allocated Weight = sum of recorded and planned Package Finished Product Weights.
* Remaining Weight = Selected Source Weight - Allocated Weight.

Remaining Weight is derived and is not persisted independently. Sealed Package
Weight does not participate in this calculation.
