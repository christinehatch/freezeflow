# Feedback & Support System

## Status

Complete.

All architecture and scope decisions below were resolved in authoritative
documentation (this file, `docs/09-api-design.md`, `docs/04-business-rules.md`,
`docs/08-data-model.md`, `docs/persistence/20-feedback.md`, and new
ADR-0020) before implementation began, per AGENTS.md's documentation-first
process. Implementation proceeded in five phases: documentation, backend
entity/migration/config, backend endpoint and email, frontend action
logging, and the Send Feedback button/modal. All five phases have merged;
every item in the Definition of Done below has been verified, including a
full manual end-to-end pass against the live dev server.

This is deliberately **not** a numbered Milestone — see "Standalone
Features" in `docs/implementation/README.md`. It doesn't extend the
production/inventory workflow the Milestone sequence is organized around;
it's a support channel that sits alongside the whole app.

---

# Goal

Give the operator a way to report a bug, confusing behavior, an
improvement idea, a feature request, or a question in under 30 seconds,
without leaving the app or making a phone call — while Freezeflow
automatically captures enough technical context that most issues can be
understood and reproduced without asking for it.

---

# Objectives

Implement:

* a "Send Feedback" button visible on every page
* a category (Bug / Confusing / Improvement / Feature Request / Question),
  description, and optional photo/screenshot attachment
* automatic capture of the current page, whichever Production
  Batch/Tray/Package/Freeze Dryer is derivable from the URL, browser
  information, and a short history of the operator's recent actions
* a `Feedback` entity, persisted before anything else happens
* a best-effort email notification to the developer after each submission

---

# Scope

Feedback & Support includes:

* `POST /api/v1/feedback`, accepting multipart form data with optional
  image attachments
* the `Feedback` entity and its migration
* a frontend action log covering every real API call and every page
  navigation, attached as context to each submission
* a global "Send Feedback" modal, reachable from any page

---

# Out of Scope

Do not include:

* a feedback-management admin UI, or any `GET`/`PATCH` endpoint to support
  one — the `status` column exists on the model, defaulting to New, ready
  for a later phase, but nothing reads or writes it yet beyond that default
* screenshot annotation or automatic screenshot capture
* duplicate detection
* linking feedback to GitHub Issues
* notifying the operator when an issue is resolved
* searchable feedback history
* crash reporting or diagnostic log bundles
* cloud/object storage for attachments
* authentication of any kind — this app has none today, and feedback
  submission doesn't introduce the first instance of it

---

# Design Decisions

See ADR-0020 for full reasoning. Summarized:

1. **Local disk, not cloud storage, for attachments** — matches this
   app's household scale; revisit only if the deployment model changes.
2. **Feedback is persisted before notification is attempted, and
   notification failure is silently non-fatal** (FB-001) — sent via
   `BackgroundTasks` after commit, so a slow or failing SMTP provider never
   affects submission latency or success.
3. **The recent-actions log hooks one place**: `apiRequest` in
   `frontend/src/api/client.ts`, the funnel every real API call already
   passes through, using a small hand-written description table rather
   than instrumenting every existing call site individually. Page
   navigation is logged from one other place, a `useLocation()` effect in
   the shared `Layout.tsx` shell. The log is a plain module-scoped store,
   not a React Context — nothing displays it reactively; it's read once,
   on submit.
4. **Current-entity context comes only from the URL** (`useParams()`), not
   a "recently viewed" memory store. Only `/production/:batchId`,
   `/trays/:trayId`, and `/packages/:packageId` carry an id today. Freeze
   Dryer context is populated indirectly, from the already-cached
   Production Batch query, when `batchId` is present.
5. **One log entry per API call**, covering both its intent and outcome
   together (`"Failed: {label} — {message}"` on error), rather than a
   separate entry for a click and its result — a deliberate, stated
   simplification given the log only sees requests, not UI events.
6. **Attachments are capped**: image files only, max 5 per submission, max
   10 MB each.

---

# API and Persistence Expectations

* `docs/09-api-design.md`'s Feedback Endpoints section fully defines
  `POST /api/v1/feedback` — required/optional fields, validation, and
  response shape.
* `docs/persistence/20-feedback.md` and `docs/08-data-model.md`'s Feedback
  section define the entity: deliberately unlinked from every other entity
  in the data model, with `page`/`contextJson` capturing whatever mattered
  at submission time instead.
* No new authentication, no new foreign keys into existing entities.

---

# Validation Rules

Backend business logic must enforce:

* `category` and `description` are the only required fields (FB-002)
* each attachment is `image/*` and ≤10 MB; at most 5 attachments per
  submission
* a Feedback row is always created even if the notification email fails to
  send (FB-001)

---

# Testing Expectations

## Backend

* text-only submission succeeds and is persisted
* a submission with a valid image attachment is persisted and the file is
  written to disk
* an oversized or non-image attachment is rejected
* a missing `description` is a validation error
* SMTP mocked to raise on send: the Feedback row is still committed and
  the endpoint still returns success (proves FB-001 holds in practice, not
  just in the schema)
* SMTP left unconfigured: submission still succeeds

## Frontend

* the action log caps at its entry limit and drops the oldest entries
* `apiRequest` logs a plain-English entry on both success and failure
* the Feedback modal's submission builds the expected `FormData`,
  including a parseable `context_json`
* an attached file appears in the submitted `FormData`
* rendering the modal on a `/production/:batchId`-shaped route includes
  that Batch's id (and its Freeze Dryer) in context
* a successful submission shows the thank-you confirmation

---

# Deliverables

Feedback & Support deliverables are:

* documentation-first groundwork: `docs/08-data-model.md`'s Feedback
  section and enumerations, `docs/persistence/20-feedback.md`,
  `docs/04-business-rules.md`'s FB-001/FB-002, `docs/09-api-design.md`'s
  Feedback Endpoints section, new ADR-0020, and this file
* `app/models/feedback.py`, the `FeedbackCategory`/`FeedbackStatus` enums,
  and its migration
* `app/services/feedback.py` and `app/services/notifications.py`
* `app/api/feedback.py`, registered under `/api/v1/feedback`
* backend tests, including the mocked-SMTP-failure and unconfigured-SMTP
  cases proving FB-001 holds
* `frontend/src/utils/actionLog.ts` and `actionDescriptions.ts`, hooked
  into `apiRequest` and `Layout.tsx`
* `frontend/src/components/FeedbackModal.tsx` and the "Send Feedback"
  button in `Layout.tsx`
* frontend tests
* a final regression and manual-verification pass

---

# Definition of Done

Feedback & Support is complete when:

* every Design Decision above remains resolved in authoritative
  documentation
* `POST /api/v1/feedback` persists a Feedback row before any notification
  is attempted, and notification failure never fails or loses a submission
  (FB-001), verified by a test that mocks SMTP to fail
* attachments are validated (image type, size, count) and, when accepted,
  written to disk and referenced by filename from the Feedback row
* the action log covers real API calls and page navigation from the two
  hook points described above, with no existing call site individually
  modified to support it
* the Send Feedback button and modal are reachable from every page via a
  single shared instance in `Layout.tsx`
* current-entity context is correctly populated on the three routes that
  carry one, and correctly omitted elsewhere
* backend and frontend tests pass
* lint, formatting, and type checks pass
* the application was manually verified end-to-end: submitting feedback
  with and without an attachment, with and without SMTP configured, from a
  page with entity context and from one without
* no admin/status-management functionality has been introduced ahead of
  its own future phase

All Design Decisions are resolved as of this revision; see the Design
Decisions section above for where each resolution is authoritatively
documented.
