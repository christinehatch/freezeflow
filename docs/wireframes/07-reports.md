# 07 - Reports

# Purpose

The Reports screen helps users learn from historical production data.

Unlike the Dashboard, which focuses on current work, Reports focus on completed production history.

Reports should answer practical questions that improve future freeze-drying decisions.

Examples:

* Which Freeze Dryer performs better?
* How long does chicken usually take?
* What is the average dry weight for strawberries?
* Which recipes have I made most often?
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

Charts

Dry Time Comparison

###########

#########

Weight Loss Comparison

##########

##########

------------------------------------------------------------------------------

Notes

Freeze Dryer #2 averages approximately 2.5 fewer drying hours than Freeze Dryer #1.

------------------------------------------------------------------------------
```

---

# Available Reports

Version 1 should include:

* Freeze Dryer Performance
* Product History
* Recipe History
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
* Recipe
* Production Batch

Only filters relevant to the selected report should be displayed.

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

Fresh-to-dry yield compares Starting Weight to Final Dry Weight.

Yield analysis belongs in Reporting (Milestone 7).

Milestone 3 records the underlying weights.

---

# Inventory Summary

Display:

* Packages currently in storage
* Packages depleted
* Most common products
* Total production

This report provides a high-level overview rather than detailed inventory management.

---

# Historical Accuracy

Reports should always use historical snapshot data.

Editing a Recipe must not change historical reports.

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
* Collapse charts when appropriate.
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
