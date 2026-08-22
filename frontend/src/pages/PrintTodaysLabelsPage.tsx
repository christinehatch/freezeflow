import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { packagingApi, type PackageEligibleForPrint } from "../api/client";
import {
  AveryLabelPreviewCard,
  type PreviewLabel,
} from "../components/PackageLabelPreview";
import {
  ButtonLink,
  PageHeader,
  StatusBanner,
  Surface,
} from "../components/design-system";
import {
  AVERY_5163_LABELS_PER_SHEET,
  paginateAvery5163Items,
  reserveAvery5163PrintOutput,
  toAvery5163Label,
} from "../utils/avery5163Labels";
import { formatApiError } from "../utils/apiErrors";
import { formatGrams } from "../utils/weights";

export function PrintTodaysLabelsPage() {
  const queryClient = useQueryClient();
  const eligibleQuery = useQuery({
    queryKey: ["packages-eligible-today"],
    queryFn: packagingApi.getPackagesEligibleForTodaysPrint,
  });
  const packages = useMemo(
    () => eligibleQuery.data ?? [],
    [eligibleQuery.data],
  );
  const packagesByLabelId = useMemo(() => {
    const map = new Map<string, PackageEligibleForPrint>();
    for (const item of packages) map.set(item.label.id, item);
    return map;
  }, [packages]);

  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [previewLabels, setPreviewLabels] = useState<PreviewLabel[] | null>(
    null,
  );
  const [previewing, setPreviewing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);

  function toPreviewItems(labels: { id: string }[]): PreviewLabel[] {
    return labels.flatMap((label) => {
      const item = packagesByLabelId.get(label.id);
      if (!item) return [];
      return [
        {
          allocationNumber: 1,
          recordedPackage: item,
          label: item.label,
        },
      ];
    });
  }

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    );
    setError(null);
    setConfirmation(null);
  }

  async function previewSelected() {
    if (selectedLabelIds.length === 0 || previewing) return;
    setPreviewing(true);
    setError(null);
    try {
      const authoritative = await packagingApi.previewPackageLabels({
        package_label_ids: selectedLabelIds,
      });
      setPreviewLabels(toPreviewItems(authoritative));
      previewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      previewSectionRef.current?.focus();
    } catch (previewError) {
      setError(formatApiError(previewError));
    } finally {
      setPreviewing(false);
    }
  }

  async function printSelected() {
    if (selectedLabelIds.length === 0 || printing) return;
    setError(null);
    setConfirmation(null);

    const reserved = reserveAvery5163PrintOutput();
    if (!reserved) {
      setError(
        "The browser blocked the Avery 5163 output window. No Print Events were recorded. Allow popups for Freezeflow, then try again.",
      );
      return;
    }

    setPrinting(true);
    try {
      const result = await packagingApi.printPackageLabels({
        package_label_ids: selectedLabelIds,
      });
      const printedItems = toPreviewItems(result.labels);
      if (!reserved.load(printedItems.map(toAvery5163Label))) {
        reserved.close();
        setError(
          "The Print Events were recorded, but the browser could not load the Avery 5163 output.",
        );
      } else {
        setConfirmation(
          `Print recorded for ${printedItems.length} Package Label${
            printedItems.length === 1 ? "" : "s"
          }.`,
        );
      }
      setSelectedLabelIds([]);
      setPreviewLabels(null);
      await queryClient.invalidateQueries({
        queryKey: ["packages-eligible-today"],
      });
    } catch (printError) {
      reserved.close();
      setError(formatApiError(printError));
    } finally {
      setPrinting(false);
    }
  }

  const pages = paginateAvery5163Items(previewLabels ?? []);

  return (
    <div className="print-todays-labels-page space-y-4">
      <PageHeader
        action={
          <ButtonLink to="/packaging" variant="secondary">
            Back to Packaging
          </ButtonLink>
        }
        description="Print every Ready or Needs Reprint Package Label packaged today, across every Batch, without opening each Packaging Operation."
        eyebrow="Packaging"
        title="Print Today's Labels"
      />

      {error ? (
        <StatusBanner body={error} title="Print action failed" tone="danger" />
      ) : null}
      {confirmation ? (
        <StatusBanner body={confirmation} title="Printed" tone="success" />
      ) : null}

      <Surface>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h5 className="text-sm font-semibold">
              Today&rsquo;s eligible Labels
            </h5>
            <p className="mt-1 text-sm text-slate-600">
              Ready or Needs Reprint Package Labels for Packages packaged today,
              across every Batch.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {selectedLabelIds.length} label
            {selectedLabelIds.length === 1 ? "" : "s"} selected
          </p>
        </div>

        {eligibleQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-600">
            Finding today&rsquo;s eligible Package Labels.
          </p>
        ) : eligibleQuery.isError ? (
          <p className="mt-3 text-red-700" role="alert">
            {formatApiError(eligibleQuery.error)}
          </p>
        ) : packages.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No Package Labels packaged today are Ready or Needs Reprint yet.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="secondary-action"
                type="button"
                onClick={() => {
                  setSelectedLabelIds(packages.map((item) => item.label.id));
                  setError(null);
                  setConfirmation(null);
                }}
              >
                Select All
              </button>
              <button
                className="secondary-action"
                disabled={selectedLabelIds.length === 0}
                type="button"
                onClick={() => {
                  setSelectedLabelIds([]);
                  setError(null);
                  setConfirmation(null);
                }}
              >
                Clear Selection
              </button>
              <button
                className="secondary-action"
                disabled={selectedLabelIds.length === 0 || previewing}
                type="button"
                onClick={() => void previewSelected()}
              >
                {previewing ? "Previewing…" : "Preview Avery 5163"}
              </button>
              <button
                className="primary-action"
                disabled={selectedLabelIds.length === 0 || printing}
                type="button"
                onClick={() => void printSelected()}
              >
                {printing ? "Printing…" : "Print Selected Labels"}
              </button>
            </div>

            <ul className="mt-3 space-y-2" role="list">
              {packages.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300">
                    <input
                      aria-label={`Select ${item.package_identifier} Package Label`}
                      checked={selectedLabelIds.includes(item.label.id)}
                      type="checkbox"
                      onChange={() => toggleLabel(item.label.id)}
                    />
                    <div>
                      <p className="font-semibold">
                        {item.label.display_name}{" "}
                        <span className="font-normal text-slate-600">
                          · {item.batch_number}
                        </span>
                      </p>
                      <p className="text-sm text-slate-700">
                        {item.package_identifier} · {item.package_type.name} ·{" "}
                        {formatGrams(
                          item.finished_product_weight_grams === null
                            ? null
                            : String(item.finished_product_weight_grams),
                        )}
                      </p>
                      <p className="text-sm text-slate-600">
                        Label status: {item.label.status}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </Surface>

      <Surface
        aria-label="Avery 5163 preview"
        ref={previewSectionRef}
        tabIndex={-1}
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
        ) : (
          <div className="mt-3 space-y-4">
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
      </Surface>
    </div>
  );
}
