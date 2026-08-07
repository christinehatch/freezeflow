# Component Scope

## Purpose

Shared components make repeated actions and states predictable. They should
encode presentation and interaction rules without absorbing business logic.

## Initial component scope

| Component           | Purpose                                      | Foundation status |
| ------------------- | -------------------------------------------- | ----------------- |
| Button              | Primary and secondary actions                | Implemented       |
| StatusBadge         | Compact semantic state                       | Implemented       |
| PageHeader          | Orienting title, purpose, and primary action | Implemented       |
| StatusBanner        | Calm, attention, success, and danger focus   | Implemented       |
| Surface             | Bordered content grouping                    | Implemented       |
| SectionHeader       | Section title and quiet secondary action     | Implemented       |
| FreezeDryerCard     | Freeze Dryer state and next action           | Implemented       |
| RecentProductionRow | Compact Production Batch history             | Implemented       |
| WorkflowStepper     | Compact progress across a guided workflow    | Implemented       |
| WorkflowStage       | Current, completed, and upcoming stage frame | Implemented       |
| Field               | Label, hint, and validation message wrapper  | Implemented       |
| TextField           | Single-line text entry                       | Implemented       |
| NumberField         | Numeric entry with an optional unit suffix   | Implemented       |
| Textarea            | Multi-line text entry                        | Implemented       |
| Select              | Accessible custom single-value selection     | Implemented       |
| SummaryPanel        | Persistent task metrics and supporting facts | Implemented       |
| TopNavigation       | Primary product navigation                   | Documented        |

## Component rules

- Components use semantic tokens rather than page-specific colors.
- Business terminology is supplied by the calling feature.
- Components expose accessible native semantics.
- Primary actions are visually dominant but not oversized.
- Status components always include meaningful text.
- Surfaces use little or no elevation.
- Components must work without fixed desktop widths.
- Form controls share one visual family, remain at least 44px high, and expose
  visible labels and validation context.
- Select uses combobox and listbox semantics, supports keyboard navigation, and
  may show quiet secondary metadata beneath each option's primary label.
- SummaryPanel presents authoritative task context without adding decisions or
  recommendations. It may be sticky beside a task on wide screens and must
  return to the normal reading order at narrower widths.
- Workflow progress communicates orientation without locking the documented
  business workflow into a strict wizard.
- The current workflow stage is prominent, completed stages are compact context,
  and upcoming stages are visually quiet.
- Operational workspaces may keep a compact, sticky summary above related
  stages when critical totals must remain visible while rows are edited.
- Completed or historical stage detail should use progressive disclosure when
  keeping every detail expanded would obscure the current physical task.

## Boundaries

The Dashboard is the first product-page pilot for this foundation. Packaging is
the first guided-workflow adoption. Production, Freeze Dryers, and future
Inventory migration remain separate scoped work. The application shell and
TopNavigation also remain a separate migration.
