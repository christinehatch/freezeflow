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

## Guided stages

The workspace presents the existing flexible Packaging actions through five
stable stages:

1. **Choose a batch** — select or resume one completed Production Batch.
2. **Choose product** — select completed Trays and save a Packaging Allocation.
3. **Allocate packages** — plan and record Packages while balancing Finished
   Product Weight.
4. **Review and labels** — edit labels, review readiness, preview, and print.
5. **Finish** — review blockers and explicitly complete Packaging.

This is presentation guidance, not a new domain locking sequence. Only the
current stage renders its full controls. Completed stages become compact
summaries, and future stages remain unavailable until their documented
prerequisites exist. Explicit Back and Next actions let operators return to
earlier valid work without exposing every form at once. Reloading restores the
stage derived from authoritative saved operation state rather than unsaved local
navigation.

Each stage occupies one compact operational workspace rather than joining an
endlessly stacked worksheet. The weight summary is sticky only while creating
Packages, when selected, allocated, and remaining Finished Product Weight inform
the current task. Source Trays and Package rows use compact tables at desktop
widths, with horizontal containment at narrower widths. Saved operation details,
Allocation history, recorded Packages, Package Label history, and Print Events
remain available through contextual disclosures instead of occupying the main
flow.

## Stage 3 single-bag loop

Stage 3 is organized around recording one physical bag at a time. The initial
desktop viewport shows compact progress, the active source pool's Remaining
Weight, compact saved-bag summaries, and one current Bag form without requiring
scrolling before entry begins.

The current form contains Package Type, Finished Product Weight, Sealed Package
Weight, Oxygen Absorber, Storage Location, and Notes. Saving the form
intentionally records one Package through the existing Packaging Allocation.
The interface calls the physical task a Bag while the durable domain record
remains a Package.

After a Bag is saved, the form is replaced by a decision:

- **Add another bag** opens the next numbered Bag, retains the selected Package
  Type as a repeated-entry convenience, reapplies its documented oxygen
  absorber default, and clears measurements, Storage Location, and Notes.
- **No more bags — Review** proceeds only when every independent source pool has
  zero Remaining Weight and every saved planned row has been recorded.

Previously recorded Packages appear as compact saved-bag rows. Allocation
history, recorded Package history, timestamps, source Tray details, label
details, and reconciliation information are collapsed by default. When more
than one Packaging Allocation exists, Stage 3 shows a short product-source
selector and works on one source pool at a time; weights are never netted across
source pools.

At wide desktop widths, an adjacent sticky Packaging summary keeps the active
source pool's authoritative Total, Packaged, Remaining, and saved-Bag count in
view. It may also repeat the currently selected Package Type and its configured
default oxygen absorber. The summary is informational: it does not introduce
recommendations or new actions. At narrower widths it returns to normal reading
order between the dominant weight status and the Bag form so the form retains
the full available width.

Reloading derives saved Bags, the active source pool, and Remaining Weight from
the authoritative Packaging Operation. A new Bag form opens only when the Open
operation still has product or a durable unrecorded planned row to record.

```text
Packaging

[Batch identity]                        [Packaging in progress]

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

When only one Production Batch is available, show it directly instead of
making the operator choose it from a one-item selector. When several are
available, selector options contain only the Batch identity and Freeze Dryer
name. Tray readiness and saved-work state belong in supporting text after the
selection, not in a long status string inside the control.

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

Allocation Notes [Optional context for this product combination]

[Back] [Save & Continue]
```

Allocation Notes and the Stage action row follow the Tray selection so the
operator's reading path moves from selection to confirmation. Save & Continue
is disabled and visually quiet while no Tray is selected. Selecting at least
one eligible Tray enables the action and gives it the filled primary green
state, making the next step clear without changing Allocation validation.

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

# Package Type Administration

Package Type setup is secondary to active Packaging work. The Packaging page
links to a separate **Manage Package Types** screen at
`/packaging/package-types`; it does not place the full administration form inside
the guided workspace. The secondary screen preserves Package Type creation,
defaults, notes, archiving, loading, empty, and structured-error behavior, and
provides a direct return to Packaging.

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
