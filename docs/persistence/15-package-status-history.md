# Package Status History

## Purpose

A Package Status History record represents one Inventory lifecycle event for a Package.

Package Status History preserves when a Package entered Inventory and when it later became Given Away or Depleted while allowing the Package itself to store one current Inventory Status.

Package Status History records are append-only and are never deleted.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| packageId | Yes | No | Package whose status changed |
| previousStatus | No | No | Previous Inventory Status; null for initial Package creation |
| currentStatus | Yes | No | Inventory Status established by this event |
| effectiveAt | Yes | No | Actual date and time the event occurred; supplied at creation or defaulted to the current time |
| recordedAt | Yes | No | System-assigned date and time the event was recorded |
| notes | No | No | Optional contextual notes supplied with the event |

Corrections follow ADR-0005 and never overwrite a Package Status History record.

---

# Relationships

A Package Status History record:

* belongs to exactly one Package

A Package:

* has many Package Status History records
* stores one current Inventory Status

---

# Initial Status

Creating a Package automatically creates its initial Package Status History record.

For the initial record:

* previousStatus is null
* currentStatus is In Storage
* effectiveAt equals the Package's `packagedAt`
* recordedAt is assigned by the system when the record is inserted
* notes may be null

Package creation, initial Storage Location History creation, and initial Package Status History creation occur in the same transaction.

---

# Status Transitions

Only the lifecycle transitions defined in ADR-0004 are valid:

* In Storage to Given Away
* In Storage to Depleted

For each successful transition:

* the Package's current Inventory Status is updated
* one Package Status History record is appended
* effectiveAt is supplied by the user or defaults to the current time
* recordedAt is assigned by the system
* optional Notes are preserved

The Package update and history insertion occur in the same transaction.

Given Away and Depleted are terminal. Milestone 5 does not support reopening a terminal Package.

---

# Historical Behavior

Package Status History records are immutable.

They are never edited or deleted.

Backdated Effective Times do not change Recorded Times.

Package Details orders the lifecycle timeline by Effective Time, with Recorded Time as a stable tie-breaker.

The Package's current Inventory Status must match the currentStatus established by its most recently recorded valid Package Status History event.

---

# Business Rules

PSH-001

Every Package Status History record belongs to exactly one Package.

---

PSH-002

Every Package receives an initial In Storage Package Status History record when it is created.

---

PSH-003

The initial Package Status History record has no previousStatus.

---

PSH-004

Package Status History records are append-only and cannot be edited or deleted.

---

PSH-005

Only an In Storage Package may transition to Given Away or Depleted.

---

PSH-006

Given Away and Depleted are terminal Inventory Status values.

---

PSH-007

Every successful status transition atomically updates the Package's current Inventory Status and appends exactly one Package Status History record.

---

PSH-008

The Effective Time records when the real-world event occurred. The Recorded Time records when Freezeflow received it.

---

PSH-009

Optional Notes provide context and do not create separate Recipient, Gift, Consumption, or Disposal records.

---

PSH-010

Correction is not an Inventory Status. Corrections follow ADR-0005 and preserve prior Package Status History.

---

# Notes

The Package represents current Inventory state.

Package Status History explains how the Package reached that state.

This mirrors the relationship between a Package's current Storage Location and its append-only Storage Location History.
