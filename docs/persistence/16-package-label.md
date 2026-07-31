# Package Label

## Purpose

A Package Label stores the current editable human-readable presentation for one
Package. It is separate from immutable Production History.

# Fields

| Field | Required | Editable | Notes |
| --- | --- | --- | --- |
| id | Yes | No | Stable UUID |
| packageId | Yes | No | Unique one-to-one relationship |
| status | Yes | Through actions | `Draft`, `Ready`, `Needs Reprint` |
| displayName | Yes | Yes | Primary label name |
| description | No | Yes | Optional subtitle or description |
| ingredientsSummary | No | Yes | Human-readable contents |
| preparationSummary | No | Yes | Preparation presentation |
| rehydrationInstructions | No | Yes | Optional guidance |
| servingNotes | No | Yes | Optional usage notes |
| netWeightDisplay | No | Yes | Presentation; Package weight remains authoritative |
| freshEquivalentDisplay | No | Yes | Human-readable derived equivalent |
| createdAt | Yes | System | Creation timestamp |
| updatedAt | Yes | System | Last edit timestamp |

Package Identifier and Packaging Date are rendered from their authoritative
records and are not duplicated as editable facts.

# Relationships

* Every recorded Package owns exactly one Package Label.
* Every Package Label belongs to exactly one Package.
* A Package Label owns zero or more Print Events.

The database enforces uniqueness on `packageId`.

# Behavior

Recording a Package creates its Package Label from durable draft work in the
planned package row. Editing a label that has been printed sets `Needs Reprint`.
Printing current content records a Print Event and leaves the label `Ready`.

Before Milestone 8, edits overwrite current presentation fields. They never
change source Trays, Weight Checks, Package weights, Package Identifier,
Packaging Date, Storage History, or Package Status History.
