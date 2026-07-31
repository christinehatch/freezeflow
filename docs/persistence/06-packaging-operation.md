# Packaging Operation

## Purpose

A Packaging Operation is the aggregate root for one resumable Packaging
workspace belonging to a Production Batch.

# Fields

| Field | Required | Editable while Open | Notes |
| --- | --- | --- | --- |
| id | Yes | No | Stable UUID |
| productionBatchId | Yes | No | Parent Production Batch |
| status | Yes | Through actions | `Open` or `Completed` |
| startedAt | Yes | Yes | Effective time Packaging began |
| completedAt | No | No | Set by explicit completion |
| notes | No | Yes | Smart Notebook context |
| createdAt | Yes | System | Record timestamp |
| updatedAt | Yes | System | Last update timestamp |

# Relationships

* A Production Batch has zero or one Open Packaging Operation.
* A Packaging Operation belongs to exactly one Production Batch.
* A Packaging Operation owns zero or more Packaging Allocations.
* Packages are reached through their Packaging Allocation.

# Lifecycle

```text
Open -> Completed
```

An Open operation is editable and resumable. Completing it is an explicit user
action. After completion, changes follow the correction model in ADR-0005.
Packaging Operations are historical records and are never deleted.

# Constraints

* A database constraint or transactionally equivalent service rule prevents two
  Open Packaging Operations for one Production Batch.
* A Packaging Operation cannot complete with an incomplete Allocation, an
  unrecorded required Package, or nonzero Remaining Product Weight.
* Completion records `completedAt` atomically.

# Traceability

```text
Production Batch
  -> Packaging Operation
    -> Packaging Allocation
      -> source Trays
      -> Packages
```

The Operation is internal to the workspace. Users resume or complete Packaging;
they do not perform generic CRUD on Packaging Operations.
