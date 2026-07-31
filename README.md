# ❄️ Freezeflow

> Freezeflow helps freeze-drying enthusiasts turn production history into trustworthy, searchable inventory.

Freezeflow is a software platform that tracks the complete lifecycle of freeze-dried products—from fresh food preparation through long-term storage.

Freezeflow preserves the entire production history of every batch so finished inventory can be found, trusted, and traced back to how it was prepared, dried, and packaged.

---

# Why Freezeflow?

Most inventory systems only answer one question:

> **"Where is my product?"**

Freezeflow's primary job is to answer that question quickly, while preserving the production context needed to trust the answer:

* How was this product prepared?
* Which freeze dryer was used?
* How long did it take to dry?
* How much weight was lost?
* Which trays produced this package?
* Where is it stored?
* Has it been used?
* Which machine was used?

Every stage of production becomes part of the permanent record.

---

# Project Goals

Freezeflow is designed around five primary goals:

### Preserve Production History

Every batch should have a complete history that can be reviewed years later.

Nothing important should ever be lost.

---

### Simplify Inventory

Finding products should be fast and effortless.

Searching for "Chicken" should immediately show every stored package and its location.

---

### Improve Future Batches

Historical production data should support practical questions like:

* Which foods dry the fastest?
* Which preparation methods work best?
* What is the average moisture loss for strawberries?

The system should become more valuable over time, but reporting should support the inventory and production workflow rather than turn routine freeze drying into data entry for its own sake.

---

### Preserve Traceability

Every package should be traceable back to:

* the production batch
* the freeze dryer
* the trays it came from
* the preparation method
* the recorded drying process

Nothing should become disconnected from its history.

---

### Build Around the User's Workflow

Freezeflow should adapt to how people already freeze dry food.

The software should support the workflow—not force users to change it.

---

# High-Level Workflow

```text
Preparation Preset / Product
        │
        ▼
Food Preparation
        │
        ▼
Production Batch
        │
        ▼
Tray Assignment
        │
        ▼
Drying Runs
        │
        ▼
Weight Checks
        │
        ▼
Completed Trays
        │
        ▼
Combine Compatible Trays
        │
        ▼
Package
        │
        ▼
Assign Storage Bin
        │
        ▼
Inventory
        │
        ▼
Depleted
```

---

# Core Features

## Production Tracking

* Record production batches
* Track multiple freeze dryers
* Record tray assignments
* Record preparation methods
* Record notes

## Drying Process

* Record starting weights
* Track drying runs
* Record unlimited weight checks
* Track actual machine drying time
* Suggest when trays may be complete
* Compare drying performance

## Packaging

* Combine compatible trays
* Select Package Types
* Record package weights
* Suggest oxygen absorber information
* Preserve sealed storage weight

## Inventory

* Assign storage locations
* Search inventory
* Track depleted packages
* Preserve historical records

## Reporting

* Freeze dryer performance
* Product statistics
* Yield calculations
* Drying time analysis
* Inventory summaries

---

# Guiding Principles

Freezeflow is built around several core principles.

## History Is Never Lost

Production data should never be overwritten or deleted.

Corrections should preserve historical information whenever possible.

---

## Traceability Matters

Every package should be traceable back to the trays and production batch that created it.

---

## Simple Before Powerful

The most common tasks should require the fewest possible clicks.

Advanced reporting should never make everyday workflows more complicated.

---

## Search Everything

Users should be able to quickly locate:

* products
* batches
* packages
* storage bins
* recipes

from a single search experience.

---

## Reduce Manual Work

Whenever possible, the software should reduce repetitive typing through reusable recipes, defaults, and intelligent suggestions.

---

# Documentation

Additional project documentation can be found in the `/docs` directory.

* Project Overview
* Domain Model
* Terminology
* Business Rules
* Workflow
* Data Model
* UI Philosophy
* Roadmap

---

# Development Setup

Freezeflow is split into separate backend and frontend applications.

## Prerequisites

* Python 3.12 or newer
* uv
* Node.js
* npm

## Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The backend health endpoint is available at:

```text
GET /api/v1/health
```

Run backend tests and quality tools:

```bash
cd backend
uv run pytest
uv run ruff check .
uv run black --check .
```

Run database migrations:

```bash
cd backend
uv run alembic upgrade head
```

### Developer Tools

Local development starts with Developer Tools enabled. Open
`http://localhost:5173/developer-tools` to reset or seed the local database with
realistic workflow scenarios. These actions replace or mutate local data and ask
for confirmation in the interface.

Set `FREEZEFLOW_ENVIRONMENT=production` for production deployments. In that
environment the `/dev/*` API is not registered, and production frontend builds
do not expose the Developer Tools page.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Run frontend tests and quality tools:

```bash
cd frontend
npm run test
npm run lint
npm run format
npm run build
```

Milestones 0 through 4 are complete. Production setup, Drying Runs, Weight
Checks, Tray completion, explicit Production Batch completion, and the resumable
Packaging and Package Label workflow are functional. See
`docs/implementation/README.md` for the current milestone status.

---

# Project Status

🚧 Early Design Phase

The domain model and workflow are currently being finalized before development begins.

The focus of this phase is understanding the real-world freeze drying process and designing the system around that workflow.

---

# Long-Term Vision

Freezeflow is intended to become a complete production management platform for freeze drying.

Future versions may include:

* Preparation Preset management
* QR code package labels
* Barcode support
* Cost analysis
* Yield reporting
* Printable package labels
* Batch analytics
* Mobile support
* Cloud synchronization
* Multi-user support

The goal is to create a system that grows alongside the user's freeze-drying operation while preserving the complete history of every product from preparation to storage.
