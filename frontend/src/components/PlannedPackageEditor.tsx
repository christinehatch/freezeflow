import { useEffect, useRef, useState } from "react";

import type {
  PackageType,
  PlannedPackageInput,
  PlannedPackageRow,
  StorageLocation,
} from "../api/client";
import {
  ALLOCATION_TOLERANCE_GRAMS,
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  toGrams,
} from "../utils/weights";

type DraftTextField = keyof Pick<
  PlannedPackageInput,
  | "notes"
  | "label_display_name"
  | "label_description"
  | "label_ingredients_summary"
  | "label_preparation_summary"
  | "label_rehydration_instructions"
  | "label_serving_notes"
  | "label_net_weight_display"
  | "label_fresh_equivalent_display"
>;

type PlannedPackageDraft = {
  key: string;
  persistedId?: string;
  recordedPackageId?: string;
  package_type_id: string;
  finished_product_weight_value: string;
  finished_product_weight_unit: string;
  sealed_package_weight_value: string;
  sealed_package_weight_unit: string;
  oxygen_absorber: string;
  storage_location_id: string;
  notes: string;
  label_display_name: string;
  label_description: string;
  label_ingredients_summary: string;
  label_preparation_summary: string;
  label_rehydration_instructions: string;
  label_serving_notes: string;
  label_net_weight_display: string;
  label_fresh_equivalent_display: string;
};

type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "failed"
  | "refreshing"
  | "refresh-failed";

export type PlannedPackageProjection = {
  allocationId: string;
  balanceState: "Balanced" | "Remaining" | "Overallocated" | "Incomplete";
  dirty: boolean;
  locallyValid: boolean;
  projectedAllocatedWeightGrams: number | null;
  projectedRemainingWeightGrams: number | null;
};

const LABEL_FIELDS: Array<{
  field: DraftTextField;
  label: string;
  multiline?: boolean;
}> = [
  { field: "label_display_name", label: "Label Display Name" },
  { field: "label_description", label: "Label Description", multiline: true },
  {
    field: "label_ingredients_summary",
    label: "Ingredients Summary",
    multiline: true,
  },
  {
    field: "label_preparation_summary",
    label: "Preparation Summary",
    multiline: true,
  },
  {
    field: "label_rehydration_instructions",
    label: "Rehydration Instructions",
    multiline: true,
  },
  { field: "label_serving_notes", label: "Serving Notes", multiline: true },
  { field: "label_net_weight_display", label: "Net Weight Display" },
  {
    field: "label_fresh_equivalent_display",
    label: "Fresh Equivalent Display",
  },
];

const SUPPORTED_WEIGHT_UNITS = new Set(
  WEIGHT_UNIT_OPTIONS.map((option) => option.value),
);

