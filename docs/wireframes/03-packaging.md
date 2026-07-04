# 03 - Packaging

# Purpose

The Packaging screen guides the user through converting one or more completed Trays into one or more finished Packages.

Packaging should feel like a simple workflow rather than a data entry form.

The user selects completed Trays, creates one or more Packages, and stores them.

The system automatically creates the internal Packaging Operation required for complete historical traceability.

Users should never need to understand or manage Packaging Operations directly.

---

# User Goals

A user should be able to:

* See every completed Tray waiting to be packaged.
* Select compatible Trays.
* Select Package Types.
* Create one or more finished Packages.
* Record package weights.
* Assign Storage Locations.
* Complete packaging with minimal typing.

---

# Primary Actions

* Select Completed Trays
* Create Packages
* Assign Storage Locations
* Finish Packaging

---

# Screen Layout

```text
+====================================================================================+
| Packaging                                                                          |
+====================================================================================+

Completed Trays

[x] Tray 1   Taco Chicken      8.2 oz

[x] Tray 2   Taco Chicken      8.1 oz

[x] Tray 3   Taco Chicken      8.3 oz

[x] Tray 4   Taco Chicken      8.2 oz

------------------------------------------------------------------------------

Selected Trays

4 Trays

Total Dry Weight

32.8 oz

------------------------------------------------------------------------------

Packages

Package 1

Package Type

[ 1 qt Mylar v ]

Package Weight

[________]

Storage Location

[ Bin A v ]

--------------------------------------------------

Package 2

Package Weight

[________]

Storage Location

[ Bin A v ]

--------------------------------------------------

Package 3

Package Weight

[________]

Storage Location

[ Bin B v ]

--------------------------------------------------

[ + Add Another Package ]

------------------------------------------------------------------------------

Weight Summary

Source Weight

32.8 oz

Package Weight Total

32.5 oz

Difference

0.3 oz

Review before saving

------------------------------------------------------------------------------

[ Complete Packaging ]
```

---

# Information Priority

The screen should emphasize:

1. Source Trays
2. Total available product
3. Packages being created
4. Weight validation
5. Storage assignment

The workflow should feel linear and predictable.

---

# Tray Selection

Only Completed Trays should appear.

Running Trays should never be selectable.

Completed Trays should remain visible until they have been packaged.

Once packaged, they should disappear from this screen.

For Version 1, selectable Trays should be grouped by Production Batch and Freeze Dryer.

The user may select multiple eligible Trays from the same group.

The user should not be able to combine Trays from different Production Batches or different Freeze Dryers in one Packaging Operation.

---

# Package Creation

Users should be able to create any number of Packages.

Examples:

* 1 Tray -> 1 Package
* 4 Trays -> 1 Package
* 4 Trays -> 3 Packages
* 8 Trays -> 12 Packages

The interface should never assume a fixed relationship.

Each Package should have a Package Type.

Package Type should prefill sensible defaults, such as oxygen absorber size, while allowing the user to edit the Package-level value.

---

# Storage Assignment

Every Package should be assigned a Storage Location during creation.

The interface should default to the most recently used location when appropriate.

Users should be able to change the location for individual Packages.

---

# Weight Validation

The application should automatically compare:

Source Weight

vs

Total Package Weight

If the values differ significantly, display a warning.

Warnings should inform the user but should not block completion.

The user remains responsible for the final decision.

---

# Packaging Workflow

Typical workflow:

```text
Select Trays

Create Packages

Assign Storage Locations

Review Weight Difference

Complete Packaging
```

The user should remain on a single screen throughout the process.

---

# States

## No Completed Trays

```text
No Completed Trays are ready for Packaging.

Finish drying a Production Batch before creating Packages.
```

---

## Trays Selected

The Package editor becomes active.

---

## Validation Warning

Examples:

* Weight mismatch
* Missing Storage Location
* Empty Package Weight

Warnings should be easy to understand.

---

## Complete

Display confirmation.

Example:

```text
Packaging Complete

3 Packages created successfully.

[ View Inventory ]
```

---

# Empty State

```text
No Trays are currently waiting for Packaging.
```

---

# Error States

If packaging fails:

* Preserve all entered Package information.
* Explain the error.
* Allow retry without re-entering data.

---

# Mobile Considerations

* One Package editor per card.
* Large numeric inputs.
* Storage Location picker optimized for touch.
* Sticky Complete Packaging button.

---

# Success Criteria

A user should be able to:

* Select completed Trays quickly.
* Create multiple Packages without confusion.
* Understand how much product is being packaged.
* Notice unexpected weight differences immediately.
* Complete packaging without understanding internal Packaging Operations.

---

# Future Enhancements

Future versions may include:

* Automatic package numbering
* Label printing
* QR code generation
* Barcode support
* Suggested package sizes
* Smart Storage Location recommendations
* Bluetooth scale integration
* Packaging supply stock tracking
