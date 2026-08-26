# Feedback

## Purpose

Feedback is an operator-submitted report — a bug, confusing behavior, an
improvement idea, a feature request, or a question — captured from inside
the app in under 30 seconds, without a phone call. Freezeflow automatically
gathers as much technical context as possible (current page, whichever
Production Batch/Tray/Package/Freeze Dryer the operator was viewing, browser
information, and a short history of the operator's recent actions) so the
developer can often understand and reproduce an issue without needing to ask
for it.

# Fields

| Field | Required | Notes |
| --- | --- | --- |
| id | Yes | Stable UUID |
| category | Yes | Bug, Confusing, Improvement, Feature Request, or Question |
| description | Yes | Free text describing what happened |
| page | No | The application route the operator was on |
| contextJson | No | Auto-captured context — entity ids derivable from the URL, browser information, recent action history (see ADR-0020) |
| attachments | No | Stored filenames of any uploaded screenshots/photos, empty by default |
| status | Yes | New, Reviewed, Fixed, or Closed — defaults to New |
| submittedAt | Yes | When the report was submitted |

# Behavior

Feedback is deliberately unlinked from every other entity in the data
model — no foreign key into Production Batches, Trays, Packages, or Freeze
Dryers. Whatever entity context matters is captured as data inside
`contextJson`/`page` at submission time, since a Feedback report is a
point-in-time snapshot of what the operator was looking at, not something
that should stay live-joined to a record that might later change or be
deleted.

Feedback is always persisted before any notification is attempted (FB-001).
A submission never fails or is lost because an email notification failed to
send — the row exists first, independent of whether the developer was ever
successfully notified about it.

Status is set once, automatically, to New at submission and is otherwise
managed entirely by the developer, outside the operator-facing app. No
operator-facing UI reads or changes `status`.

Attachments are stored on local disk, not the database. `attachments` holds
only the stored filenames; the files themselves live under a configured
upload directory and are never served back over HTTP in the initial
implementation (see ADR-0020) — they reach the developer as email
attachments on the notification sent for that submission.
