# ADR-0012 - Package Status History

# Status

Accepted

---

# Context

A Package stores one current Inventory Status so daily Inventory views can quickly determine whether it is available.

The current value alone does not explain when the Package entered Inventory or when it later became Given Away or Depleted. Freezeflow must preserve that lifecycle without inferring history from the Package's current state.

The status history design must also support delayed data entry. A user may record an event after it happened, so the time the event took effect is distinct from the time it was entered into Freezeflow.

---

# Decision

Freezeflow records Package lifecycle transitions in an append-only entity named **Package Status History**.

Every Package has:

* one current Inventory Status on the Package
* one or more Package Status History records explaining how it reached that status

Creating a Package automatically creates its initial Package Status History record with status In Storage.

Every later status transition:

* updates the Package's current Inventory Status
* appends one Package Status History record
* occurs in the same database transaction

The Package's current Inventory Status must match the most recently recorded status transition.

---

# Recorded Information

Each Package Status History record contains:

* Package
* Previous Status, null for initial Package creation
* Current Status
* Effective Time
* Recorded Time
* Optional Notes

The Effective Time represents when the real-world event occurred. It defaults to the current time but may be supplied by the user when recording the transition.

The Recorded Time is assigned by the system when the history record is created. It preserves when Freezeflow received the information.

Optional Notes preserve useful context without introducing Recipient, Gift, Consumption, or Disposal entities.

Examples include:

* Gift for Mary
* Camping trip
* Made soup
* Expired after seal failure

---

# Initial Status

Package creation automatically records:

```text
Previous Status: null
Current Status: In Storage
Effective Time: Package packagedAt
Recorded Time: Package creation time
```

The initial record is the beginning of the Package's Inventory lifecycle.

---

# Allowed Transitions

Package Status History uses only the Package lifecycle states accepted in ADR-0004:

```text
In Storage
    |
    +--> Given Away
    |
    +--> Depleted
```

Given Away and Depleted are terminal states.

No additional statuses such as Consumed, Gifted, Sold, Expired, Thrown Away, or Correction are introduced. Optional Notes explain the real-world context.

---

# Append-Only History

Package Status History records are immutable historical events.

They are never edited or deleted.

An incorrect lifecycle action is handled through the correction and audit policy in ADR-0005. Correction is not a Package Inventory Status, and corrections do not silently erase or rewrite prior Package Status History.

Milestone 5 does not provide a workflow for reopening Given Away or Depleted Packages.

---

# User Experience

Status actions default the Effective Time to the current time and allow the user to change it before confirming the action.

Status actions also accept optional Notes.

Package Details displays the current Inventory Status prominently and presents Package Status History as a secondary chronological timeline.

---

# Alternatives Considered

## Store only the current status

Rejected because the system could not explain when the Package entered or left active Inventory.

## Use Audit Entries as the status timeline

Rejected because status transitions are first-class Inventory events, while Audit Entries describe corrections.

## Add separate Recipient or Consumption entities

Rejected because they add administrative structure that is not required by the user's workflow. Optional Notes preserve the needed context.

## Add more terminal statuses

Rejected because In Storage, Given Away, and Depleted cover the required lifecycle while Notes preserve specific reasons.

---

# Consequences

## Benefits

* Complete Package lifecycle traceability.
* Accurate historical event times despite delayed data entry.
* Simple current-state Inventory queries.
* Context can be preserved without unnecessary entities.
* Status transitions align with Storage Location History and Audit History.

## Tradeoffs

* Each Package creates at least one additional historical record.
* Status commands must update current state and append history atomically.
* Corrections require the separate audit process rather than editing history directly.

These tradeoffs are acceptable because preserving history and traceability are core Freezeflow principles.
