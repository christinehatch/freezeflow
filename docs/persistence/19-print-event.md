# Print Event

## Purpose

A Print Event is an append-only record that a Package Label was included in
generated print output.

# Fields

| Field | Required | Notes |
| --- | --- | --- |
| id | Yes | Stable UUID |
| packageLabelId | Yes | Printed Package Label |
| printedAt | Yes | Effective print timestamp |
| recordedAt | Yes | System record timestamp |
| template | Yes | Rendering template, such as Avery 5163 |
| printJobId | Yes | Groups labels rendered together |
| notes | No | Optional context |

# Behavior

Print Events are append-only and are never edited or deleted. Reprinting creates
another Print Event. A print job may include labels selected from one Package,
Allocation, Packaging Operation, Production Batch, today's Ready labels, or a
custom Package selection.