export function PlannedPackageEditor({
  allocationId,
  allocationNumber,
  authoritativeVersion,
  formatError,
  onProjectionChange,
  onRefresh,
  onSave,
  packageTypes,
  plannedPackages,
  recordedFinishedProductWeightGrams,
  selectedWeightGrams,
  storageLocations,
}: {
  allocationId: string;
  allocationNumber: number;
  authoritativeVersion: string;
  formatError: (error: unknown) => string;
  onProjectionChange: (projection: PlannedPackageProjection) => void;
  onRefresh: () => Promise<PlannedPackageRow[]>;
  onSave: (plannedPackages: PlannedPackageInput[]) => Promise<void>;
  packageTypes: PackageType[];
  plannedPackages: PlannedPackageRow[];
  recordedFinishedProductWeightGrams: number | null;
  selectedWeightGrams: number | null;
  storageLocations: StorageLocation[];
}) {
  const nextDraftNumber = useRef(0);
  const saveInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const initialRows = plannedPackages.map(createDraftFromSavedRow);
  const [rows, setRows] = useState<PlannedPackageDraft[]>(initialRows);
  const [savedBaseline, setSavedBaseline] = useState(() =>
    draftFingerprint(initialRows),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const previousAuthoritativeVersion = useRef(authoritativeVersion);
  const dirty = draftFingerprint(rows) !== savedBaseline;
  const hasRecordedRows = rows.some((row) => row.recordedPackageId);
  const editableRowsValid = rows
    .filter((row) => !row.recordedPackageId)
    .every(
      (row) =>
        getRowState(row, packageTypes, storageLocations).label ===
        "Ready to save",
    );
  const projectedPlannedWeightGrams = rows
    .filter((row) => !row.recordedPackageId)
    .reduce((total, row) => {
      const unit = row.finished_product_weight_unit as WeightUnit;
      const grams = Number(toGrams(row.finished_product_weight_value, unit));
      return Number.isFinite(grams) && grams > 0 ? total + grams : total;
    }, 0);
  const authoritativeWeightsAvailable =
    selectedWeightGrams !== null &&
    Number.isFinite(selectedWeightGrams) &&
    recordedFinishedProductWeightGrams !== null &&
    Number.isFinite(recordedFinishedProductWeightGrams);
  const locallyValid = editableRowsValid && authoritativeWeightsAvailable;
  const projectedAllocatedWeightGrams = authoritativeWeightsAvailable
    ? recordedFinishedProductWeightGrams + projectedPlannedWeightGrams
    : null;
  const projectedRemainingWeightGrams =
    projectedAllocatedWeightGrams === null || selectedWeightGrams === null
      ? null
      : selectedWeightGrams - projectedAllocatedWeightGrams;
  const balanceState = getBalanceState(
    projectedRemainingWeightGrams,
    locallyValid,
  );
  const persistenceBlocked = hasRecordedRows;
  const saveDisabled =
    !dirty ||
    !editableRowsValid ||
    persistenceBlocked ||
    balanceState === "Overallocated" ||
    saveStatus === "saving" ||
    saveStatus === "refreshing";

  useEffect(() => {
    onProjectionChange({
      allocationId,
      balanceState,
      dirty,
      locallyValid,
      projectedAllocatedWeightGrams,
      projectedRemainingWeightGrams,
    });
  }, [
    allocationId,
    balanceState,
    dirty,
    locallyValid,
    onProjectionChange,
    projectedAllocatedWeightGrams,
    projectedRemainingWeightGrams,
  ]);

  useEffect(() => {
    if (previousAuthoritativeVersion.current === authoritativeVersion) return;
    previousAuthoritativeVersion.current = authoritativeVersion;
    const authoritativeRows = plannedPackages.map(createDraftFromSavedRow);
    setRows(authoritativeRows);
    setSavedBaseline(draftFingerprint(authoritativeRows));
    setSaveError(null);
    setSaveStatus((current) =>
      current === "saving" || current === "saved" || current === "refreshing"
        ? current
        : "idle",
    );
  }, [authoritativeVersion, plannedPackages]);

  function markChanged(
    update: (current: PlannedPackageDraft[]) => PlannedPackageDraft[],
  ) {
    setRows(update);
    setSaveStatus("idle");
    setSaveError(null);
  }

  function addRow() {
    nextDraftNumber.current += 1;
    markChanged((current) => [
      ...current,
      createEmptyDraft(
        `draft:${allocationId}:${nextDraftNumber.current.toString()}`,
      ),
    ]);
  }

  function updateRow(rowKey: string, values: Partial<PlannedPackageDraft>) {
    markChanged((current) =>
      current.map((row) =>
        row.key === rowKey && !row.recordedPackageId
          ? { ...row, ...values }
          : row,
      ),
    );
  }

  function updatePackageType(row: PlannedPackageDraft, packageTypeId: string) {
    const previousPackageType = packageTypes.find(
      (packageType) => packageType.id === row.package_type_id,
    );
    const nextPackageType = packageTypes.find(
      (packageType) => packageType.id === packageTypeId,
    );
    const shouldApplyDefault =
      row.oxygen_absorber.trim() === "" ||
      row.oxygen_absorber ===
        (previousPackageType?.default_oxygen_absorber ?? "");
    updateRow(row.key, {
      package_type_id: packageTypeId,
      oxygen_absorber: shouldApplyDefault
        ? (nextPackageType?.default_oxygen_absorber ?? "")
        : row.oxygen_absorber,
    });
  }

  function removeRow(rowKey: string) {
    markChanged((current) =>
      current.filter(
        (row) => row.key !== rowKey || Boolean(row.recordedPackageId),
      ),
    );
  }

  async function saveRows() {
    if (saveDisabled || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      await onSave(
        rows
          .filter((row) => !row.recordedPackageId)
          .map(serializePlannedPackageDraft),
      );
    } catch (error) {
      setSaveStatus("failed");
      setSaveError(formatError(error));
      saveInFlight.current = false;
      return;
    }

    try {
      const authoritativeRows = await onRefresh();
      applyAuthoritativeRows(authoritativeRows);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("refresh-failed");
      setSaveError(
        `Planned Packages were saved, but the latest operation state could not be refreshed: ${formatError(error)}`,
      );
    } finally {
      saveInFlight.current = false;
    }
  }

  async function retryRefresh() {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setSaveStatus("refreshing");
    setSaveError(null);
    try {
      const authoritativeRows = await onRefresh();
      applyAuthoritativeRows(authoritativeRows);
      setSaveStatus("saved");
    } catch (error) {
      setSaveStatus("refresh-failed");
      setSaveError(
        `Planned Packages were saved, but the latest operation state could not be refreshed: ${formatError(error)}`,
      );
    } finally {
      refreshInFlight.current = false;
    }
  }

  function applyAuthoritativeRows(authoritativeRows: PlannedPackageRow[]) {
    const nextRows = authoritativeRows.map(createDraftFromSavedRow);
    setRows(nextRows);
    setSavedBaseline(draftFingerprint(nextRows));
  }

  return (
    <section
      aria-label={`Allocation ${allocationNumber} Planned Packages editor`}
      className="mt-4 border-t border-slate-200 pt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h6 className="text-sm font-semibold">Planned Packages</h6>
          <p className="mt-1 text-sm text-slate-600">
            Edit the Package plan for this Allocation. Backend-saved rows remain
            visible in the summary above until the authoritative operation state
            refreshes.
          </p>
        </div>
        <button className="secondary-action" type="button" onClick={addRow}>
          Add Planned Package
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          No planned Packages have been added to this Allocation.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <PlannedPackageDraftRow
              allocationNumber={allocationNumber}
              key={row.key}
              onPackageTypeChange={(packageTypeId) =>
                updatePackageType(row, packageTypeId)
              }
              onRemove={() => removeRow(row.key)}
              onUpdate={(values) => updateRow(row.key, values)}
              packageTypes={packageTypes}
              row={row}
              rowNumber={index + 1}
              storageLocations={storageLocations}
            />
          ))}
        </div>
      )}

      {dirty ? (
        <ProjectedWeightSummary
          allocationNumber={allocationNumber}
          balanceState={balanceState}
          locallyValid={locallyValid}
          projectedAllocatedWeightGrams={projectedAllocatedWeightGrams}
          projectedRemainingWeightGrams={projectedRemainingWeightGrams}
        />
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          aria-label={`Save Allocation ${allocationNumber} Planned Packages`}
          className="primary-action"
          disabled={saveDisabled}
          type="button"
          onClick={() => void saveRows()}
        >
          {saveStatus === "saving" ? "Saving…" : "Save Planned Packages"}
        </button>
        <p className="text-sm text-slate-600" role="status">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "refreshing"
              ? "Refreshing authoritative operation state…"
              : saveStatus === "saved"
                ? "Planned Packages saved"
                : saveStatus === "failed"
                  ? "Save failed"
                  : dirty
                    ? "Unsaved changes"
                    : "No unsaved changes"}
        </p>
        {saveStatus === "refresh-failed" ? (
          <button
            className="secondary-action"
            type="button"
            onClick={() => void retryRefresh()}
          >
            Retry latest state
          </button>
        ) : null}
      </div>

      {persistenceBlocked ? (
        <p className="mt-3 text-sm text-amber-900">
          Planned Package saving is unavailable for this Allocation because its
          recorded Package history cannot be reconciled safely by the current
          Allocation update contract.
        </p>
      ) : null}

      {saveError ? (
        <p className="error-banner mt-3" role="alert">
          {saveError}
        </p>
      ) : null}
    </section>
  );
}

