import { useEffect, useRef, useState } from "react";

import type {
  PackageLabel,
  PackageLabelUpdate,
  PackageLabelValues,
} from "../api/client";

type ActionStatus =
  | "idle"
  | "saving"
  | "saved"
  | "failed"
  | "refreshing"
  | "refresh-failed";

const LABEL_FIELDS: Array<{
  field: keyof PackageLabelValues;
  label: string;
  multiline?: boolean;
}> = [
  { field: "display_name", label: "Display Name" },
  { field: "description", label: "Description", multiline: true },
  {
    field: "ingredients_summary",
    label: "Ingredients Summary",
    multiline: true,
  },
  {
    field: "preparation_summary",
    label: "Preparation Summary",
    multiline: true,
  },
  {
    field: "rehydration_instructions",
    label: "Rehydration Instructions",
    multiline: true,
  },
  { field: "serving_notes", label: "Serving Notes", multiline: true },
  { field: "net_weight_display", label: "Net Weight Display" },
];

type LabelDraft = Record<keyof PackageLabelValues, string>;

export function PlannedPackageRecordAction({
  blockers,
  formatError,
  onRecord,
  onRefresh,
  rowNumber,
}: {
  blockers: string[];
  formatError: (error: unknown) => string;
  onRecord: () => Promise<void>;
  onRefresh: () => Promise<void>;
  rowNumber: number;
}) {
  const recordInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function recordPackage() {
    if (blockers.length > 0 || recordInFlight.current) return;
    recordInFlight.current = true;
    setStatus("saving");
    setError(null);
    try {
      await onRecord();
    } catch (recordError) {
      setStatus("failed");
      setError(formatError(recordError));
      recordInFlight.current = false;
      return;
    }

    try {
      await onRefresh();
      setStatus("saved");
    } catch (refreshError) {
      setStatus("refresh-failed");
      setError(
        `The Package was recorded, but the latest operation state could not be refreshed: ${formatError(refreshError)}`,
      );
    } finally {
      recordInFlight.current = false;
    }
  }

  async function retryRefresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setStatus("refreshing");
    setError(null);
    try {
      await onRefresh();
      setStatus("saved");
    } catch (refreshError) {
      setStatus("refresh-failed");
      setError(
        `The Package was recorded, but the latest operation state could not be refreshed: ${formatError(refreshError)}`,
      );
    } finally {
      refreshInFlight.current = false;
    }
  }

  return (
    <section
      aria-label={`Planned Package ${rowNumber} recording`}
      className="mt-3 border-t border-slate-200 pt-3"
    >
      {blockers.length > 0 ? (
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Package cannot be recorded yet</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          This saved plan has the required Package information and is ready to
          become inventory.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          className="primary-action"
          disabled={
            blockers.length > 0 ||
            status === "saving" ||
            status === "refreshing" ||
            status === "refresh-failed"
          }
          type="button"
          onClick={() => void recordPackage()}
        >
          {status === "saving" ? "Recording Package…" : "Record Package"}
        </button>
        <p className="text-sm text-slate-600" role="status">
          {status === "saving"
            ? "Recording Package…"
            : status === "refreshing"
              ? "Refreshing authoritative operation state…"
              : status === "failed"
                ? "Package recording failed"
                : status === "refresh-failed"
                  ? "Package recorded; refresh required"
                  : "Not yet recorded as inventory"}
        </p>
        {status === "refresh-failed" ? (
          <button
            className="secondary-action"
            type="button"
            onClick={() => void retryRefresh()}
          >
            Retry latest state
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="error-banner mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function PackageLabelEditor({
  formatError,
  label,
  onRefresh,
  onSave,
  packageIdentifier,
}: {
  formatError: (error: unknown) => string;
  label: PackageLabel;
  onRefresh: () => Promise<PackageLabel>;
  onSave: (body: PackageLabelUpdate) => Promise<void>;
  packageIdentifier: string;
}) {
  const saveInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const previousVersion = useRef(authoritativeLabelFingerprint(label));
  const initialDraft = createLabelDraft(label);
  const [draft, setDraft] = useState<LabelDraft>(initialDraft);
  const [baseline, setBaseline] = useState(() =>
    labelFingerprint(initialDraft),
  );
  const [authoritativeStatus, setAuthoritativeStatus] = useState(label.status);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = labelFingerprint(draft) !== baseline;
  const displayNameMissing = draft.display_name.trim() === "";
  const saveDisabled =
    !dirty ||
    displayNameMissing ||
    status === "saving" ||
    status === "refreshing" ||
    status === "refresh-failed";

  useEffect(() => {
    const nextVersion = authoritativeLabelFingerprint(label);
    if (previousVersion.current === nextVersion) return;
    applyAuthoritativeLabel(label);
  }, [label]);

  function applyAuthoritativeLabel(authoritativeLabel: PackageLabel) {
    previousVersion.current = authoritativeLabelFingerprint(authoritativeLabel);
    const nextDraft = createLabelDraft(authoritativeLabel);
    setDraft(nextDraft);
    setBaseline(labelFingerprint(nextDraft));
    setAuthoritativeStatus(authoritativeLabel.status);
  }

  function updateField(field: keyof PackageLabelValues, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus("idle");
    setError(null);
  }

  async function saveLabel() {
    if (saveDisabled || saveInFlight.current) return;
    saveInFlight.current = true;
    setStatus("saving");
    setError(null);
    try {
      await onSave(serializeLabelDraft(draft));
    } catch (saveError) {
      setStatus("failed");
      setError(formatError(saveError));
      saveInFlight.current = false;
      return;
    }

    try {
      const authoritativeLabel = await onRefresh();
      applyAuthoritativeLabel(authoritativeLabel);
      setStatus("saved");
    } catch (refreshError) {
      setStatus("refresh-failed");
      setError(
        `The Package Label was saved, but the latest operation state could not be refreshed: ${formatError(refreshError)}`,
      );
    } finally {
      saveInFlight.current = false;
    }
  }

  async function retryRefresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setStatus("refreshing");
    setError(null);
    try {
      const authoritativeLabel = await onRefresh();
      applyAuthoritativeLabel(authoritativeLabel);
      setStatus("saved");
    } catch (refreshError) {
      setStatus("refresh-failed");
      setError(
        `The Package Label was saved, but the latest operation state could not be refreshed: ${formatError(refreshError)}`,
      );
    } finally {
      refreshInFlight.current = false;
    }
  }

  return (
    <section
      aria-label={`${packageIdentifier} Package Label editor`}
      className="mt-3 border-t border-slate-200 pt-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h6 className="text-sm font-semibold">Edit Package Label</h6>
          <p className="mt-1 text-sm text-slate-600">
            Label status: <strong>{authoritativeStatus}</strong>. The backend
            determines Ready and Needs Reprint when this label is saved.
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Fresh Equivalent:{" "}
            <strong>{label.fresh_equivalent_display ?? "Not available"}</strong>
            . Calculated automatically from source Tray weights.
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Package Identifier and Packaging Date remain authoritative Package
          facts.
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {LABEL_FIELDS.map(({ field, label: fieldLabel, multiline }) => (
          <label className="field" key={field}>
            <span>{fieldLabel}</span>
            {multiline ? (
              <textarea
                aria-label={`${packageIdentifier} Label ${fieldLabel}`}
                rows={3}
                value={draft[field]}
                onChange={(event) => updateField(field, event.target.value)}
              />
            ) : (
              <input
                aria-label={`${packageIdentifier} Label ${fieldLabel}`}
                value={draft[field]}
                onChange={(event) => updateField(field, event.target.value)}
              />
            )}
            {field === "display_name" && displayNameMissing ? (
              <span className="text-sm text-red-700">
                Display Name is required.
              </span>
            ) : null}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="primary-action"
          disabled={saveDisabled}
          type="button"
          onClick={() => void saveLabel()}
        >
          {status === "saving" ? "Saving Package Label…" : "Save Package Label"}
        </button>
        <p className="text-sm text-slate-600" role="status">
          {status === "saving"
            ? "Saving Package Label…"
            : status === "refreshing"
              ? "Refreshing authoritative operation state…"
              : status === "saved"
                ? "Package Label saved"
                : status === "failed"
                  ? "Package Label save failed"
                  : status === "refresh-failed"
                    ? "Package Label saved; refresh required"
                    : dirty
                      ? "Unsaved Package Label changes"
                      : "No unsaved Package Label changes"}
        </p>
        {status === "refresh-failed" ? (
          <button
            className="secondary-action"
            type="button"
            onClick={() => void retryRefresh()}
          >
            Retry latest state
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="error-banner mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function createLabelDraft(label: PackageLabel): LabelDraft {
  return {
    display_name: label.display_name ?? "",
    description: label.description ?? "",
    ingredients_summary: label.ingredients_summary ?? "",
    preparation_summary: label.preparation_summary ?? "",
    rehydration_instructions: label.rehydration_instructions ?? "",
    serving_notes: label.serving_notes ?? "",
    net_weight_display: label.net_weight_display ?? "",
  };
}

function serializeLabelDraft(draft: LabelDraft): PackageLabelUpdate {
  return {
    display_name: draft.display_name.trim(),
    description: optionalText(draft.description),
    ingredients_summary: optionalText(draft.ingredients_summary),
    preparation_summary: optionalText(draft.preparation_summary),
    rehydration_instructions: optionalText(draft.rehydration_instructions),
    serving_notes: optionalText(draft.serving_notes),
    net_weight_display: optionalText(draft.net_weight_display),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function labelFingerprint(draft: LabelDraft) {
  return JSON.stringify(draft);
}

function authoritativeLabelFingerprint(label: PackageLabel) {
  return JSON.stringify({
    id: label.id,
    status: label.status,
    updatedAt: label.updated_at,
    draft: createLabelDraft(label),
    printEvents: label.print_events.map((event) => ({
      id: event.id,
      printedAt: event.printed_at,
      recordedAt: event.recorded_at,
      printJobId: event.print_job_id,
    })),
  });
}
