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
| TopNavigation       | Primary product navigation                   | Documented        |

## Component rules

- Components use semantic tokens rather than page-specific colors.
- Business terminology is supplied by the calling feature.
- Components expose accessible native semantics.
- Primary actions are visually dominant but not oversized.
- Status components always include meaningful text.
- Surfaces use little or no elevation.
- Components must work without fixed desktop widths.

## Boundaries

The Dashboard is the first product-page pilot for this foundation. Production,
Freeze Dryers, Packaging, and future Inventory migration remain separate scoped
work. The application shell and TopNavigation also remain a separate migration.
