# ADR-0015 - Packaging Workflow Flexibility

# Status

Accepted

---

# Context

Operators may fill, weigh, label, print, and store Packages in different physical
orders. Enforcing one click sequence would add friction without improving
traceability.

---

# Decision

Freezeflow models the required final Packaging state rather than enforcing a
single physical workflow. Operators may package, weigh, prepare labels, and
print in the order that fits their work, provided all required information is
captured before the Packaging Operation is explicitly completed.

The interface guides the next useful action but does not claim that software
entry order is the physical order of work.

---

# Consequences

* Packaging Operations are resumable.
* Label printing is independent of Package recording order.
* Validation is concentrated at meaningful business transitions.
* History and traceability remain mandatory even when action order is flexible.
