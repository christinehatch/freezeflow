# 07 - Roadmap

# Purpose

This document defines the planned evolution of Freezeflow.

The roadmap is organized into milestones that each deliver meaningful value to the user.

Every milestone should result in a usable application, even if some functionality remains incomplete.

The roadmap is intended to guide development priorities rather than establish fixed deadlines.

---

# Guiding Principle

Every milestone should improve a real workflow.

Features should not be implemented simply because they are technically interesting.

Development should always prioritize reducing work for the user.

Production tracking exists to create trustworthy inventory.

Reports and metrics should support the user's workflow, but the core product value is being able to find finished food quickly and trust its history.

---

# Milestones

Development is organized into small, incremental milestones.

Each milestone builds upon the previous one and leaves the application in a stable, working state.

Later milestones extend existing functionality rather than replacing it.

| Milestone | Status |
| --- | --- |
| 0 - Project Foundation | Complete |
| 1 - Persistence Layer | Complete |
| 2 - Production Workflow | Complete |
| 3 - Weight Tracking | Complete |
| 4 - Packaging | Complete |
| 5 - Inventory | Planned |
| 6 - Recipes | Planned |
| 7 - Reporting | Planned |
| 8 - Application Polish | Planned |
| 9 - Version 1 Release | Planned |

---

## Milestone 0 — Project Foundation

Establish the project foundation.

Includes:

- Repository structure
- Development environment
- Documentation
- Project scaffolding
- Tooling
- Initial testing framework

---

## Milestone 1 — Persistence Layer

Implement the persistence layer.

Includes:

- Database schema
- SQLAlchemy models
- Alembic migrations
- Repository layer
- Pydantic schemas
- Database relationships

No business workflows are implemented during this milestone.

---

## Milestone 2 — Production Workflow

Implement the production setup workflow.

Includes:

- Freeze Dryer management
- Production Dashboard
- Draft Production Batches
- Tray management
- Start Production
- Cancel Production
- Production navigation

Users can create and organize a production run.

Production setup ends when the user starts the Production Batch.

Weight tracking, tray completion, packaging, and inventory management are implemented in later milestones.

---

## Milestone 3 — Weight Tracking

Implement drying progress.

Includes:

- Starting Weight
- Drying Runs
- Current Run Complete workflow
- Weight Checks
- Finished Product Weight
- Tray completion
- User-confirmed Batch completion

Users can now fully record a production run.

Milestone 3 records the weight data required for fresh-to-dry yield:

* Starting Weight (fresh input)
* Finished Product Weight (finished tray output)

Yield itself is a derived production metric.

Milestone 3 also records actual freeze dryer runtime through Drying Runs.

Total drying time is derived from non-voided Drying Run durations, not Production Batch wall-clock duration.

Individual tray moisture loss may be visible when a Tray completes.

Answering historical yield questions across products and batches belongs in Milestone 7 (Reporting).

---

## Milestone 4 — Packaging

Prepare and execute a Packaging Session.

Includes:

- Packaging Operations
- Package creation
- Package Types
- Multiple Packages
- Traceability
- Packaging Worksheet
- Printable human-readable labels
- Separate Package Finished Product and Sealed Package Weights
- Derived fresh-to-dry equivalence, Packaging Date, and preparation on labels
- Auto-generated Package identifiers
- Selected Storage Location or implicit Unassigned Storage Location

Package attributes (sealed weight, oxygen absorber, notes) are recorded directly on each Package.

Package Type should provide reusable package formats and defaults such as oxygen absorber size and printable label template while remaining editable during packaging.

Package depletion, marking Packages Given Away, inventory search, package movement, and Storage Location setup belong to Milestone 5.

---

## Milestone 5 — Inventory

Manage finished inventory.

Includes:

- Inventory search
- Package details
- Storage Locations
- Storage movement
- Package depletion
- Mark Packages Given Away

Milestone 5 is a core product milestone.

