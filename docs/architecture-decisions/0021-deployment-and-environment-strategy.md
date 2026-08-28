# ADR-0021 - Deployment and Environment Strategy

# Status

Accepted

---

# Context

Freezeflow has run only via local dev servers (`uvicorn`/`vite dev`) for its
entire history. There is no Dockerfile, no CI pipeline, and no environment
configuration beyond a handful of optional `Settings` fields (`database_url`,
SMTP). CORS is hardcoded to two localhost origins with no way to override it.

Milestone 9 needs to get the app ready to actually be deployed, and the
user has a specific future goal for what that deployment looks like: two
isolated instances — a real, working deployment for their aunt to use
day-to-day, and a separate public demo linked from the user's personal site
that visitors can interact with. The demo must never be able to see, modify,
or otherwise affect the aunt's real data.

This ADR covers the deployment shape Milestone 9 actually builds. It
deliberately does not stand up the second (public demo) deployment yet —
it makes the app able to run as two independently-configured instances
without inventing multi-tenancy inside the app itself.

---

# Decision

## Docker, self-hosted, hosting-agnostic — not a specific cloud vendor

The app is packaged to run anywhere Docker runs: a home server, a small VPS,
or a cloud container service, without committing to one now. Two separate
multi-stage Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`) are
built rather than one combined file — the two services have unrelated base
images and build steps, and the two-deployment goal may eventually want to
redeploy them independently (e.g. a frontend content update to the demo
site without touching the aunt's backend). The frontend's final stage
serves its Vite build via `nginx:alpine`.

## The default `docker-compose.yml` uses SQLite; Postgres is a documented, opt-in alternative

Freezeflow is a single-operator home tool. A self-hosted deployment is far
more likely to want one SQLite file to back up than a second database
service to run, secure, and back up in lockstep. What actually needs to be
true for a real deployment is that the app *can* run against Postgres
without breaking — not that it defaults to it. `backend/app/database/session.py`
already gates its one SQLite-specific `connect_args` value behind a dialect
check (mirroring the existing `PRAGMA foreign_keys` listener), so
`FREEZEFLOW_DATABASE_URL` can point at Postgres and the app will not break
on that alone. A Postgres driver is available as an optional dependency
group (`backend/pyproject.toml`), not a required one, so the default
install stays lean for the common case.

## CORS origins are one comma-separated, env-driven setting

`Settings.cors_allowed_origins` replaces the hardcoded two-origin list, read
as a plain comma-separated string (not JSON) and split at startup — the
same plain-scalar-field convention every other `Settings` field already
uses. This is the concrete mechanism that makes two isolated deployments
possible: each instance's own `.env` lists only its own frontend origin, so
the aunt's instance and a future public demo instance never need to know
about each other, let alone share configuration.

## What this milestone does not do

It does not provision hosting, does not stand up the second (public demo)
deployment, and does not add any concept of multi-tenancy, per-instance
feature flags, or demo-data seeding/reset inside the app. Those are real
future decisions — this ADR only makes sure nothing about today's
architecture (a hardcoded origin list, a SQLite-only assumption, no
containerization at all) would block making them later.

---

# Alternatives Considered

* **Default `docker-compose.yml` to Postgres**, to force-exercise the
  portability fix on every local run. Rejected: the fix that actually
  retires the "untested against Postgres" risk is the `connect_args` gate
  itself, not which database compose happens to default to. Defaulting to
  Postgres would add a second service, a driver dependency, and a second
  thing to back up to every user's default path, for a benefit few
  single-operator deployments will ever need. Postgres stays fully
  supported and documented, just not forced onto the common case.
* **One combined Dockerfile for both services.** Rejected: backend and
  frontend have unrelated runtimes (Python vs. a static Node build served by
  nginx) and, per the two-deployment goal, may want independent build/deploy
  cadences later. Two focused Dockerfiles are simpler individually than one
  Dockerfile branching on a build arg.
* **Committing to a specific cloud platform now** (e.g. Fly.io, Render).
  Rejected: no deployment exists today, and picking a vendor before the app
  is even containerized would tie an early decision to a vendor's specific
  deploy model before it's clear which one actually fits the aunt-instance
  vs. public-demo split. Docker keeps that choice open.
* **Building the two-deployment split itself in this milestone** (actually
  standing up a public demo instance with seeded/reset-able data). Rejected
  as out of scope for "production readiness" — that's a real feature
  (demo-data lifecycle, its own hosting decision) better scoped on its own
  once the app is containerized and configurable enough to make it
  straightforward, which is exactly what this ADR delivers.

---

# Consequences

* A real deployment must set `FREEZEFLOW_CORS_ALLOWED_ORIGINS` to its own
  frontend origin(s); the hardcoded-localhost default only works for local
  dev, matching today's actual behavior exactly when unset.
* Anyone who wants Postgres installs the optional `postgres` dependency
  group and sets `FREEZEFLOW_DATABASE_URL` accordingly; nothing else in the
  app needs to change.
* The eventual public demo deployment is a separate future decision (its
  own `.env`, its own data store, its own demo-data lifecycle) — this ADR
  does not resolve it, only removes the architectural blockers that would
  have made it harder later.
