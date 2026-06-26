# AGENTS.md

# Freezeflow AI Development Guide

## Mission

Freezeflow is a production management and inventory system designed specifically for freeze drying.

Its purpose is to preserve the complete lifecycle of every product—from preparation through long-term storage—while reducing manual work and maintaining complete traceability.

Every implementation decision should support this mission.

---

# Documentation is the Source of Truth

This repository follows a documentation-first development process.

Before making architectural or implementation decisions, every AI agent must read the project documentation.

Documentation defines the intended behavior of the system.

If implementation and documentation disagree, **the documentation is considered correct**.

Do not silently change architecture in code.

---

# Required Reading Order

Before making changes, read the following documents in order:

1. README.md
2. docs/01-project-overview.md
3. docs/02-domain-model.md
4. docs/03-workflow.md
5. docs/04-business-rules.md
6. docs/05-terminology.md
7. docs/06-ui-philosophy.md
8. docs/07-roadmap.md
9. docs/08-data-model.md
10. docs/09-api-design.md

Do not begin implementation until the project architecture is understood.

---

# Documentation Hierarchy

When documents appear to conflict, use the following precedence:

1. Business Rules
2. Workflow
3. Domain Model
4. UI Philosophy
5. Terminology
6. Data Model
7. API Design
8. Roadmap

If uncertainty remains, stop implementation and update the documentation before continuing.

---

# Development Philosophy

Freezeflow is built around the user's real-world workflow.

Implementation should support the documented workflow rather than introducing unnecessary abstractions.

Optimize for the user—not the database.

When multiple implementation options exist, prefer the one that best follows the documented Business Rules and UI Philosophy.

---

# Core Principles

## Preserve History

Production history is more valuable than convenience.

Historical production information should never be destroyed.

Prefer preserving information over overwriting or deleting it.

---

## Preserve Traceability

Every package should always be traceable back to:

* Production Batch
* Freeze Dryer
* Tray(s)
* Weight Checks
* Historical preparation information
* Recipe, if one was used

Never introduce code that breaks traceability.

---

## Respect Business Rules

Business Rules are project invariants.

Application code should enforce these rules rather than relying on user behavior.

---

## Match User Terminology

Always use terminology defined in:

`docs/05-terminology.md`

Avoid introducing new words for existing concepts.

---

## Follow the Workflow

The application should follow the documented workflow.

Do not redesign workflows without first updating the documentation.

---

## Prefer Explicit Relationships

Avoid hidden or inferred relationships.

Relationships should be represented explicitly whenever practical.

---

## Simplicity First

Prefer readable, maintainable code over clever implementations.

Future contributors should understand the code without extensive explanation.

---

# Think Like the User

Users think in terms of:

* Products
* Recipes
* Production Batches
* Trays
* Packages
* Storage Locations

Users do **not** think in terms of:

* database tables
* join tables
* ORM models
* implementation details

The software should reflect the user's mental model.

---

# Never

Never:

* delete historical production data
* break traceability
* invent undocumented workflows
* introduce undocumented terminology
* bypass documented business rules
* silently redesign architecture
* optimize code at the expense of clarity

---

# When Unsure

If implementation details are unclear:

* Do not guess.
* Do not invent new workflows.
* Do not invent new terminology.
* Re-read the documentation.
* Recommend updating the documentation before implementing new behavior.

The documentation should evolve before the code.

---

# Implementation Guidelines

Prefer:

* small modules
* descriptive names
* composition over inheritance
* immutable historical records
* explicit validation
* typed interfaces
* predictable APIs
* reusable components

Avoid:

* global mutable state
* duplicated business logic
* hidden side effects
* premature optimization
* tightly coupled modules

---

# Database Philosophy

The database represents historical production records.

Data integrity is more important than convenience.

Prefer append-only historical records whenever practical.

Never sacrifice traceability for implementation simplicity.

---

# API Philosophy

APIs should represent business actions rather than CRUD operations.

Prefer endpoints that describe workflows.

Examples:

* Record Weight Check
* Complete Tray
* Package Product
* Move Package
* Mark Package Depleted

Avoid designing APIs around database tables.

---

# User Interface Philosophy

The interface should:

* reduce typing
* reduce mistakes
* preserve context
* make the next action obvious
* match the real-world workflow
* expose important history
* remain predictable

Build interfaces around user tasks—not data models.

---

# Documentation First

Major architectural decisions should be documented before implementation.

Implementation should follow documentation—not redefine it.

When adding significant features:

1. Update documentation.
2. Review Business Rules.
3. Review Workflow.
4. Review Domain Model.
5. Implement.
6. Update tests.

---

# Testing Philosophy

Tests should verify Business Rules.

Business Rules are more important than implementation details.

Every critical workflow should eventually have automated tests.

Regression tests should preserve documented behavior.

---

# Future Contributors

If a requested feature conflicts with the documented architecture:

Do not silently implement it.

Instead:

* explain the conflict
* recommend documentation updates
* preserve architectural consistency

Consistency is more valuable than short-term convenience.

---

# Final Principle

Freezeflow should model the user's real-world workflow—not expose the software's internal implementation.

When in doubt, optimize for the user experience while preserving history, traceability, and data integrity.
