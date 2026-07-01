# Freezeflow Implementation Plan

# Purpose

This directory defines the implementation milestones for Version 1 of Freezeflow.

Unlike the architecture documentation, these documents describe **how the application will be built**, not how it behaves.

The architecture documentation defines **what Freezeflow is**.

The implementation milestones define **how Freezeflow is constructed**.

---

# Guiding Principles

Implementation is intentionally incremental.

Each milestone should:

- build upon previous milestones
- leave the application in a working state
- be independently testable
- avoid implementing functionality assigned to future milestones

Contributors should implement only the currently assigned milestone.

If implementation requires a change to the architecture, stop and update the architecture documentation before continuing.

---

# Milestone Philosophy

Milestones are organized around complete slices of functionality rather than individual technologies.

Each milestone should deliver meaningful progress while maintaining a stable, working application.

Future milestones should extend previous work rather than replacing it.

---

# Milestones

| Milestone | Goal |
|-----------|------|
| 00 | Project Foundation |
| 01 | Persistence Layer |
| 02 | Production Batches & Trays |
| 03 | Weight Checks |
| 04 | Packaging |
| 05 | Inventory |
| 06 | Recipes |
| 07 | Reporting |
| 08 | Application Polish |
| 09 | Version 1 Release Preparation |

---

# Milestone Rules

Each milestone should:

- compile successfully
- pass all automated tests
- pass linting and formatting
- preserve architectural decisions
- update documentation when necessary

A milestone is not complete until these conditions are satisfied.

---

# Out of Scope

Implementation should not skip ahead to future milestones.

For example:

- Milestone 2 should not implement Weight Checks.
- Milestone 3 should not implement Packaging.
- Milestone 4 should not implement Inventory.

Building ahead often introduces unnecessary assumptions and makes it more difficult to verify each milestone independently.

---

# Definition of Done

Before a milestone is considered complete:

- All planned work for the milestone has been implemented.
- Existing functionality continues to work.
- Backend tests pass.
- Frontend tests pass.
- Linting passes.
- Formatting passes.
- Documentation has been updated if necessary.
- No undocumented architectural decisions have been introduced.

---

# Architecture First

The architecture documentation remains the source of truth.

Implementation documents should never redefine business rules, workflows, or data models.

If implementation reveals a missing architectural decision:

1. Stop implementation.
2. Document the decision.
3. Update the architecture.
4. Continue implementation.

Implementation should never invent architecture.

---

# Goal

The objective of these milestones is not simply to write code.

The objective is to build Freezeflow in small, verifiable increments while preserving the architectural principles defined throughout the repository.
