# Weight Check

## Purpose

A Weight Check represents a single recorded weight observation for a Tray during the freeze-drying process.

Weight Checks allow users to monitor drying progress and determine when a Tray has reached its Final Dry Weight.

Weight Checks are historical observations.

---

# Fields

| Field | Required | Editable | Notes |
|--------|----------|----------|-------|
| id | Yes | No | Unique identifier |
| trayId | Yes | No | Parent Tray |
| weightGrams | Yes | Yes* | Recorded weight |
| observedAt | Yes | Yes* | When the weight was measured |
| recordedAt | Yes | No | When the Weight Check was entered into Freezeflow |
| notes | No | Yes | Optional observation notes |

\* Corrections follow the Audit History model defined in ADR-0005.

---

# Relationships

A Weight Check:

- belongs to exactly one Tray

A Tray:

- may have many Weight Checks

Weight Checks never belong directly to a Production Batch.

---

# Historical Behavior

Weight Checks preserve the drying history of a Tray.

Corrections update the current value while preserving the original value through Audit History.

Weight Checks are append-only historical observations.

---

# Observation Time

Each Weight Check records two timestamps.

**observedAt**

The date and time the weight was actually measured.

**recordedAt**

The date and time the Weight Check was entered into Freezeflow.

These values may be different.

Example:

Observation:

April 25
8:00 AM

Entry:

April 25
10:30 AM

Reports should use **observedAt**.

Audit history may use both timestamps when appropriate.

---

# Ordering

Weight Checks should be displayed chronologically.

The application should warn users if a newly entered Weight Check occurs before an existing observation.

Historical observations should never be silently reordered.

---

# Completion

Weight Checks may only be added while the parent Tray is actively drying.

Once a Tray has been completed:

- new Weight Checks cannot be created
- existing Weight Checks may only be corrected through Audit History

---

# Business Rules

WC-001

Every Weight Check belongs to exactly one Tray.

---

WC-002

Weight values are stored in grams.

---

WC-003

Weight Checks represent observations, not calculations.

---

WC-004

Every Weight Check records both:

- observedAt
- recordedAt

These timestamps may differ.
---

WC-005

Weight Checks cannot be added after the Tray has been completed.

---

WC-006

Corrections preserve the original value through Audit History.

---

WC-007

Reports use the corrected canonical value while preserving historical corrections.

---

# Notes

Weight Checks document the drying process over time.

They provide historical evidence of drying progress and support determining when a Tray has reached its Final Dry Weight.

Weight Checks are distinct from a Tray's Starting Weight and Final Dry Weight, which are recorded separately as part of the Tray's lifecycle.
