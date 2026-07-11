# ADR-0011 - Package Types and Packaging Eligibility

# Status

Accepted

---

# Context

User research confirmed that Package Type is part of the real packaging workflow.

The user thinks in terms of package formats such as pint, quart, and 2 gallon bags.

The oxygen absorber used during packaging is usually determined by the package format.

User research also clarified that completed Trays should not be combined across different Freeze Dryers or different Production Batches in Version 1.

Although multiple Trays may contain the same product, the user treats Freeze Dryer and Production Batch context as meaningful production history.

---

# Decision

Freezeflow will model Package Type as a first-class setup record in the Packaging workflow.

A Package Type represents a reusable packaging format and may provide defaults such as oxygen absorber size and printable label template.

Packages reference the Package Type selected during packaging.

Package-level values, including oxygen absorber and sealed weight, remain editable and historical.

For Version 1, Trays selected for the same Packaging Operation must belong to the same Production Batch.

Because a Production Batch belongs to exactly one Freeze Dryer, this also prevents cross-freeze-dryer packaging.

The user may decide which eligible Trays should be packaged together, but Freezeflow should not offer cross-batch or cross-freeze-dryer combinations as normal Packaging selections.

---

# Alternatives Considered

## Store Package Type Only in Notes

Rejected.

Package Type drives repeated packaging behavior and oxygen absorber defaults.

Keeping it only in notes would prevent useful defaults and consistent inventory search.

## Infer Package Type From Package Weight

Rejected.

Package weight describes the finished sealed package, not the packaging format.

The same Package Type may contain different product weights.

## Allow Cross-Batch Tray Combining

Rejected for Version 1.

Even when products appear similar, the Production Batch and Freeze Dryer context are meaningful to the user.

Preventing cross-batch and cross-freeze-dryer combining preserves traceability and better matches the real workflow.

---

# Consequences

Packaging implementation must include Package Type setup or selection.

The Packaging workflow can suggest oxygen absorber values from Package Type while allowing user overrides.

Inventory can display and filter by package format in future UI.

Packaging selection logic is simpler and safer because eligible source Trays are constrained to one Production Batch and one Freeze Dryer.

Historical Packages preserve the selected Package Type and Package-level details even if the Package Type is later edited or archived.
