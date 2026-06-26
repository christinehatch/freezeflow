# 08 - Recipes

# Purpose

The Recipes screen allows users to create and manage reusable preparation templates.

Recipes exist to reduce repetitive data entry during Production.

Recipes are optional.

Users should be able to create Trays without using a Recipe.

Editing a Recipe affects only future Production Batches.

Historical Production records always preserve the preparation information that existed when the Tray was created.

---

# User Goals

A user should be able to:

* Browse Recipes.
* Create new Recipes.
* Edit existing Recipes.
* Archive Recipes that are no longer used.
* Quickly find a Recipe when starting a Production Batch.

---

# Primary Actions

* Create Recipe
* Edit Recipe
* Archive Recipe
* Search Recipes

Recipes should remain simple and easy to maintain.

---

# Screen Layout

```text
+======================================================================================+
| Recipes                                                                              |
+======================================================================================+

Search

[ __________________________________________ ]

------------------------------------------------------------------------------

Recipes

Taco Chicken

Cubed chicken with taco seasoning.

Last Used: April 27, 2026

--------------------------------------------------

Garlic Chicken

Cubed chicken with garlic seasoning.

Last Used: May 2, 2026

--------------------------------------------------

Strawberries

Fresh strawberries sliced in half.

Last Used: May 10, 2026

--------------------------------------------------

Skittles

Original Skittles.

Last Used: May 18, 2026

------------------------------------------------------------------------------

[ + New Recipe ]
```

---

# Recipe Detail

Selecting a Recipe opens the Recipe Detail screen.

```text
Recipe Name

Taco Chicken

--------------------------------------

Product Name

Chicken

--------------------------------------

Preparation

* Cube into 1-inch pieces

* Toss with taco seasoning

* Freeze overnight

--------------------------------------

Notes

_____________________________________

--------------------------------------

Last Used

April 27, 2026

--------------------------------------

[ Save ]

[ Archive ]
```

---

# Information Priority

Recipes should emphasize preparation instructions.

Historical production information belongs to Production and Tray Details, not Recipes.

---

# Recipe Fields

A Recipe may include:

* Recipe Name
* Product Name
* Preparation Instructions
* Notes

Recipes intentionally avoid production-specific information such as:

* Starting Weight
* Final Dry Weight
* Weight Checks
* Freeze Dryer
* Storage Location

These values belong to Production records.

---

# Search

Users should be able to search Recipes by:

* Recipe Name
* Product Name
* Preparation text

Search should update results as the user types.

---

# Archive

Recipes should never be permanently deleted.

Archived Recipes:

* no longer appear in normal selection lists
* remain associated with historical Production records
* can be restored if needed

---

# States

## Normal

Recipes are available for selection during Production.

---

## Empty

```text
No Recipes have been created yet.

Recipes are optional.

You can create a Production Batch without a Recipe.

[ Create Recipe ]
```

---

## Archived

Archived Recipes remain viewable but cannot be selected for new Production unless restored.

---

# Error States

If Recipes cannot be loaded:

* Explain the issue clearly.
* Preserve the current search text.
* Allow retry.

---

# Mobile Considerations

* Display Recipes as cards.
* Keep Search pinned at the top.
* Large touch targets.
* Easy scrolling.

---

# Success Criteria

A user should be able to:

* Find a Recipe in under ten seconds.
* Create a new Recipe in under two minutes.
* Reuse Recipes without affecting historical Production.
* Understand that Recipes are templates rather than historical records.

---

# Future Enhancements

Future versions may include:

* Recipe categories
* Favorite Recipes
* Recipe duplication
* Photos
* Ingredient lists
* Tags
* Import / Export
* Suggested Recipes based on previous Production