function ProjectedWeightSummary({
  allocationNumber,
  balanceState,
  locallyValid,
  projectedAllocatedWeightGrams,
  projectedRemainingWeightGrams,
}: {
  allocationNumber: number;
  balanceState: PlannedPackageProjection["balanceState"];
  locallyValid: boolean;
  projectedAllocatedWeightGrams: number | null;
  projectedRemainingWeightGrams: number | null;
}) {
  return (
    <section
      aria-label={`Allocation ${allocationNumber} projected weight totals`}
      className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3"
    >
      <h6 className="text-sm font-semibold">Projected unsaved totals</h6>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">
            Projected Allocated Weight
          </p>
          <p className="mt-1 font-semibold">
            {projectedAllocatedWeightGrams === null
              ? "Unavailable"
              : formatGrams(String(projectedAllocatedWeightGrams), 3)}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-600">
            Projected Remaining Weight
          </p>
          <p className="mt-1 font-semibold">
            {projectedRemainingWeightGrams === null
              ? "Unavailable"
              : formatGrams(String(projectedRemainingWeightGrams), 3)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold" role="status">
        {getProjectedBalanceMessage(
          balanceState,
          locallyValid,
          projectedRemainingWeightGrams,
        )}
      </p>
    </section>
  );
}

function PlannedPackageDraftRow({
  allocationNumber,
  onPackageTypeChange,
  onRemove,
  onUpdate,
  packageTypes,
  row,
  rowNumber,
  storageLocations,
}: {
  allocationNumber: number;
  onPackageTypeChange: (packageTypeId: string) => void;
  onRemove: () => void;
  onUpdate: (values: Partial<PlannedPackageDraft>) => void;
  packageTypes: PackageType[];
  row: PlannedPackageDraft;
  rowNumber: number;
  storageLocations: StorageLocation[];
}) {
  const readOnly = Boolean(row.recordedPackageId);
  const state = getRowState(row, packageTypes, storageLocations);
  const fieldPrefix = `Allocation ${allocationNumber} Planned Package ${rowNumber}`;
  const missingPackageTypeReference =
    row.package_type_id !== "" &&
    !packageTypes.some((packageType) => packageType.id === row.package_type_id);
  const missingStorageLocationReference =
    row.storage_location_id !== "" &&
    !storageLocations.some(
      (storageLocation) => storageLocation.id === row.storage_location_id,
    );

  return (
    <article
      aria-label={`${fieldPrefix} pending editor`}
      className="rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h6 className="font-semibold">Pending Planned Package {rowNumber}</h6>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            {readOnly ? "Recorded Package created" : state.label}
          </p>
          {row.persistedId && !readOnly ? (
            <p className="mt-1 text-xs text-slate-500">
              Editing a backend-saved planned row. Changes remain local until
              saved.
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <button
            aria-label={`Remove ${fieldPrefix}`}
            className="quiet-action"
            type="button"
            onClick={onRemove}
          >
            Remove Planned Package
          </button>
        ) : (
          <p className="text-sm text-slate-600">
            Preserved as read-only production history.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="field">
          <span>Package Type</span>
          <select
            aria-label={`${fieldPrefix} Package Type`}
            disabled={readOnly}
            value={row.package_type_id}
            onChange={(event) => onPackageTypeChange(event.target.value)}
          >
            <option value="">Select Package Type</option>
            {missingPackageTypeReference ? (
              <option value={row.package_type_id}>
                Package Type unavailable
              </option>
            ) : null}
            {packageTypes.map((packageType) => (
              <option key={packageType.id} value={packageType.id}>
                {packageType.name}
              </option>
            ))}
          </select>
          {packageTypes.length === 0 ? (
            <span className="text-sm text-amber-800">
              No active Package Types are available.
            </span>
          ) : null}
        </label>

        <WeightField
          fieldPrefix={fieldPrefix}
          label="Finished Product Weight"
          onUnitChange={(unit) =>
            onUpdate({ finished_product_weight_unit: unit })
          }
          onValueChange={(value) =>
            onUpdate({ finished_product_weight_value: value })
          }
          readOnly={readOnly}
          unit={row.finished_product_weight_unit}
          value={row.finished_product_weight_value}
        />

        <WeightField
          fieldPrefix={fieldPrefix}
          label="Sealed Package Weight"
          onUnitChange={(unit) =>
            onUpdate({ sealed_package_weight_unit: unit })
          }
          onValueChange={(value) =>
            onUpdate({ sealed_package_weight_value: value })
          }
          readOnly={readOnly}
          unit={row.sealed_package_weight_unit}
          value={row.sealed_package_weight_value}
        />

        <label className="field">
          <span>Oxygen Absorber</span>
          <input
            aria-label={`${fieldPrefix} Oxygen Absorber`}
            disabled={readOnly}
            value={row.oxygen_absorber}
            onChange={(event) =>
              onUpdate({ oxygen_absorber: event.target.value })
            }
          />
        </label>

        <label className="field">
          <span>Storage Location</span>
          <select
            aria-label={`${fieldPrefix} Storage Location`}
            disabled={readOnly}
            value={row.storage_location_id}
            onChange={(event) =>
              onUpdate({ storage_location_id: event.target.value })
            }
          >
            <option value="">No Storage Location</option>
            {missingStorageLocationReference ? (
              <option value={row.storage_location_id}>
                Storage Location unavailable
              </option>
            ) : null}
            {storageLocations.map((storageLocation) => (
              <option key={storageLocation.id} value={storageLocation.id}>
                {storageLocation.name}
              </option>
            ))}
          </select>
          {storageLocations.length === 0 ? (
            <span className="text-sm text-amber-800">
              No active Storage Locations are available.
            </span>
          ) : null}
        </label>

        <label className="field">
          <span>Package Notes</span>
          <input
            aria-label={`${fieldPrefix} Package Notes`}
            disabled={readOnly}
            value={row.notes}
            onChange={(event) => onUpdate({ notes: event.target.value })}
          />
        </label>
      </div>

      {!readOnly && state.messages.length > 0 ? (
        <ul
          aria-label={`${fieldPrefix} validation`}
          className="mt-3 space-y-1 text-sm text-amber-900"
        >
          {state.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <details className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Package Label Details
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {LABEL_FIELDS.map(({ field, label, multiline }) => {
            const sharedProps = {
              "aria-label": `${fieldPrefix} ${label}`,
              disabled: readOnly,
              value: row[field],
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) => onUpdate({ [field]: event.target.value }),
            };
            return (
              <label className="field" key={field}>
                <span>{label}</span>
                {multiline ? (
                  <textarea {...sharedProps} rows={2} />
                ) : (
                  <input {...sharedProps} />
                )}
              </label>
            );
          })}
        </div>
      </details>
    </article>
  );
}

function WeightField({
  fieldPrefix,
  label,
  onUnitChange,
  onValueChange,
  readOnly,
  unit,
  value,
}: {
  fieldPrefix: string;
  label: string;
  onUnitChange: (unit: string) => void;
  onValueChange: (value: string) => void;
  readOnly: boolean;
  unit: string;
  value: string;
}) {
  const unsupportedUnit = !SUPPORTED_WEIGHT_UNITS.has(
    unit as "g" | "oz" | "lb",
  );
  return (
    <div className="field">
      <span>{label}</span>
      <div className="flex gap-2">
        <input
          aria-label={`${fieldPrefix} ${label}`}
          className="min-w-0 flex-1"
          disabled={readOnly}
          min="0"
          step="any"
          type="number"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <select
          aria-label={`${fieldPrefix} ${label} Unit`}
          className="w-20"
          disabled={readOnly}
          value={unit}
          onChange={(event) => onUnitChange(event.target.value)}
        >
          {unsupportedUnit ? <option value={unit}>{unit}</option> : null}
          {WEIGHT_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function getRowState(
  row: PlannedPackageDraft,
  packageTypes: PackageType[],
  storageLocations: StorageLocation[],
) {
  if (row.recordedPackageId) {
    return { label: "Recorded Package created", messages: [] };
  }
  const empty = isEmptyDraft(row);
  const messages: string[] = [];
  const packageTypeUnavailable =
    row.package_type_id !== "" &&
    !packageTypes.some((packageType) => packageType.id === row.package_type_id);
  const storageLocationUnavailable =
    row.storage_location_id !== "" &&
    !storageLocations.some(
      (storageLocation) => storageLocation.id === row.storage_location_id,
    );
  const finishedWeightValid = isPositiveNumber(
    row.finished_product_weight_value,
  );
  const sealedWeightValid =
    row.sealed_package_weight_value === "" ||
    isPositiveNumber(row.sealed_package_weight_value);
  const finishedUnitValid = SUPPORTED_WEIGHT_UNITS.has(
    row.finished_product_weight_unit as "g" | "oz" | "lb",
  );
  const sealedUnitValid = SUPPORTED_WEIGHT_UNITS.has(
    row.sealed_package_weight_unit as "g" | "oz" | "lb",
  );

  if (!empty) {
    if (row.package_type_id === "") messages.push("Package Type is required.");
    if (packageTypeUnavailable)
      messages.push("Saved Package Type reference is unavailable.");
    if (row.finished_product_weight_value === "") {
      messages.push("Finished Product Weight is required.");
    } else if (!finishedWeightValid) {
      messages.push("Finished Product Weight must be greater than zero.");
    }
    if (!finishedUnitValid)
      messages.push("Finished Product Weight Unit is unavailable.");
    if (!sealedWeightValid)
      messages.push("Sealed Package Weight must be greater than zero.");
    if (!sealedUnitValid)
      messages.push("Sealed Package Weight Unit is unavailable.");
    if (storageLocationUnavailable)
      messages.push("Saved Storage Location reference is unavailable.");
  }

  if (empty) {
    return {
      label: "Empty",
      messages: [
        "Choose a Package Type and enter Finished Product Weight to prepare this row.",
      ],
    };
  }
  if (packageTypeUnavailable || storageLocationUnavailable) {
    return { label: "Reference unavailable", messages };
  }
  return {
    label: messages.length === 0 ? "Ready to save" : "Incomplete",
    messages,
  };
}

function createEmptyDraft(key: string): PlannedPackageDraft {
  return {
    key,
    package_type_id: "",
    finished_product_weight_value: "",
    finished_product_weight_unit: "g",
    sealed_package_weight_value: "",
    sealed_package_weight_unit: "g",
    oxygen_absorber: "",
    storage_location_id: "",
    notes: "",
    label_display_name: "",
    label_description: "",
    label_ingredients_summary: "",
    label_preparation_summary: "",
    label_rehydration_instructions: "",
    label_serving_notes: "",
    label_net_weight_display: "",
    label_fresh_equivalent_display: "",
  };
}

function createDraftFromSavedRow(row: PlannedPackageRow): PlannedPackageDraft {
  const finishedUnit = row.finished_product_weight_unit ?? "g";
  const sealedUnit = row.sealed_package_weight_unit ?? "g";
  return {
    ...createEmptyDraft(`saved:${row.id}`),
    persistedId: row.id,
    recordedPackageId: row.recorded_package_id ?? undefined,
    package_type_id: row.package_type_id ?? "",
    finished_product_weight_value: gramsToDisplayValue(
      row.finished_product_weight_grams,
      finishedUnit,
    ),
    finished_product_weight_unit: finishedUnit,
    sealed_package_weight_value: gramsToDisplayValue(
      row.sealed_package_weight_grams,
      sealedUnit,
    ),
    sealed_package_weight_unit: sealedUnit,
    oxygen_absorber: row.oxygen_absorber ?? "",
    storage_location_id: row.storage_location_id ?? "",
    notes: row.notes ?? "",
    label_display_name: row.label_display_name ?? "",
    label_description: row.label_description ?? "",
    label_ingredients_summary: row.label_ingredients_summary ?? "",
    label_preparation_summary: row.label_preparation_summary ?? "",
    label_rehydration_instructions: row.label_rehydration_instructions ?? "",
    label_serving_notes: row.label_serving_notes ?? "",
    label_net_weight_display: row.label_net_weight_display ?? "",
    label_fresh_equivalent_display: row.label_fresh_equivalent_display ?? "",
  };
}

function gramsToDisplayValue(grams: string | number | null, unit: string) {
  if (grams === null) return "";
  const numericGrams = Number(grams);
  if (!Number.isFinite(numericGrams)) return "";
  if (unit === "oz") return formatDraftNumber(numericGrams / 28.349523125);
  if (unit === "lb") return formatDraftNumber(numericGrams / 453.59237);
  return formatDraftNumber(numericGrams);
}

function formatDraftNumber(value: number) {
  return Number(value.toFixed(3)).toString();
}

function isPositiveNumber(value: string) {
  if (value.trim() === "") return false;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

function isEmptyDraft(row: PlannedPackageDraft) {
  return [
    row.package_type_id,
    row.finished_product_weight_value,
    row.sealed_package_weight_value,
    row.oxygen_absorber,
    row.storage_location_id,
    row.notes,
    ...LABEL_FIELDS.map(({ field }) => row[field]),
  ].every((value) => value.trim() === "");
}

function serializePlannedPackageDraft(
  row: PlannedPackageDraft,
): PlannedPackageInput {
  const finishedUnit = row.finished_product_weight_unit as WeightUnit;
  const sealedUnit = row.sealed_package_weight_unit as WeightUnit;
  return {
    ...(row.persistedId ? { id: row.persistedId } : {}),
    package_type_id: row.package_type_id,
    finished_product_weight_grams: toGrams(
      row.finished_product_weight_value,
      finishedUnit,
    ),
    finished_product_weight_unit: finishedUnit,
    sealed_package_weight_grams:
      row.sealed_package_weight_value === ""
        ? null
        : toGrams(row.sealed_package_weight_value, sealedUnit),
    sealed_package_weight_unit: sealedUnit,
    oxygen_absorber: optionalText(row.oxygen_absorber),
    storage_location_id: row.storage_location_id || null,
    notes: optionalText(row.notes),
    label_display_name: optionalText(row.label_display_name),
    label_description: optionalText(row.label_description),
    label_ingredients_summary: optionalText(row.label_ingredients_summary),
    label_preparation_summary: optionalText(row.label_preparation_summary),
    label_rehydration_instructions: optionalText(
      row.label_rehydration_instructions,
    ),
    label_serving_notes: optionalText(row.label_serving_notes),
    label_net_weight_display: optionalText(row.label_net_weight_display),
    label_fresh_equivalent_display: optionalText(
      row.label_fresh_equivalent_display,
    ),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function draftFingerprint(rows: PlannedPackageDraft[]) {
  return JSON.stringify(rows.map((row) => ({ ...row, key: undefined })));
}

function getBalanceState(
  remainingWeightGrams: number | null,
  locallyValid: boolean,
): PlannedPackageProjection["balanceState"] {
  if (!locallyValid || remainingWeightGrams === null) return "Incomplete";
  if (Math.abs(remainingWeightGrams) <= ALLOCATION_TOLERANCE_GRAMS) {
    return "Balanced";
  }
  return remainingWeightGrams > 0 ? "Remaining" : "Overallocated";
}

function getProjectedBalanceMessage(
  balanceState: PlannedPackageProjection["balanceState"],
  locallyValid: boolean,
  remainingWeightGrams: number | null,
) {
  if (!locallyValid || balanceState === "Incomplete") {
    return "Projection incomplete — correct the invalid or incomplete Planned Package rows before evaluating completion.";
  }
  if (balanceState === "Balanced") {
    return "Projected balance: Balanced. Save these changes before Packaging can appear eligible for completion.";
  }
  if (remainingWeightGrams === null) {
    return "Projected balance is unavailable.";
  }
  if (balanceState === "Overallocated") {
    return `Projected balance: Overallocated by ${formatGrams(String(Math.abs(remainingWeightGrams)), 3)}. Correct Planned Finished Product Weight before saving.`;
  }
  return `Projected balance: ${formatGrams(String(remainingWeightGrams), 3)} remaining to allocate.`;
}
