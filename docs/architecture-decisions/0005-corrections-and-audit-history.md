# ADR-0005 - Corrections and Audit History

# Status

Accepted

---

# Context

Production data is entered by humans.

Mistakes are inevitable.

Examples include:

* Incorrect Weight Checks
* Incorrect Starting Weight
* Incorrect Final Dry Weight
* Incorrect Package Weight
* Wrong Storage Location
* Typographical errors
* Incorrect notes

Freezeflow must allow users to correct mistakes while preserving historical integrity.

Without a consistent correction model, different parts of the application may implement corrections differently, resulting in inconsistent reports, unreliable history, and lost information.

---

# Decision

Historical records are never silently overwritten.

When a correction is made:

* the current value is updated
* the previous value is preserved
* the correction is recorded in audit history

Users always see the corrected value during normal use.

Historical values remain available through the audit history.

---

# Correction Principles

Corrections exist to improve accuracy.

They are **not** intended to erase history.

Every correction should answer three questions:

* What changed?
* When did it change?
* Why did it change?

Whenever practical, the application should also record who made the correction.

Although Version 1 is single-user, the audit model should support future multi-user expansion.

---

# Canonical Value

Each record has one current canonical value.

Example:

```text
Original Weight Check

8.2 oz

Corrected

8.0 oz
```

The application displays:

```text
8.0 oz
```

Reports, calculations, and comparisons always use the canonical value.

---

# Audit History

Every correction creates an audit entry.

Each audit entry records:

* Entity Type
* Entity Identifier
* Field Changed
* Previous Value
* New Value
* Reason (optional)
* Observation Time (if applicable)
* Correction Time

Future versions may also include:

* User
* Device
* Source

Audit entries are append-only.

Audit history cannot be edited.

---

# Correctable Records

Version 1 allows corrections to:

* Production Batch notes
* Tray notes
* Starting Weight
* Weight Checks
* Final Dry Weight
* Package Weight
* Storage Location
* Recipe information
* Package notes

Additional fields may become correctable in future versions.

---

# Non-Correctable Events

Certain historical events cannot be removed.

Examples:

* Packaging Operation creation
* Package creation
* Tray completion
* Package depletion

If these events were performed in error, the correction should be recorded as a new historical event rather than deleting the original.

---

# Reports

Reports always use the corrected canonical values.

Audit history exists for traceability, not reporting.

Users should not need to manually reconcile historical corrections.

---

# User Experience

Normal screens display only the current values.

Audit history is available when requested.

Example:

```text
Weight Check

Current

8.0 oz

View History

Originally entered:

8.2 oz

Corrected:

8.0 oz

Reason:

Scale misread.
```

The interface should remain simple for everyday use while providing complete transparency when needed.

---

# Observation Time vs Correction Time

Correcting a record does not change when the original observation occurred.

For example:

Observation

April 25
8:00 AM

Correction

April 26
3:15 PM

Reports should continue to use the original Observation Time.

Correction Time exists for historical traceability.

---

# Lifecycle Interaction

Corrections do not reverse lifecycle states.

Examples:

A completed Tray remains Completed.

A packaged Tray remains Packaged.

A depleted Package remains Depleted.

If an incorrect lifecycle action was performed, the correction should create a new historical event rather than pretending the original event never occurred.

---

# Historical Integrity

Freezeflow prioritizes historical integrity over convenience.

The application should never silently discard information that was previously recorded.

Historical corrections provide transparency while allowing users to maintain accurate production records.

---

# Future Considerations

Future versions may support:

* Viewing complete audit timelines
* Filtering audit history
* Correction approvals
* Multi-user attribution
* Bulk corrections
* Audit exports

These features extend the audit system without changing the correction model.

---

# Consequences

## Benefits

* Users can confidently correct mistakes.
* Historical transparency is preserved.
* Reports remain accurate.
* Audit history supports future compliance and multi-user features.
* Corrections are implemented consistently throughout the application.

---

## Tradeoffs

* Additional storage is required for audit history.
* Implementing corrections is more complex than simple updates.
* Users may occasionally need to consult audit history to understand previous values.

These tradeoffs are acceptable because preserving trustworthy historical production records is one of the primary goals of Freezeflow.
