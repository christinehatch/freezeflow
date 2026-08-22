import { useEffect, useMemo, useRef, useState } from "react";

import type {
  Package,
  PackageLabel,
  PackageLabelPrintResult,
  PackagingOperation,
  PrintEvent,
} from "../api/client";
import {
  AVERY_5163_LABELS_PER_SHEET,
  type Avery5163Label,
  type Avery5163PrintOutput,
  paginateAvery5163Items,
} from "../utils/avery5163Labels";
import { formatGrams } from "../utils/weights";

type PreviewPackage = {
  allocationNumber: number;
  recordedPackage: Package;
};

type PreviewLabel = PreviewPackage & {
  label: PackageLabel;
};

export function PackageLabelPreview({
  formatError,
  onOpenPrintOutput,
  onPreview,
  onPrint,
  onReservePrintOutput,
  onRefreshOperation,
  operation,
}: {
  formatError: (error: unknown) => string;
  onOpenPrintOutput: (labels: Avery5163Label[]) => boolean;
  onPreview: (packageLabelIds: string[]) => Promise<PackageLabel[]>;
  onPrint: (packageLabelIds: string[]) => Promise<PackageLabelPrintResult>;
  onReservePrintOutput: () => Avery5163PrintOutput | null;
  onRefreshOperation: () => Promise<void>;
  operation: PackagingOperation;
}) {
  const previewInFlight = useRef(false);
  const printInFlight = useRef(false);
  const refreshInFlight = useRef(false);
  const previousOperationId = useRef(operation.id);
  const operationPackages = useMemo(
    () => operationPreviewPackages(operation),
    [operation],
  );
  const [lastPrintResult, setLastPrintResult] =
    useState<PackageLabelPrintResult | null>(null);
  const packages = useMemo(
    () =>
      overlayPrintedLabels(operationPackages, lastPrintResult?.labels ?? []),
    [lastPrintResult, operationPackages],
  );
  const packagesByLabelId = useMemo(
    () => packagesByUniqueLabelId(packages),
    [packages],
  );
  const eligibleLabelIds = useMemo(
    () =>
      new Set(
        packages.flatMap(({ recordedPackage }) =>
          isPreviewEligible(recordedPackage.label)
            ? [recordedPackage.label.id]
            : [],
        ),
      ),
    [packages],
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [previewLabels, setPreviewLabels] = useState<PreviewLabel[] | null>(
    null,
  );
  const [previewedSelection, setPreviewedSelection] = useState<string[]>([]);
  const [previewedLabelState, setPreviewedLabelState] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printConfirmation, setPrintConfirmation] = useState<string | null>(
    null,
  );
  const [printOutputError, setPrintOutputError] = useState<string | null>(null);
  const [recordedOutputRecovery, setRecordedOutputRecovery] = useState<
    Avery5163Label[] | null
  >(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (previousOperationId.current === operation.id) return;
    previousOperationId.current = operation.id;
    setLastPrintResult(null);
    setSelectedLabelIds([]);
    setPreviewLabels(null);
    setPreviewedSelection([]);
    setPreviewedLabelState("");
    setPreviewError(null);
    setPrintError(null);
    setPrintConfirmation(null);
    setPrintOutputError(null);
    setRecordedOutputRecovery(null);
    setRefreshError(null);
  }, [operation.id]);

  useEffect(() => {
    setSelectedLabelIds((current) =>
      current.filter((labelId) => eligibleLabelIds.has(labelId)),
    );
  }, [eligibleLabelIds]);

  const selectedFingerprint = selectionFingerprint(selectedLabelIds);
  const previewFingerprint = selectionFingerprint(previewedSelection);
  const currentLabelState = labelStateFingerprint(
    selectedLabelIds,
    packagesByLabelId,
  );
  const previewSelectionChanged = selectedFingerprint !== previewFingerprint;
  const previewLabelStateChanged = currentLabelState !== previewedLabelState;
  const previewIsStale =
    previewLabels !== null &&
    (previewSelectionChanged || previewLabelStateChanged);
  const pages = paginateAvery5163Items(previewLabels ?? []);
  const eligibleCount = eligibleLabelIds.size;
  const selectedLabels = selectedLabelIds.flatMap((labelId) => {
    const label = packagesByLabelId.get(labelId)?.recordedPackage.label;
    return label && isPreviewEligible(label) ? [label] : [];
  });
  const initialPrintCount = selectedLabels.filter(isInitialPrint).length;
  const reprintCount = selectedLabels.length - initialPrintCount;

  function toggleLabel(labelId: string) {
    if (!eligibleLabelIds.has(labelId)) return;
    setSelectedLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((selectedId) => selectedId !== labelId)
        : [...current, labelId],
    );
    setPreviewError(null);
    setPrintError(null);
  }

  async function previewSelectedLabels() {
    if (
      operation.status !== "Open" ||
      previewInFlight.current ||
      selectedLabelIds.length === 0
    ) {
      return;
    }
    const validSelection = Array.from(
      new Set(
        selectedLabelIds.filter((labelId) => eligibleLabelIds.has(labelId)),
      ),
    );
    if (validSelection.length === 0) return;

    previewInFlight.current = true;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const authoritativeLabels = await onPreview(validSelection);
      const selectedIds = new Set(validSelection);
      const seenIds = new Set<string>();
      const authoritativePreview = authoritativeLabels.flatMap((label) => {
        if (
          seenIds.has(label.id) ||
          !selectedIds.has(label.id) ||
          !isPreviewEligible(label)
        ) {
          return [];
        }
        const packageContext = packagesByLabelId.get(label.id);
        if (
          !packageContext ||
          packageContext.recordedPackage.id !== label.package_id
        ) {
          return [];
        }
        seenIds.add(label.id);
        return [{ ...packageContext, label }];
      });
      setPreviewLabels(authoritativePreview);
      setPreviewedSelection(validSelection);
      setPreviewedLabelState(
        labelStateFingerprint(validSelection, packagesByLabelId),
      );
    } catch (previewError) {
      setPreviewError(formatError(previewError));
    } finally {
      previewInFlight.current = false;
      setPreviewing(false);
    }
  }

  async function printSelectedLabels() {
    if (
      operation.status !== "Open" ||
      printInFlight.current ||
      selectedLabelIds.length === 0
    ) {
      return;
    }
    const validSelection = Array.from(
      new Set(
        selectedLabelIds.filter((labelId) => eligibleLabelIds.has(labelId)),
      ),
    );
    if (validSelection.length === 0) return;

    printInFlight.current = true;
    setPrintError(null);
    setPrintConfirmation(null);
    setPrintOutputError(null);
    setRecordedOutputRecovery(null);
    setRefreshError(null);

    let reservedOutput: Avery5163PrintOutput | null;
    let reservationError: string | null = null;
    try {
      reservedOutput = onReservePrintOutput();
    } catch (outputError) {
      reservedOutput = null;
      reservationError = `The browser could not reserve the Avery 5163 output window. No Print Events were recorded. Allow popups for Freezeflow, then try again. ${formatError(outputError)}`;
    }
    if (!reservedOutput) {
      setPrintOutputError(
        reservationError ??
          "The browser blocked the Avery 5163 output window. No Print Events were recorded. Allow popups for Freezeflow, then try Print Selected Labels again.",
      );
      printInFlight.current = false;
      return;
    }

    setPrinting(true);
    try {
      const result = await onPrint(validSelection);
      const printedItems = authoritativePrintItems(
        result.labels,
        validSelection,
        packagesByLabelId,
      );
      setLastPrintResult({
        ...result,
        labels: printedItems.map((item) => item.label),
      });
      setPrintConfirmation(
        `Print recorded for ${printedItems.length} Package Label${
          printedItems.length === 1 ? "" : "s"
        }. Print job ${result.print_job_id}.`,
      );

      const outputLabels = printedItems.map(toAvery5163Label);
      try {
        if (!reservedOutput.load(outputLabels)) {
          reservedOutput.close();
          setRecordedOutputRecovery(outputLabels);
          setPrintOutputError(
            "The Print Events were recorded, but the browser could not load the Avery 5163 output. Open the recorded output below without recording another Print Event. Use Print Selected Labels only for a deliberate reprint.",
          );
        }
      } catch (outputError) {
        reservedOutput.close();
        setRecordedOutputRecovery(outputLabels);
        setPrintOutputError(
          `The Print Events were recorded, but the browser could not load the Avery 5163 output. Open the recorded output below without recording another Print Event. ${formatError(outputError)}`,
        );
      }

      try {
        await onRefreshOperation();
      } catch (operationRefreshError) {
        setRefreshError(
          `Printing was recorded, but the Packaging workspace refresh failed. ${formatError(operationRefreshError)}`,
        );
      }
    } catch (requestError) {
      reservedOutput.close();
      setPrintError(formatError(requestError));
    } finally {
      printInFlight.current = false;
      setPrinting(false);
    }
  }

  function openRecordedOutput() {
    if (operation.status !== "Open" || !recordedOutputRecovery) return;
    try {
      if (!onOpenPrintOutput(recordedOutputRecovery)) {
        setPrintOutputError(
          "The browser still blocked the recorded Avery 5163 output. No additional Print Event was recorded. Allow popups for Freezeflow, then try opening it again.",
        );
        return;
      }
      setPrintOutputError(null);
      setRecordedOutputRecovery(null);
    } catch (outputError) {
      setPrintOutputError(
        `The browser could not open the recorded Avery 5163 output. No additional Print Event was recorded. ${formatError(outputError)}`,
      );
    }
  }

  async function retryOperationRefresh() {
    if (!refreshError || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      await onRefreshOperation();
      setRefreshError(null);
    } catch (operationRefreshError) {
      setRefreshError(
        `Printing was recorded, but the Packaging workspace refresh failed. ${formatError(operationRefreshError)}`,
      );
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  return (
    <section
      aria-label="Package Label preview"
      className="rounded-md border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="text-sm font-semibold">Print Labels</h5>
          <p className="mt-1 text-sm text-slate-600">
            Select Ready or Needs Reprint Package Labels to preview Avery 5163
            output and deliberately record printing. Preview does not print or
            save anything.
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {selectedLabelIds.length} label
          {selectedLabelIds.length === 1 ? "" : "s"} selected
        </p>
      </div>

      {packages.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          No recorded Packages are available for label preview.
        </p>
      ) : (
        <>
          {eligibleCount === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No Package Labels are eligible for preview or printing. Save Draft
              labels so the backend can make them Ready first.
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {operation.status === "Open" ? (
              <>
                <button
                  className="secondary-action"
                  disabled={eligibleCount === 0}
                  type="button"
                  onClick={() => {
                    setSelectedLabelIds(Array.from(eligibleLabelIds));
                    setPreviewError(null);
                    setPrintError(null);
                  }}
                >
                  Select All Eligible
                </button>
                <button
                  className="secondary-action"
                  disabled={selectedLabelIds.length === 0}
                  type="button"
                  onClick={() => {
                    setSelectedLabelIds([]);
                    setPreviewError(null);
                    setPrintError(null);
                  }}
                >
                  Clear Selection
                </button>
              </>
            ) : null}
          </div>

          <ul className="mt-3 space-y-2">
            {packages.map(({ allocationNumber, recordedPackage }) => {
              const label = recordedPackage.label as
                | PackageLabel
                | null
                | undefined;
              const eligible = isPreviewEligible(label);
              return (
                <li
                  className="rounded-md border border-slate-200 bg-white p-3"
                  key={recordedPackage.id}
                >
                  <label className="flex items-start gap-3">
                    {operation.status === "Open" ? (
                      <input
                        aria-label={`Select ${recordedPackage.package_identifier} Package Label`}
                        checked={Boolean(
                          label && selectedLabelIds.includes(label.id),
                        )}
                        disabled={!eligible}
                        type="checkbox"
                        onChange={() => label && toggleLabel(label.id)}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">
                        {label?.display_name || "Package Label unavailable"}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {recordedPackage.package_identifier} · Source{" "}
                        {allocationNumber}
                        {" · "}
                        {recordedPackage.package_type?.name ??
                          "Package Type unavailable"}
                        {" · "}
                        {recordedPackage.finished_product_weight_grams === null
                          ? "Finished Product Weight unavailable"
                          : formatGrams(
                              String(
                                recordedPackage.finished_product_weight_grams,
                              ),
                            )}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-slate-700">
                        {label?.status ?? "Missing"}
                      </span>
                      {!label ? (
                        <span className="mt-1 block text-sm text-amber-900">
                          This Package has no available Package Label.
                        </span>
                      ) : label.status === "Draft" ? (
                        <span className="mt-1 block text-sm text-amber-900">
                          Draft labels cannot be previewed. Save the label so
                          the backend can make it Ready first.
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {label ? (
                    <PrintEventHistory
                      label={label}
                      packageIdentifier={recordedPackage.package_identifier}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {operation.status === "Completed" ? (
        <p className="mt-3 text-sm text-slate-700">
          This Completed Packaging workspace is read-only. Label preview actions
          and Print actions are unavailable.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {selectedLabelIds.length === 0
              ? "Select at least one eligible Package Label to preview or print."
              : `${initialPrintCount} initial print${
                  initialPrintCount === 1 ? "" : "s"
                } · ${reprintCount} reprint${reprintCount === 1 ? "" : "s"}`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="secondary-action"
              disabled={selectedLabelIds.length === 0 || previewing || printing}
              type="button"
              onClick={() => void previewSelectedLabels()}
            >
              {previewing
                ? "Preparing Avery 5163 Preview…"
                : "Preview Avery 5163"}
            </button>
            <button
              className="secondary-action"
              disabled={selectedLabelIds.length === 0 || printing || previewing}
              type="button"
              onClick={() => void printSelectedLabels()}
            >
              {printing ? "Recording Print…" : "Print Selected Labels"}
            </button>
            <p className="text-sm text-slate-600" role="status">
              {printing
                ? "Recording authoritative Print Events before opening output…"
                : previewing
                  ? "Loading authoritative Package Labels…"
                  : selectedLabelIds.length === 0
                    ? "Nothing selected. Preview and Print are unavailable."
                    : previewIsStale
                      ? previewSelectionChanged
                        ? "Selection changed. Regenerate the preview."
                        : "Authoritative Package Label state changed. Regenerate the preview."
                      : "Ready to preview or print the selected Package Labels."}
            </p>
          </div>
        </div>
      )}

      {previewError ? (
        <p className="error-banner mt-3" role="alert">
          {previewError}
        </p>
      ) : null}
      {printError ? (
        <p className="error-banner mt-3" role="alert">
          Print was not recorded. {printError}
        </p>
      ) : null}
      {printConfirmation ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {printConfirmation}
        </p>
      ) : null}
      {printOutputError ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          <p>{printOutputError}</p>
          {operation.status === "Open" && recordedOutputRecovery ? (
            <button
              className="secondary-action mt-2"
              type="button"
              onClick={openRecordedOutput}
            >
              Open Recorded Avery 5163 Output
            </button>
          ) : null}
        </div>
      ) : null}
      {refreshError ? (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          <p>{refreshError}</p>
          <button
            className="secondary-action mt-2"
            disabled={refreshing}
            type="button"
            onClick={() => void retryOperationRefresh()}
          >
            {refreshing ? "Refreshing Workspace…" : "Retry Workspace Refresh"}
          </button>
        </div>
      ) : null}

      <section
        aria-label="Avery 5163 preview"
        className="mt-4 border-t border-slate-200 pt-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h6 className="text-sm font-semibold">Avery 5163 preview</h6>
            <p className="mt-1 text-sm text-slate-600">
              US Letter · two columns · five rows ·{" "}
              {AVERY_5163_LABELS_PER_SHEET} labels per sheet
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {previewLabels?.length ?? 0} previewed · {pages.length} sheet
            {pages.length === 1 ? "" : "s"}
          </p>
        </div>

        {previewLabels === null ? (
          <p className="mt-3 text-sm text-slate-600">
            No preview has been generated.
          </p>
        ) : previewLabels.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            The authoritative preview returned no eligible Package Labels.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {previewIsStale ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This preview is stale because the selection changed or the
                authoritative Package Label state changed. Regenerate it before
                relying on the sheet count.
              </p>
            ) : null}
            {pages.map((page, pageIndex) => (
              <section
                aria-label={`Avery 5163 sheet ${pageIndex + 1}`}
                className="rounded-md border border-slate-300 bg-white p-3"
                key={pageIndex}
              >
                <h6 className="text-xs font-semibold uppercase text-slate-500">
                  Sheet {pageIndex + 1}
                </h6>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {page.map((item) => (
                    <AveryLabelPreviewCard item={item} key={item.label.id} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function AveryLabelPreviewCard({ item }: { item: PreviewLabel }) {
  const { label, recordedPackage } = item;
  const summary =
    label.ingredients_summary ||
    label.preparation_summary ||
    label.description ||
    "No ingredients or preparation summary";
  return (
    <article
      aria-label={`${recordedPackage.package_identifier} Avery 5163 label`}
      className="min-h-36 rounded border border-dashed border-slate-300 p-3"
    >
      <p className="text-base font-semibold text-slate-950">
        {label.display_name}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">
        {label.net_weight_display ||
          (recordedPackage.finished_product_weight_grams === null
            ? "Finished Product Weight unavailable"
            : formatGrams(
                String(recordedPackage.finished_product_weight_grams),
              ))}
        {label.fresh_equivalent_display
          ? ` · ${label.fresh_equivalent_display}`
          : " · Fresh equivalent unavailable"}
      </p>
      <p className="mt-2 text-sm text-slate-700">{summary}</p>
      <p className="mt-2 text-xs text-slate-600">
        {new Date(recordedPackage.packaged_at).toLocaleDateString()} ·{" "}
        {recordedPackage.package_type?.name ?? "Package Type unavailable"} ·
        Oxygen absorber: {recordedPackage.oxygen_absorber || "None"}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
        {recordedPackage.package_identifier}
      </p>
    </article>
  );
}

function PrintEventHistory({
  label,
  packageIdentifier,
}: {
  label: PackageLabel;
  packageIdentifier: string;
}) {
  const events = sortedPrintEvents(label.print_events);
  return (
    <section
      aria-label={`${packageIdentifier} Print Event history`}
      className="mt-3 border-t border-slate-200 pt-3"
    >
      <h6 className="text-xs font-semibold uppercase text-slate-500">
        Print Event history
      </h6>
      {events.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          No Print Events recorded. The next successful print is{" "}
          {isInitialPrint(label) ? "the Initial Print" : "a Reprint"}.
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {events.map((event, index) => (
            <li
              className="rounded border border-slate-200 bg-slate-50 p-2 text-sm"
              key={event.id}
            >
              <p className="font-semibold">
                {index === 0 ? "Initial Print" : "Reprint"}
              </p>
              <p className="mt-1 text-slate-700">
                Printed {formatPrintTime(event.printed_at)} · Recorded{" "}
                {formatPrintTime(event.recorded_at)}
              </p>
              <p className="mt-1 text-slate-600">
                {event.template} · Print job {event.print_job_id}
              </p>
              {event.notes ? (
                <p className="mt-1 text-slate-600">Notes: {event.notes}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function overlayPrintedLabels(
  packages: PreviewPackage[],
  authoritativeLabels: PackageLabel[],
) {
  const labelsById = new Map(
    authoritativeLabels.map((label) => [label.id, label]),
  );
  return packages.map((item) => {
    const currentLabel = item.recordedPackage.label;
    if (!currentLabel) return item;
    const authoritativeLabel = labelsById.get(currentLabel.id);
    if (
      !authoritativeLabel ||
      authoritativeLabel.package_id !== item.recordedPackage.id
    ) {
      return item;
    }
    if (includesPrintedEvents(currentLabel, authoritativeLabel)) {
      return item;
    }
    return {
      ...item,
      recordedPackage: {
        ...item.recordedPackage,
        label: authoritativeLabel,
      },
    };
  });
}

function includesPrintedEvents(
  currentLabel: PackageLabel,
  printedLabel: PackageLabel,
) {
  if (printedLabel.print_events.length === 0) return false;
  const currentEventIds = new Set(
    currentLabel.print_events.map((event) => event.id),
  );
  return printedLabel.print_events.every((event) =>
    currentEventIds.has(event.id),
  );
}

function authoritativePrintItems(
  labels: PackageLabel[],
  requestedLabelIds: string[],
  packagesByLabelId: Map<string, PreviewPackage>,
) {
  const requestedIds = new Set(requestedLabelIds);
  const seenIds = new Set<string>();
  return labels.flatMap((label) => {
    const packageContext = packagesByLabelId.get(label.id);
    if (
      seenIds.has(label.id) ||
      !requestedIds.has(label.id) ||
      !isPreviewEligible(label) ||
      !packageContext ||
      packageContext.recordedPackage.id !== label.package_id
    ) {
      return [];
    }
    seenIds.add(label.id);
    return [{ ...packageContext, label }];
  });
}

function toAvery5163Label(item: PreviewLabel): Avery5163Label {
  const { label, recordedPackage } = item;
  return {
    packageIdentifier: recordedPackage.package_identifier,
    productName: label.display_name,
    preparationSummary:
      label.ingredients_summary ||
      label.preparation_summary ||
      label.description ||
      "No ingredients or preparation summary",
    netWeightDisplay: label.net_weight_display,
    freshEquivalentDisplay: label.fresh_equivalent_display,
    freshEquivalentGrams: null,
    finishedProductWeightGrams:
      recordedPackage.finished_product_weight_grams === null
        ? null
        : String(recordedPackage.finished_product_weight_grams),
    packageType:
      recordedPackage.package_type?.name ?? "Package Type unavailable",
    batchLine: "",
    oxygenAbsorber: recordedPackage.oxygen_absorber,
    packagedAt: recordedPackage.packaged_at,
  };
}

function sortedPrintEvents(events: PrintEvent[]) {
  return [...events].sort(
    (left, right) =>
      left.printed_at.localeCompare(right.printed_at) ||
      left.recorded_at.localeCompare(right.recorded_at) ||
      left.id.localeCompare(right.id),
  );
}

function isInitialPrint(label: PackageLabel) {
  return label.status === "Ready" && label.print_events.length === 0;
}

function formatPrintTime(value: string) {
  return new Date(value).toLocaleString();
}

function operationPreviewPackages(operation: PackagingOperation) {
  const seenPackageIds = new Set<string>();
  return operation.allocations.flatMap((allocation, allocationIndex) =>
    allocation.packages.flatMap((recordedPackage) => {
      if (seenPackageIds.has(recordedPackage.id)) return [];
      seenPackageIds.add(recordedPackage.id);
      return [
        {
          allocationNumber: allocationIndex + 1,
          recordedPackage,
        },
      ];
    }),
  );
}

function packagesByUniqueLabelId(packages: PreviewPackage[]) {
  const packagesByLabelId = new Map<string, PreviewPackage>();
  for (const item of packages) {
    const label = item.recordedPackage.label;
    if (label && !packagesByLabelId.has(label.id)) {
      packagesByLabelId.set(label.id, item);
    }
  }
  return packagesByLabelId;
}

function isPreviewEligible(label: PackageLabel | null | undefined) {
  return label?.status === "Ready" || label?.status === "Needs Reprint";
}

function selectionFingerprint(labelIds: string[]) {
  return [...new Set(labelIds)].sort().join("|");
}

function labelStateFingerprint(
  labelIds: string[],
  packagesByLabelId: Map<string, PreviewPackage>,
) {
  return [...new Set(labelIds)]
    .sort()
    .map((labelId) => {
      const label = packagesByLabelId.get(labelId)?.recordedPackage.label;
      if (!label) return `${labelId}:missing`;
      return [
        label.id,
        label.status,
        label.updated_at,
        ...sortedPrintEvents(label.print_events).map(
          (event) =>
            `${event.id}:${event.printed_at}:${event.recorded_at}:${event.print_job_id}`,
        ),
      ].join(":");
    })
    .join("|");
}
