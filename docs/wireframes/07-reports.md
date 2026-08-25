# 07 - Reports

# Purpose

The Reports screen helps users learn from historical production data.

Unlike the Dashboard, which focuses on current work, Reports focus on completed production history.

Reports should answer practical questions that improve future freeze-drying decisions.

Examples:

* Which Freeze Dryer performs better?
* How long does chicken usually take?
* What is the average dry weight for strawberries?
* Which Preparation Presets have I used most often?
* How much inventory have I produced?

Reports should prioritize actionable information over complex analytics.

---

# User Goals

A user should be able to:

* Compare Freeze Dryer performance.
* Review drying times.
* Compare products.
* Review historical production.
* Understand production trends.
* Answer real-world questions using historical data.

---

# Primary Actions

* View Reports
* Filter Reports
* Compare Products
* Compare Freeze Dryers
* Export Report, future

---

# Screen Layout

```text
+======================================================================================+
| Reports                                                                              |
+======================================================================================+

Report

[ Freeze Dryer Performance v ]

Time Range

[ Last 12 Months v ]

------------------------------------------------------------------------------

Summary

Freeze Dryer #1

Average Dry Time

42.3 hrs

Average Weight Loss

76%

Completed Batches

82

--------------------------------------------------

Freeze Dryer #2

Average Dry Time

39.8 hrs

Average Weight Loss

75%

Completed Batches

95

------------------------------------------------------------------------------
```

Version 1 renders the Summary section above as stat blocks and, for
row-shaped reports, plain sortable tables — it does not render charts or an
auto-generated comparison sentence. An earlier draft of this mockup showed a
"Charts" section and a "Notes" section with a generated comparison sentence;
both are removed here because they belong to "Future Enhancements" below
("Interactive charts"), not Version 1, and no charting library exists in the
frontend today. Leaving them in this mockup while also listing charts under
Future Enhancements was a direct self-contradiction in this document — see
`docs/implementation/07-milestone-7.md`'s Open Decisions for the record of
this resolution.

---

# Available Reports

Version 1 should include:

* Freeze Dryer Performance
* Product History
* Preparation History
* Drying Time
* Production History
* Inventory Summary

Each report should answer a specific question.

---

# Filters

Reports should support:

* Date Range
* Freeze Dryer
* Product
* Preparation Preset
* Production Batch

Only filters relevant to the selected report should be displayed. The
applicable filters per report:

| Report | Date Range | Freeze Dryer | Product | Preparation Preset | Production Batch |
| --- | --- | --- | --- | --- | --- |
| Freeze Dryer Performance | yes | yes | | | |
| Product History | yes | | yes | | |
| Preparation History | yes | | | yes | |
| Drying Time | yes | yes | | | yes |
| Production History | yes | yes | yes | yes | yes |
| Inventory Summary | yes | | yes | | |

A report's own grouping dimension is never offered as a filter on itself in
a way that would collide with it (for example, Freeze Dryer Performance
already groups by Freeze Dryer, so a Preparation Preset filter there has no
coherent meaning and is intentionally omitted).

---

# Freeze Dryer Performance

Show:

* Average Dry Time
* Number of Production Batches
* Average Weight Loss
* Average Time to Completion

This report should help identify operational differences between machines.

---

# Product History

Users should be able to answer:

* How often have I freeze dried this product?
* What is the average drying time?
* What is the average fresh-to-dry yield?
* When was the last batch?

Fresh-to-dry yield compares Starting Weight to Finished Product Weight.

Yield analysis belongs in Reporting (Milestone 7).

Milestone 3 records the underlying weights.

Average Drying Time is the average, across every Production Batch that
included this Product, of that Batch's own total drying time. A Batch that
dried more than one Product at once contributes its one shared duration to
every Product it contained — this is expected, not a counting error.

---

# Preparation History

Users should be able to answer:

* Which Preparation Presets have I used most often?
* What is the average drying time and yield for this Preparation Preset?
* When did I last use this Preparation Preset?

Preparation History mirrors Product History, grouped by Preparation Preset
instead of Product. Trays created without a Preparation Preset — a fully
supported, equally first-class workflow since Milestone 6 — are not
excluded from this report. They appear as their own row rather than
disappearing, so a user who mostly enters Ingredients and Preparation
Methods inline still sees a complete picture.

Because renaming a Preparation Preset must never change historical reports
(see Historical Accuracy below), each Preparation Preset row is keyed by
the immutable name each Tray recorded at the time it was created, not by a
live lookup of the Preset's current name.

---

# Drying Time

Users should be able to answer:

* How long did this specific Production Batch take to dry?
* How many Drying Runs did it take, and were any voided?

Drying Time lists individual Production Batches with their computed Total
Drying Time (the sum of non-voided Drying Run durations), Freeze Dryer, and
completion date. It is the Batch-level detail that Freeze Dryer
Performance's per-machine averages are built from.

---

# Production History

Users should be able to answer:

* What has this Freeze Dryer produced recently?
* What did a specific Production Batch contain?

Production History is a filterable historical log, one row per completed
Production Batch, supporting every available filter. It is the
general-purpose browse view underlying the other, more aggregated reports.

---

# Inventory Summary

Display:

* Packages currently in storage
* Packages Given Away
* Packages depleted
* Most common products
* Total production

Total production is shown as two distinct figures — total packaged weight
and total dried weight — rather than one combined number. These are
intentionally not expected to match: some dried product may not yet be
packaged, and packaging introduces its own weight differences. Showing one
merged number would hide that gap instead of explaining it.

This report provides a high-level overview rather than detailed inventory management.

---

# Historical Accuracy

Reports should always use historical snapshot data.

Editing a Preparation Preset must not change historical reports because reports use each Tray's immutable Preparation Metadata snapshot.

Reports should respect corrections while preserving audit history.

---

# States

## Normal

Historical reports are available.

---

## No Data

```text
No production history is available yet.

Create Production Batches to begin collecting historical insights.
```

---

## Filtered

Reports update automatically as filters change.

---

# Empty State

```text
No matching production history was found for the selected filters.
```

---

# Error States

If report generation fails:

* Explain the problem.
* Preserve selected filters.
* Allow retry.

---

# Mobile Considerations

* Stack report sections vertically.
* Allow row-shaped report tables to scroll horizontally rather than
  compressing columns illegibly.
* Prioritize summary metrics over detailed tables.

---

# Success Criteria

A user should be able to:

* Compare Freeze Dryers quickly.
* Learn how different products perform.
* Make better production decisions using historical data.
* Understand trends without exporting data.
* Answer common production questions in under one minute.

---

# Future Enhancements

Future versions may include:

* Interactive charts
* Custom report builder
* CSV / Excel export
* Cost analysis
* Production forecasting
* Shelf-life statistics
* Machine utilization trends
* Packaging efficiency analysis
