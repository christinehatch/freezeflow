# Audit Entry

## Purpose

An Audit Entry represents a historical record of a correction made to an existing entity.

Audit Entries preserve the original value whenever information is corrected, ensuring that historical production records remain transparent while allowing users to maintain accurate data.

Audit Entries support the correction model defined in ADR-0005.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| entityType | Yes | No | Type of entity being corrected |
| entityId | Yes | No | Identifier of the corrected entity |
| fieldName | Yes | No | Field that was corrected |
| previousValue | Yes | No | Original value |
| currentValue | Yes | No | Corrected value |
| observedAt | No | No | Original observation time, when applicable |
| correctedAt | Yes | No | Date and time the correction was made |
| reason | No | No | Optional explanation for the correction |

Future versions may also include:

- userId
- deviceId
- correctionSource

---

# Relationships

An Audit Entry belongs to exactly one logical entity.

Examples include:

- Tray
- Weight Check
- Drying Run
- Production Batch
- Package
- Package Label

Entities may have zero or more Audit Entries.

Audit Entries are never shared between entities.

Storage Location is a documented exception: it is correctable, per ADR-0005,
but through the Storage Movement history mechanism (ADR-0006), not through
Audit Entries. Moving a Package to its correct Storage Location already
preserves the previous location as a Storage Location History record, so no
Audit Entry is written for Storage Location corrections.

---

# API

```http
GET /api/v1/audit-entries?entityType={type}&entityId={id}
```

Returns every Audit Entry belonging to one entity, oldest first. Both query
parameters are required — there is no unscoped listing of every Audit Entry
in the system. See `docs/09-api-design.md`'s Corrections & Audit History
Endpoints section for the full request/response shape, and for every
correction endpoint that writes to this entity.

---

# Historical Behavior

Audit Entries preserve historical corrections.

Creating an Audit Entry does not replace or remove historical information.

Instead:

- the corrected entity stores the current canonical value
- the Audit Entry preserves the previous value

Audit Entries are append-only.

They are never edited or deleted.

---

# Canonical Values

Freezeflow always presents the corrected canonical value during normal use.

Audit Entries exist to explain how the current value was reached.

Reports, searches, and calculations always use the corrected canonical value.

---

# Corrections

Audit Entries are created whenever a supported field is corrected.

Examples include:

- Starting Weight
- Weight Check
- Final Dry Weight
- Drying Run startedAt
- Drying Run endedAt
- Package Weight
- Storage Location
- Product Name
- Preparation
- Notes

Not every field within the application is necessarily correctable.

Correctable fields are defined by the business rules and architecture documentation.

---

# Observation Time vs Correction Time

When applicable, Audit Entries distinguish between:

- Observation Time
- Correction Time

Example:

Observation

April 25
8:00 AM

Correction

April 26
3:15 PM

This preserves both the original production timeline and the correction history.

---

# Business Rules

AE-001

Audit Entries preserve historical corrections.

---

AE-002

Audit Entries are append-only.

---

AE-003

Audit Entries are never edited.

---

AE-004

Audit Entries are never deleted.

---

AE-005

Reports use corrected canonical values rather than historical values.

---

AE-006

Every Audit Entry belongs to exactly one logical entity.

---

AE-007

Corrections improve data accuracy without destroying historical transparency.

---

# Notes

Audit Entries exist to preserve trust in historical production records.

Users should normally interact only with the current canonical values.

Audit history is available when needed to understand what changed, when it changed, and why.

This separation keeps the application easy to use while ensuring that no historical information is silently lost.
