# 03 - Packaging Workspace

# Purpose

The Packaging workspace helps the operator convert completed product into
labeled inventory while supporting the order in which physical work actually
happens.

The screen is a resumable workspace, not a list of Packaging Operation records.

# User Goal

> I am done drying. Help me convert this food into labeled inventory without
> losing track of product or forcing me to package, weigh, and print in a fixed
> order.

# Entry Points

- **Start Packaging** from a completed Production Batch
- **Resume Packaging** from a Production Batch with an Open operation
- **Packaging** in primary navigation
- **Reprint Label** from Package or Tray Details

Launching from Production opens the relevant Production Batch directly.

# Information Priority

1. Selected Production Batch and operation progress
2. Current Packaging Allocation and source Trays
3. Selected, Allocated, and Remaining Weight
4. Planned and recorded Packages
5. Package Label readiness
6. Print queue and operation completion
7. Package Type setup

# Workspace Layout

```text
Packaging

[Production Batch selector]             [Open · Saved]

Operation Progress
2 Allocations · 8 Packages · 3 Labels Ready

Allocations
┌────────────────────────────────────────────────────────────┐
│ Chicken · Trays 1, 2, 3                         [Continue] │
│ 1,086 g selected · 700 g allocated · 386 g remaining      │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ Strawberries · Tray 4                           [Continue] │
│ 327 g selected · no Packages recorded                      │
└────────────────────────────────────────────────────────────┘

[+ Select Trays for Another Allocation]
```

The operator sees one Production Batch at a time. Switching batches must not
erase saved Open work.

# Start or Resume

If the selected Production Batch has no Open Packaging Operation:

```text
Batch 014 · black
4 completed Trays · 1,413 g ready

[Start Packaging]
```

If Open work exists:

```text
Batch 014 · Packaging in progress
Last saved Jul 18 at 2:42 PM

[Resume Packaging]
```

The interface should use operator language. It may show “Packaging in progress”
instead of asking users to manage a Packaging Operation entity.

# Create an Allocation

The operator selects one or more completed Trays from the selected Production
Batch.

```text
Select Completed Product

☑ Slot 1 · Chicken · 371 g
☑ Slot 2 · Chicken · 335 g
☑ Slot 3 · Chicken · 380 g
☐ Slot 4 · Strawberries · 327 g

Selected source: 1,086 g from 3 Trays

[Package Selected Product]
```

Selecting the Trays creates or resumes an identified Packaging Allocation behind
the workspace. The UI does not ask the user to name or administer the Allocation.

Separate product combinations use separate selections. Ineligible or already
allocated product is not selectable and explains why.

# Allocation Workspace

```text
Chicken
Source: Slots 1, 2, 3

Selected Source       Allocated             Remaining
1,086 g               700 g                 386 g

Packages
1  Quart Mylar   350 g product   365 g sealed   Label Ready
2  Quart Mylar   350 g product   366 g sealed   Label Draft

[+ Add Package for Remaining]
```

Selected, Allocated, and Remaining Weight remain visible together. Units must be
readable without opening a control.

The Add Package for Remaining action appears after the current Package rows near
the disabled completion action, following the operator's downward reading path.

# Planned Package Rows

The operator may plan Package rows before recording inventory.

```text
Package 3 · Planned

Package Type       [Quart Mylar]
Finished Product   [386] [g]
Sealed Weight      [   ] [g]
Oxygen Absorber    [500cc]
Storage            [Unassigned]

[Edit Label] [Record Package] [Remove Plan]
```

Planned rows are saved with the Open workspace. They are not Packages and do not
appear in Inventory until the operator selects Record Package.

# Record Package

The operator may record a Package before or after physically filling it. Required
Package information is validated when recording and when completing the overall
operation; the UI does not claim to know when the bag physically exists.

Recording a Package creates:

- the Package and auto-generated identifier
- its editable Package Label
- initial In Storage Package Status History
- initial Storage Location History

Unassigned is used when no Storage Location is selected.

# Package Label Editor

```text
Package Label                                      Draft

Display Name              [Martin's Taco Meal]
Subtitle                  [Chicken and vegetables]
Ingredients Summary       [Chicken, cabbage, tomatoes...]
Preparation Summary       [Shredded, seasoned]
Freeze-Dried Weight       5.29 oz
Fresh Equivalent          0.94 lb
Packaging Date            [Jul 18, 2026]
Rehydration Instructions  [Add 2 cups water...]
Serving Notes             [Serves 2]
Label Notes               [                    ]

[Save Draft] [Mark Ready] [Preview]
```

Initial values come from immutable Production History. Editing Package
Presentation must not alter source Trays or Preparation Metadata.

Allocation-level defaults may populate repeated label fields. Each Package may
override them.

# Label States

## Draft

Printable information is incomplete or still being reviewed.

## Ready

The Package Label is eligible for printing.

## Needs Reprint

Printable content changed after a previous Print Event.

Printed and Reprinted are events shown in label history, not status badges.

# Print Labels

One print queue accepts Package Labels selected from:

- a Package
- an Allocation
- the current Packaging workspace
- a Production Batch
- today's Ready or Needs Reprint labels
- a custom selection

```text
Print Labels

☑ Pork Shoulder · PKG-2026-000006 · Ready
☑ Pork Shoulder · PKG-2026-000007 · Needs Reprint
☐ Strawberries · PKG-2026-000008 · Ready

2 labels selected
1 Avery 5163 sheet

[Preview Avery 5163] [Print]
```

The preview uses two columns and five rows on Letter paper. More than ten labels
creates additional sheets.

The label gives primary emphasis to Display Name and weight equivalence. The
Package identifier is visible but secondary.

# Complete Packaging

```text
Packaging Progress

Allocation A · Complete · 0 g remaining
Allocation B · 177 g remaining

177 g still needs a Package.

[+ Add Package for Remaining]
[Complete Packaging] disabled
```

Completion is available only when all selected product is allocated to recorded
Packages and required Package and label data is valid.

When complete:

```text
Packaging Complete

15 Packages created
15 labels Ready · 12 printed

[Print Remaining Labels] [View Inventory]
```

The operator explicitly completes Packaging. The selected Trays then display as
Packaged. Inventory actions such as Given Away and Depleted are not offered here.

# States

## No Eligible Product

```text
No completed product is ready for Packaging.
[View Production]
```

## Open Work Saved

```text
Packaging progress saved.
You can safely leave and resume later.
```

## Weight Warning

Warnings explain measurement differences without substituting Sealed Package
Weight for Finished Product Weight.

## Completion Blocked

The screen names the exact Allocation, missing field, or remaining quantity and
places the corrective action beside the problem.

# Error Handling

The UI should clearly handle:

- stale source eligibility
- Package or label save failure
- attempted over-allocation
- invalid weight or unit
- print preview failure
- operation completion conflict

Saved Open work remains intact after recoverable errors.

# Mobile Considerations

- show one Allocation at a time
- keep the Remaining Weight summary sticky when entering Packages
- stack Package fields into a readable form
- keep units adjacent to values
- avoid horizontal tables for primary actions
- keep Print and Complete actions reachable without losing context

# Success Criteria

The Packaging workspace succeeds when:

- operators can pause and resume without losing work
- separate product combinations remain traceable
- multiple Trays can supply multiple Packages
- unallocated product cannot silently disappear
- Package and label data can be prepared in a flexible order
- Package Labels can be edited, selected, printed, and reprinted
- bulk Avery output matches the physical labeling task
- completing Packaging creates a clear handoff to Inventory
