# Packaging Operation

## Purpose

A Packaging Operation represents the act of converting one or more completed Trays into one or more sealed Packages.

Packaging Operations preserve the relationship between the source Trays and the resulting Packages.

Users do not directly manage Packaging Operations.

Instead, the system creates a Packaging Operation automatically whenever the user packages completed Trays.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| packagedAt | Yes | Yes* | Date and time the packaging occurred |
| notes | No | Yes | Optional packaging notes |

\* Corrections follow the Audit History model defined in ADR-0005.

---

# Relationships

A Packaging Operation:

- contains one or more completed Trays
- produces one or more Packages
- contains only Trays that are eligible to be packaged together

A Tray:

- may belong to zero or one Packaging Operation

A Package:

- belongs to exactly one Packaging Operation

---

# Persistence Model

The many-to-many relationship between Packaging Operations and Trays is implemented through an association table.

```text
PackagingOperation
        │
        ▼
PackagingOperationTray
        ▲
        │
      Tray
```

The association table contains:

| Field | Notes |
|--------|-------|
| packagingOperationId | References the Packaging Operation |
| trayId | References the Tray |

Each Tray may appear only once in the association table.

This guarantees that a Tray can participate in only one Packaging Operation while allowing a Packaging Operation to contain multiple Trays.

Packages do **not** reference Trays directly.

Instead, every Package references its Packaging Operation, which in turn references the source Trays.

This preserves complete production traceability while avoiding duplicate Tray-to-Package relationships.

The `PackagingOperationTray` association table is considered an implementation detail of the persistence layer rather than a first-class business entity.

A Package:

- belongs to exactly one Packaging Operation

---


# Historical Behavior

Packaging Operations are historical production records.

They preserve the exact relationship between:

- the source Trays
- the resulting Packages

Packaging Operations are never deleted.

---

# Lifecycle

Packaging Operations are created automatically when the user packages completed Trays.

Once created:

- additional Trays cannot be added
- existing Trays cannot be removed
- Packages remain permanently associated with the Packaging Operation

Corrections follow the Audit History model.

---

# Traceability

Packaging Operations preserve complete production traceability.

Example:

```text
Tray 1 ┐
Tray 2 ├── Packaging Operation ── Package A
Tray 3 ┤                         Package B
Tray 4 ┘                         Package C
```

This allows every Package to be traced back to every contributing Tray.

---

# Business Rules

PK-001

A Packaging Operation contains one or more completed Trays.

---

PK-002

Every Tray in a Packaging Operation must already be completed.

---

PK-003

A Tray may participate in only one Packaging Operation.

---

PK-004

A Packaging Operation produces one or more Packages.

---

PK-005

Every Package belongs to exactly one Packaging Operation.

---

PK-006

Once a Packaging Operation has been created, its source Trays cannot change.

---

PK-007

For Version 1, Trays selected for the same Packaging Operation must belong to the same Production Batch and Freeze Dryer.

The user decides which eligible Trays to package together.

The application should prevent cross-batch or cross-freeze-dryer packaging selections in Version 1.

---

PK-008

Packaging Operations preserve production traceability and are never deleted.

---

# Notes

Packaging Operations exist to preserve historical relationships.

Although users experience the workflow as "Package selected Trays," the system records a Packaging Operation internally to maintain complete traceability between production and inventory.

This separation keeps the user interface simple while preserving an accurate historical production record.
