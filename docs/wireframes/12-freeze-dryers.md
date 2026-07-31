# 12 - Freeze Dryers

# Purpose

The Freeze Dryer screen manages the physical freeze dryers available for production.

Freeze Dryers are long-lived resources.

They exist independently of any individual Production Batch.

The purpose of this screen is to allow users to create, edit, archive, and view Freeze Dryers before using them in Production.

A Freeze Dryer may have at most one Running Production Batch at a time.

This screen also provides setup access for Freeze Dryer Tray Slots and reusable Physical Trays.

---

# User Goals

A user should be able to:

* View all Freeze Dryers.
* Create a new Freeze Dryer.
* Edit Freeze Dryer information.
* Configure the number of Tray Slots for each Freeze Dryer.
* Configure reusable Physical Trays available for production.
* Archive Freeze Dryers that are no longer in use.
* Quickly identify whether a Freeze Dryer is currently running a Production Batch.

---

# Screen Layout

```text
+---------------------------------------------------------------+
|                       Freeze Dryers                           |
+---------------------------------------------------------------+

[ + New Freeze Dryer ]

---------------------------------------------------------------

+-----------------------------------------------------------+
| Harvest Right Large                                       |
|-----------------------------------------------------------|
| Status: Running                                           |
| Active Batch: Chicken Batch                               |
|                                                           |
| [ Open Current Batch ] [ Edit ]                           |
+-----------------------------------------------------------+

+-----------------------------------------------------------+
| Harvest Right Medium                                      |
|-----------------------------------------------------------|
| Status: Idle                                              |
| No Active Production Batch                                |
|                                                           |
| [ Create Production Batch ] [ Edit ]                      |
+-----------------------------------------------------------+

---------------------------------------------------------------

Archived Freeze Dryers

Harvest Right Small

[ Restore ]

```

---

# Information Displayed

Each Freeze Dryer card should display:

* Name
* Current status
* Active Production Batch, if one exists
* Primary action

The screen should avoid displaying historical statistics.

Those belong in Reports.

---

# Primary Actions

Users should be able to:

* Create Freeze Dryer
* Edit Freeze Dryer
* Archive Freeze Dryer
* Configure Tray Slots
* Configure Physical Trays
* Open Current Production Batch
* Create Production Batch

---

# Create Freeze Dryer

Required fields:

* Name
* Tray Slot count

Optional fields:

* Notes

The application should prevent duplicate names.

---

# Edit Freeze Dryer

Users may edit:

* Name
* Notes
* Tray Slot configuration, before production depends on it

Changes affect future Production Batches only.

Historical Production Batches preserve the Freeze Dryer relationship.

Historical Production Batches also preserve the Tray Slots and Physical Trays selected at the time of production.

---

# Physical Tray Setup

Reusable Physical Trays are configured from the Freeze Dryer setup area so production setup happens in one place.

Physical Trays do not belong permanently to a Freeze Dryer.

Example:

```text
Physical Trays

Tray 1
Tray 2
Tray 3
...
Tray 12

[ + Add Physical Tray ]
```

The user may own more Physical Trays than any single Freeze Dryer can hold.

For example, a Freeze Dryer may have four Tray Slots while the user owns twelve Physical Trays.

---

# Create Production Batch From Freeze Dryer

When a user creates a Production Batch from an idle Freeze Dryer:

* the Freeze Dryer is preselected
* the system suggests the next Batch Number
* the user can edit the suggested Batch Number before saving
* the Draft Production Batch shows the Freeze Dryer's Tray Slots
* the user selects which Physical Tray is placed in each Tray Slot
* the user records Product, Ingredients, Preparation Methods, and Notes for each selected tray
* the user may apply an optional Preparation Preset to preload those fields

The user-facing action should remain focused on starting the production workflow, not on database records.

Recommended label:

```text
Create Production Batch
```

Within the Draft Production Batch workspace, use:

```text
Select Trays Used
```

---

# Archive Freeze Dryer

Users may archive a Freeze Dryer that is no longer in service.

Archived Freeze Dryers:

* cannot be selected when creating a new Production Batch
* cannot be used to start production on a Draft Production Batch
* remain associated with historical Production Batches
* may be restored later

A Freeze Dryer with a Running Production Batch:

* is considered Running on the Dashboard and Freeze Dryers screen
* cannot start another Production Batch until the current Running batch completes or is cancelled

Archiving never affects historical data.

---

# Empty State

```text
+-----------------------------------------------------------+
| No Freeze Dryers have been created.                       |
|                                                           |
| Freeze Dryers must be created before Production Batches   |
| can be started.                                           |
|                                                           |
| [ Create Your First Freeze Dryer ]                        |
+-----------------------------------------------------------+
```

---

# Error States

If Freeze Dryers cannot be loaded:

```text
Unable to load Freeze Dryers.

[ Retry ]
```

---

# Navigation

Users may navigate:

Dashboard

↓

Freeze Dryers

↓

Create / Edit Freeze Dryer

or

Dashboard

↓

Freeze Dryers

↓

Open Current Production Batch

---

# Mobile Considerations

On smaller screens:

* Stack Freeze Dryer cards vertically.
* Keep the primary action visible.
* Collapse secondary actions into an overflow menu if necessary.

---

# Success Criteria

A user should be able to:

* Understand the status of every Freeze Dryer at a glance.
* Create a new Freeze Dryer in under one minute.
* Begin a Production Batch directly from an idle Freeze Dryer.
* Open an active Production Batch with a single click.

---

# Future Enhancements

Future versions may include:

* Freeze Dryer photos
* Manufacturer information
* Serial numbers
* Maintenance reminders
* Runtime statistics
* Efficiency reports
