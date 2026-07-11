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

* Find a Package in seconds.
* Search by product name.
* Search by preparation.
* Search by Storage Location.
* View package status.
* Open Package Details.
* Mark Packages as depleted.
* Mark Packages as given away.

---

# Primary Actions

* Search Inventory
* Filter Inventory
* Open Package Details
* Move Package
* Mark Package Depleted
* Mark Package Given Away

---

# Screen Layout

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

Product

[ All v ]

------------------------------------------------------------------------------

Search Results

Package      Product             Weight     Location      Packaged

PKG-104      Taco Chicken        10.8 oz    Bin A         Apr 27

PKG-105      Taco Chicken        10.9 oz    Bin A         Apr 27

PKG-201      Strawberries         5.2 oz    Pantry        May 02

PKG-320      Skittles            11.3 oz    Bin C         May 14

------------------------------------------------------------------------------

Showing 4 Packages
```

---

# Search

Search should be the primary interaction.

The search box should always remain visible.

Search should match:

* Product Name
* Preparation
* Recipe, if applicable
* Notes
* Storage Location

Search should update results as the user types.

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
* Recipe

---

# Search Results

Each result should display:

* Package Identifier
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

If no search text has been entered, display all Packages currently in storage.

Users should not be required to search before browsing.

---

# No Results

```text
No Packages matched your search.

Try:

* different keywords

* removing filters

* searching by Product instead of Recipe
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