The primary user outcome is answering:

* Where is this product?
* How much do I have left?

---

## Milestone 6 — Recipes

Improve production efficiency.

Includes:

- Recipe management
- Recipe templates
- Applying Recipes to Trays
- Recipe search
- Recipe organization

---

## Milestone 7 — Reporting

Provide historical insight.

Includes:

- Production reports
- Inventory reports
- Drying statistics
- Fresh-to-dry yield analysis
- Historical analysis

Reporting answers questions such as:

* How much finished dry product do I actually get from this fresh input?
* Which products or preparation methods produce the best yield over time?

Yield analysis depends on Starting Weight and Finished Product Weight recorded in Milestone 3.

Packaging data from Milestone 4 enables additional comparisons between tray output and sealed package output.

---

## Milestone 8 — Application Polish

Improve usability and reliability.

Includes:

- Validation improvements
- Accessibility
- Performance
- User experience refinements
- Error handling

---

## Milestone 9 — Version 1 Release

Prepare Freezeflow for production release.

Includes:

- Bug fixing
- Final testing
- Documentation review
- Release validation
- Version 1 launch readiness

---

# Guiding Principle

Every milestone should produce a working application.

No milestone should depend on partially implemented functionality from a future milestone.

Each milestone should be independently testable before development continues.

---

# Future Milestones

The following features are intentionally deferred until the production workflow is mature.

## Advanced Labeling

* QR codes
* Barcode generation
* Custom label-template design
* Direct printer integrations

---

## Mobile Support

* Tablet interface
* Mobile-friendly weight entry
* Camera integration

---

## Cloud Synchronization

* Automatic backup
* Multi-device support

---

## Multi-User Support

* User accounts
* Shared inventory
* Permissions

---

## Cost Tracking

* Ingredient costs
* Packaging costs
* Cost per package
* Cost per batch

---

## Analytics

* Long-term trends
* Machine efficiency
* Product comparisons
* Fresh-to-dry yield trends
* Historical charts

---

## Future Domain Enhancements

User research has identified additional real-world concepts that may become first-class records after the core V1 workflow is stable.

These include:

* Physical Tray calibration notes
* Advanced Drying Run analytics or machine telemetry
* Packaging Supplies such as Mylar bags, oxygen absorbers, and labels
* Supply stock counts and reorder reminders
* Guided product description builders for consistent naming and reporting
* Package rerun or special-attention history
* Freeze Dryer maintenance history

These concepts should be documented in architecture and persistence docs before implementation.

They should not be added opportunistically to the current milestone.

---

## Future UX Opportunities

User research has also identified product opportunities that may help Freezeflow remove mental work for the user.

Examples include:

* structured product-name builders
* smart reusable notes
* tray calibration wizards
* live drying dashboards
* automatic stability indicators
* machine health comparisons
* product pairing suggestions
* smart warnings for mismatched products
* supply forecasts
* production timelines
* batch replay
* rerun visibility
* historical insight summaries

These opportunities should be evaluated against the product philosophy:

* preserve trustworthy history
* reduce cognitive load
* automate math, not judgment
* help users improve their craft

They are not current milestone commitments.

---

# Release Philosophy

A feature should only be considered complete when it:

* follows the documented workflow
* respects every business rule
* preserves historical data
* feels intuitive to use

Completing features is less important than completing workflows.

---

# Success Criteria

Development should prioritize:

1. Recording production accurately.
2. Packaging products correctly.
3. Finding inventory quickly.
4. Learning from historical data, including fresh-to-dry yield.

If a proposed feature does not improve one of these four areas, it should be reconsidered before implementation.

---

# Roadmap Maintenance

This roadmap is expected to evolve as new requirements are discovered.

Changes should preserve the overall philosophy of the project while remaining focused on improving the real-world freeze-drying workflow.

The roadmap should remain implementation-independent and should describe user-facing value rather than technical tasks.
