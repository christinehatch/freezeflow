import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { auditApi, type AuditEntry } from "../api/client";
import { Modal } from "./design-system";

type AuditHistoryViewerProps = {
  entityType: string;
  entityId: string;
  title?: string;
};

/**
 * "View History" trigger + modal for one entity's Audit Entries
 * (ADR-0005). Renders each entry the way ADR-0005's own UX example
 * shows it: original value, corrected value, reason, and both the
 * observed and corrected timestamps.
 */
export function AuditHistoryViewer({
  entityType,
  entityId,
  title = "Correction History",
}: AuditHistoryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const historyQuery = useQuery({
    queryKey: ["audit-entries", entityType, entityId],
    queryFn: () => auditApi.list({ entityType, entityId }),
    enabled: isOpen,
  });

  return (
    <>
      <button
        className="quiet-action audit-history-trigger"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        View History
      </button>
      {isOpen ? (
        <Modal title={title} onClose={() => setIsOpen(false)}>
          {historyQuery.isLoading ? (
            <p className="audit-history-empty">Loading history…</p>
          ) : historyQuery.isError ? (
            <p className="audit-history-empty">
              Unable to load correction history.
            </p>
          ) : historyQuery.data && historyQuery.data.length > 0 ? (
            <ul className="audit-history-list">
              {historyQuery.data.map((entry) => (
                <AuditHistoryRow entry={entry} key={entry.id} />
              ))}
            </ul>
          ) : (
            <p className="audit-history-empty">No corrections recorded.</p>
          )}
        </Modal>
      ) : null}
    </>
  );
}

function AuditHistoryRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="audit-history-entry">
      <p className="audit-history-entry__field">
        {formatFieldName(entry.field_name)}
      </p>
      <p className="audit-history-entry__values">
        Originally entered: {formatAuditValue(entry.previous_value)}
      </p>
      <p className="audit-history-entry__values">
        Corrected: {formatAuditValue(entry.current_value)}
      </p>
      <p className="audit-history-entry__timestamps">
        {entry.observed_at
          ? `Observed ${formatDateTime(entry.observed_at)} · `
          : ""}
        Corrected {formatDateTime(entry.corrected_at)}
      </p>
      {entry.reason ? (
        <p className="audit-history-entry__reason">Reason: {entry.reason}</p>
      ) : null}
    </li>
  );
}

function formatFieldName(fieldName: string) {
  const spaced = fieldName.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatAuditValue(value: string) {
  if (value === "") return "(empty)";
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(", ");
  } catch {
    // Not JSON — display the raw value as recorded.
  }
  return value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
