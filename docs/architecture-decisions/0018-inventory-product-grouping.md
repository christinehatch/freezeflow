# ADR-0018 - Inventory Product Grouping

# Status

Accepted

---

# Context

ADR-0007 establishes that Freezeflow tracks inventory at the Package level and that Inventory searches return Packages.

Operators, however, think in terms of food rather than Package identifiers. Milestone 5's Inventory Philosophy states that an operator is more likely to think "Where is my taco chicken?" than "Where is Package PKG-2026-000184?"

Presenting a flat list of Packages does not answer that question quickly when many Packages of the same Product exist. Freezeflow needs a defined way to present Package-level inventory as Product-focused results without introducing a second source of truth for quantity or location.

---

# Decision

Product grouping is the **default Inventory presentation**.

Opening Inventory shows Product groups first. Selecting a group expands or opens its individual Packages, each of which remains independently identifiable, movable, and depletable.

Product grouping is a **derived presentation over Package data**, exposed through a dedicated read projection endpoint. It does not introduce an `InventoryProduct` or similar independently persisted aggregate entity. Nothing about a Package's storage, identity, or history changes because of how it is grouped for display.

```http
GET /api/v1/inventory/products
```

returns one entry per Product with:

* `productName`
* `availablePackageCount`
* `storageLocations` (distinct locations holding an available Package)
* `oldestPackagedAt`
* `newestPackagedAt`

See `09-api-design.md` for the complete request and response contract.

---

# Product Identity

Product grouping uses the **historical Product name** captured on the source Tray's Preparation Metadata snapshot (ADR-0013), never the editable Package Label Display Name.

Package Label Display Name is presentation data the operator may freely rewrite, for example changing "Taco Chicken" to "Hudson's Taco Chicken." Using it for grouping would let a label edit silently split or merge Inventory groups. Using the immutable Product name keeps grouping stable regardless of how a Package's label is later edited.

For a Packaging Allocation with multiple source Trays of the same Product, the Product name is unambiguous. Mixed-product Allocations are out of scope for this decision; Milestone 4 already produces one Display Name per Package independent of grouping.

---

# Group Membership and Totals

By default, group counts, `storageLocations`, and `oldestPackagedAt`/`newestPackagedAt` include only **In Storage** Packages.

Given Away and Depleted Packages are excluded from default group totals. They remain available through the existing historical-status Inventory search (`GET /api/v1/inventory?status=...`), and their individual Package Details always remain reachable. Milestone 5 does not require a separate historical group-count projection; an operator who wants Given Away or Depleted counts uses the flat historical search.

`oldestPackagedAt` and `newestPackagedAt` are computed from `Package.packagedAt` among the Packages included in that view (In Storage by default), matching the oldest-first usage guidance in the Milestone 5 implementation doc.

---

# Search Interaction

A free-text or filtered Inventory search (`GET /api/v1/inventory`) continues to return individual Packages, consistent with ADR-0007. Product grouping is the *default browsing view* shown before a search begins; once the operator searches or filters, results may be presented as matching Packages within their Product groups, or as a flat Package list, at the frontend's discretion, provided every result remains traceable to its owning Product group.

---

# Consequences

## Benefits

* Matches how operators actually think about their food.
* No new aggregate entity to keep synchronized with Package state.
* Grouping is immune to Package Label edits.
* `GET /api/v1/inventory/products` lets the frontend render group summaries without downloading and reconstructing groups from every Package.

## Tradeoffs

* The backend must compute grouped aggregates on read rather than reading a precomputed table. This is acceptable at household scale (ADR-0007's granularity decision already assumes a small number of Packages).
* Two related read endpoints exist (`/inventory` and `/inventory/products`) rather than one; each has a distinct, documented purpose.

These tradeoffs are acceptable because they preserve Package-level history as the single source of truth while still giving operators a fast, Product-focused way to browse.
