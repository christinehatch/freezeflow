# 05 - Inventory

# Purpose

The Inventory screen allows users to quickly locate finished Packages.

Unlike the Production workflow, which focuses on creating inventory, the Inventory screen focuses on finding inventory.

The primary goal is to answer questions such as:

* "Where is my chicken?"
* "Do I still have strawberries?"
* "Which bin contains Skittles?"
* "How many packages do I have left?"

Searching should be significantly faster than browsing.

---

# User Goals

A user should be able to:

* Browse Inventory by Product without searching first.
* Find a Package in seconds.
* Search by Package Label Display Name or product name.
* Search by preparation.
* Search by Storage Location.
* View package status.
* Open Package Details.
* Mark Packages as depleted.
* Mark Packages as given away.

---

# Primary Actions

* Browse Product groups
* Search Inventory
* Filter Inventory
* Open Package Details
* Move Package
* Mark Package Depleted
* Mark Package Given Away

---

# Screen Layout

Opening Inventory with no search shows Product groups, the default presentation defined by ADR-0018.

```text
+====================================================================================+
| Inventory                                                            Search        |
+====================================================================================+

Search

[ __________________________________________ ]

Filters

Status

[ In Storage v ]

Storage Location

[ All v ]

------------------------------------------------------------------------------

Chicken
8 Packages · Bin A, Bin C · Oldest May 3

Strawberries
4 Packages · Bin B · Oldest June 18

Skittles
1 Package · Bin C · Oldest May 14
```

Opening a Product group, or entering a search, shows the matching individual Packages:

```text
Chicken > 8 Packages

Package      Product             Weight     Location      Packaged

PKG-104      Taco Chicken        10.8 oz    Bin A         Apr 27

PKG-105      Taco Chicken        10.9 oz    Bin A         Apr 27

------------------------------------------------------------------------------

Showing 8 Packages
```

Each result remains traceable to its Product group; nothing about a Package's identity, storage, or history changes because of how it is grouped or displayed.

---

# Search

Search should be the primary interaction.

The search box should always remain visible.

Search performs case-insensitive partial matching and updates results as the user types. It matches:

* Product name
* Package identifier
* Package Label Display Name
* Package notes
* immutable Preparation Metadata preparation summary
* Storage Location name
* Package Type name

A search query and any active filters combine with AND.

Entering a search replaces the default Product-grouped view with matching individual Packages, sorted by Product name ascending, then Packaging Date oldest first within each Product.

---

# Filters

Filters should reduce the visible results without requiring complex searches.

Recommended filters:

* Status
* Storage Location
* Product

Future filters may include:

* Date Packaged
* Freeze Dryer
* Production Batch
* Preparation Preset

---

# Search Results

Each result should display:

* Package Identifier
* Package Label Display Name
* Product Name
* Package Weight
* Current Storage Location
* Packaging Date

Each result should be clickable.

Selecting a Package opens the Package Details screen.

---

# Inventory Status

By default, Inventory should display only Packages currently in storage.

Depleted Packages should remain searchable but should not appear in the default view.

Given Away Packages should remain searchable but should not appear in the default view.

Users may choose to include depleted or Given Away Packages.

---

# Empty Search

If no search text has been entered, display Product groups summarizing Packages currently In Storage (ADR-0018), not a flat Package list.

Users should not be required to search before browsing.

---

# No Results

```text
No Packages matched your search.

Try:

* different keywords

* removing filters

* searching by Product instead of Preparation Preset
```

---

# Error States

If Inventory cannot be loaded:

* Explain the issue.
* Preserve the current search text.
* Allow retry.

---

# Mobile Considerations

* Search bar remains pinned at the top.
* Filters collapse into a drawer.
* Search results become cards.
* Large touch targets for Package selection.

---

# Success Criteria

A user should be able to:

* Find any Package in under ten seconds.
* Search naturally using everyday language.
* Understand where a Package is stored.
* Open Package history with one tap.
* Locate food without needing to remember Production Batch numbers or Packaging dates.

---

# Future Enhancements

Future versions may include:

* Barcode search
* QR code scanning
* Voice search
* Saved searches
* Recently viewed Packages
* Inventory analytics
* Low inventory alerts
