# ADR-0007 - Package Inventory Granularity

# Status

Accepted

---

# Context

Inventory systems can track products at many levels of detail.

Examples include:

* Individual items
* Partial quantities
* Remaining weight
* Opened containers
* Mixed inventory

Freezeflow is designed around sealed freeze-dried Packages.

The application should accurately represent the user's physical inventory while remaining simple to use.

This ADR defines the inventory granularity supported by Version 1.

---

# Decision

Version 1 tracks inventory at the **Package** level.

A Package is the smallest inventory unit managed by Freezeflow.

Each Package has one inventory status.

Version 1 does not track inventory within a Package.

---

# Package States

A Package is either:

* In Storage
* Given Away
* Depleted

When a Package is marked Depleted, the entire Package is considered unavailable.

When a Package is marked Given Away, the entire Package is considered to have left the user's inventory as a gift or transfer.

The Package remains part of the historical record.

---

# Partial Usage

Version 1 does not support partial Package consumption.

Examples not supported:

* Half-used Package
* Remaining ounces
* Opened Package
* Multiple uses from one Package

Users should continue treating the physical Package as a single inventory item.

---

# Package Splitting

Version 1 does not support splitting a Package after it has been created.

A Package always represents one sealed unit.

If the user wants multiple Packages, they should create them during the Packaging workflow.

---

# Package Merging

Version 1 does not support combining existing Packages.

Packages remain independent throughout their lifecycle.

Historical traceability is preserved by leaving each Package unchanged.

---

# Inventory Search

Inventory searches return Packages.

Users search for products, but the search results represent individual Packages.

Example:

```text
Search:

Chicken

Results:

Package A

Package B

Package C
```

Each Package remains independently traceable.

This is the search result shape. The default *browsing* presentation before a search begins groups these same Packages by Product; see ADR-0018 for how that grouping is derived without changing the granularity defined here.

---

# Historical Integrity

Marking a Package Depleted or Given Away does not remove it from the system.

Historical Packages remain available for:

* Reports
* Traceability
* Audit History
* Production History

Inventory status affects availability, not history.

---

# User Experience

The inventory model should remain simple.

Users answer one question:

"Do I still have this Package?"

The application should not require users to estimate remaining quantities or track partially consumed Packages.

---

# Future Considerations

Future versions may introduce additional inventory states.

Examples:

```text
In Storage
    |
    v
Opened
    |
    v
Empty
```

or

```text
Remaining Quantity

100%
    |
    v
65%
    |
    v
20%
    |
    v
Empty
```

These features represent new inventory capabilities and should not change the Version 1 inventory model.

---

# Consequences

## Benefits

* Extremely simple inventory management.
* Minimal user effort.
* Clear search results.
* Strong historical traceability.
* Straightforward reporting.
* Simpler implementation.

---

## Tradeoffs

* Users cannot track partially used Packages.
* Remaining quantities are not recorded.
* Inventory counts represent Packages rather than remaining food.

These tradeoffs are acceptable because Freezeflow prioritizes production traceability and ease of use over detailed pantry management.
