# ADR-0020 - Feedback and Support Infrastructure

# Status

Accepted

---

# Context

The Feedback & Support feature lets an operator report a bug, confusing
behavior, an improvement idea, a feature request, or a question from inside
the app, with Freezeflow automatically capturing technical context so most
issues can be understood without a phone call. Unlike every feature built so
far, it introduces three genuinely new architectural surfaces at once: this
codebase's first file upload, its first outbound email, and its first
cross-page client-side history mechanism (a short log of the operator's
recent actions, attached to a report to help reproduce what led to it).

None of these are covered by an existing ADR, and each has a real fork in
the road worth a durable, citable answer rather than a one-off choice buried
in a service file.

---

# Decision

## Attachments are stored on local disk, not cloud storage

Uploaded screenshots/photos are written to a configured directory on the
same filesystem as the SQLite database, referenced from the `Feedback` row
by filename only. At Freezeflow's household scale — one operator, occasional
reports, a handful of small images each — cloud storage would add a new
dependency and new credentials to manage for no benefit a local directory
doesn't already provide. This mirrors the reasoning ADR-0007/ADR-0018 already
apply to read-time aggregation: match the infrastructure to the actual scale
of the problem, not a scale Freezeflow doesn't operate at.

Attachments are not served back over HTTP in this implementation. They reach
the developer as real email attachments on the notification sent for that
submission — there is nothing yet that needs to redisplay one inside the
app, so no static-file-serving route exists until something does.

## Feedback is always persisted before notification is attempted, and notification failure is silently non-fatal

The `Feedback` row is committed first. Sending the developer-notification
email happens afterward, scheduled via FastAPI's `BackgroundTasks` so the
HTTP response doesn't wait on an SMTP round-trip, and any send failure is
caught and logged rather than raised. A submission is never lost because an
email provider was briefly down, misconfigured, or entirely unset — an app
with no SMTP settings configured at all still accepts every submission (see
FB-001). The notification is a best-effort convenience layered on top of a
durable write, never a precondition for one.

## The recent-actions log hooks exactly one place on the frontend

Rather than instrumenting every button/form individually, a single
plain-English description is logged from inside `apiRequest` in
`frontend/src/api/client.ts` — the one funnel every real API call in the app
already passes through — using a small hand-written `{method, path pattern}
→ label` table with a generic fallback. Page navigation is logged from one
other place, a `useLocation()` effect in the shared `Layout.tsx` shell every
route renders inside. This gives broad, low-maintenance coverage of what the
operator was doing without touching the ~50+ existing call sites across the
app, at the cost of being coarser than a hand-instrumented log would be
(e.g. a generic-CRUD update doesn't say *what* changed, just that something
did). The log itself is a plain module-scoped store, not a React Context —
nothing in the UI displays it reactively; it's only read once, when a report
is submitted.

---

# Alternatives Considered

* **Cloud object storage (S3-compatible) for attachments.** Rejected for
  v1: new credentials and a new dependency for a volume of data a local
  directory already handles comfortably. Worth revisiting only if
  Freezeflow ever moves to a deployment model where the app server's local
  disk isn't durable (see the dual-deployment plan under discussion
  separately) — not a concern this ADR needs to resolve today.
* **Synchronous email send inside the request, before responding.**
  Rejected: ties submission latency to an external SMTP provider's
  round-trip time, working against the feature's own "under 30 seconds"
  goal, and risks an unhandled exception there rolling back or failing an
  otherwise-successful submission if not carefully isolated.
* **Instrumenting every mutation call site individually to build the action
  log**, rather than hooking the shared `apiRequest` funnel once. Rejected
  as needless duplication of effort across ~50 existing call sites for
  marginal gain — the funnel already sees every real request; a future call
  site gets logging for free without remembering to add it.
* **A React Context for the action log**, so it could be displayed live
  somewhere. Rejected: nothing in this feature's scope needs the log to be
  reactive UI state — it's read once, on submit. Introducing this
  codebase's first global Context for a write-only, read-once log would be
  the wrong precedent to set.

---

# Consequences

* A new `backend/uploads/` directory (path configurable via `Settings`,
  gitignored) is created outside version control the first time an
  attachment is saved; this is expected, not a stray file to clean up.
* SMTP configuration is entirely optional. Deploying Freezeflow with no
  `.env` SMTP settings is a fully supported configuration — feedback is
  still collected, just not actively pushed to the developer's inbox.
* The action-log's coverage and phrasing live in one small, easily
  extended table (`frontend/src/utils/actionDescriptions.ts`), not scattered
  across the codebase — future report types or workflows don't need any
  change here to still show up in a submitted report's context, just a
  generic (if less specific) description until someone adds a mapping entry.
