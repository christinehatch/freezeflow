import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import {
  PackageType,
  PackagingResult,
  PackagingWorksheetItem,
  packagingApi,
} from "../api/client";
import {
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  toGrams,
} from "../utils/weights";
import { printAvery5163Labels } from "../utils/avery5163Labels";

type PackageLineForm = {
  id: string;
  package_type_id: string;
  package_weight_value: string;
  package_weight_unit: WeightUnit;
  oxygen_absorber: string;
  storage_location_id: string;
  notes: string;
};

export function PackagingPage() {
  const queryClient = useQueryClient();
  const worksheetQuery = useQuery({
    queryKey: ["packaging-worksheet"],
    queryFn: packagingApi.getWorksheet,
  });
  const packageTypesQuery = useQuery({
    queryKey: ["package-types"],
    queryFn: packagingApi.listPackageTypes,
  });
  const storageLocationsQuery = useQuery({
    queryKey: ["storage-locations"],
    queryFn: packagingApi.listStorageLocations,
  });
  const packageTypes = useMemo(
    () => packageTypesQuery.data ?? [],
    [packageTypesQuery.data],
  );
  const storageLocations = useMemo(
    () => storageLocationsQuery.data ?? [],
    [storageLocationsQuery.data],
  );
  const worksheet = useMemo(
    () => worksheetQuery.data ?? [],
    [worksheetQuery.data],
  );
  const [selectedTrayIds, setSelectedTrayIds] = useState<string[]>([]);
  const [packageLines, setPackageLines] = useState<PackageLineForm[]>([
    createPackageLine(),
  ]);
  const [packagedAt, setPackagedAt] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [newPackageType, setNewPackageType] = useState({
    name: "",
    default_oxygen_absorber: "",
    default_label_template: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackagingResult | null>(null);

  const selectedBatchId = useMemo(
    () => findBatchIdForTray(worksheet, selectedTrayIds[0]),
    [worksheet, selectedTrayIds],
  );
  const selectedTrays = useMemo(
    () =>
      worksheet.flatMap((item) =>
        item.eligible_trays.filter((tray) => selectedTrayIds.includes(tray.id)),
      ),
    [worksheet, selectedTrayIds],
  );
  const selectedSourceWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const packageWeightTotal = packageLines.reduce((total, line) => {
    const grams = toGrams(line.package_weight_value, line.package_weight_unit);
    return total + (grams === "" ? 0 : Number(grams));
  }, 0);
  const weightDifference = packageWeightTotal - selectedSourceWeight;

  const createPackageType = useMutation({
    mutationFn: packagingApi.createPackageType,
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (packageType) => {
      setError(null);
      setNewPackageType({
        name: "",
        default_oxygen_absorber: "",
        default_label_template: "",
        notes: "",
      });
      setPackageLines((lines) =>
        lines.map((line, index) =>
          index === 0 && line.package_type_id === ""
            ? packageLineWithType(line, packageType)
            : line,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["package-types"] });
    },
  });
  const archivePackageType = useMutation({
    mutationFn: (packageTypeId: string) =>
      packagingApi.updatePackageType(packageTypeId, { archived: true }),
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (archivedPackageType) => {
      setError(null);
      setPackageLines((lines) =>
        lines.map((line) =>
          line.package_type_id === archivedPackageType.id
            ? { ...line, package_type_id: "", oxygen_absorber: "" }
            : line,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ["package-types"] });
    },
  });
  const packageTrays = useMutation({
    mutationFn: packagingApi.packageTrays,
    onError: (mutationError) => setError(mutationError.message),
    onSuccess: (packagingResult) => {
      setResult(packagingResult);
      setError(null);
      setSelectedTrayIds([]);
      setPackageLines([createPackageLine(packageTypes[0])]);
      setPackagedAt("");
      setSessionNotes("");
      void queryClient.invalidateQueries({ queryKey: ["packaging-worksheet"] });
      void queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
    },
  });

  useEffect(() => {
    if (packageTypes.length === 0) return;
    setPackageLines((lines) =>
      lines.map((line) =>
        line.package_type_id === ""
          ? packageLineWithType(line, packageTypes[0])
          : line,
      ),
    );
  }, [packageTypes]);

  function handlePackageTypeCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createPackageType.mutate({
      name: newPackageType.name,
      default_oxygen_absorber:
        newPackageType.default_oxygen_absorber.trim() === ""
          ? null
          : newPackageType.default_oxygen_absorber,
      default_label_template:
        newPackageType.default_label_template.trim() === ""
          ? null
          : newPackageType.default_label_template,
      notes: newPackageType.notes.trim() === "" ? null : newPackageType.notes,
    });
  }

  function toggleTray(item: PackagingWorksheetItem, trayId: string) {
    setResult(null);
    setSelectedTrayIds((current) => {
      if (current.includes(trayId)) {
        return current.filter((id) => id !== trayId);
      }
      const currentBatchId = findBatchIdForTray(worksheet, current[0]);
      if (currentBatchId && currentBatchId !== item.production_batch.id) {
        return [trayId];
      }
      return [...current, trayId];
    });
  }

  function updatePackageLine(lineId: string, values: Partial<PackageLineForm>) {
    setPackageLines((lines) =>
      lines.map((line) => {
        if (line.id !== lineId) return line;
        const next = { ...line, ...values };
        if (values.package_type_id !== undefined) {
          const packageType = packageTypes.find(
            (type) => type.id === values.package_type_id,
          );
          next.oxygen_absorber = packageType?.default_oxygen_absorber ?? "";
        }
        return next;
      }),
    );
  }

  function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const packages = packageLines
      .map((line) => ({
        package_type_id: line.package_type_id,
        package_weight_grams: toGrams(
          line.package_weight_value,
          line.package_weight_unit,
        ),
        oxygen_absorber:
          line.oxygen_absorber.trim() === "" ? null : line.oxygen_absorber,
        storage_location_id:
          line.storage_location_id === "" ? null : line.storage_location_id,
        notes: line.notes.trim() === "" ? null : line.notes,
      }))
      .filter(
        (line) =>
          line.package_type_id !== "" && line.package_weight_grams !== "",
      );
    packageTrays.mutate({
      tray_ids: selectedTrayIds,
      packaged_at:
        packagedAt === "" ? null : new Date(packagedAt).toISOString(),
      notes: sessionNotes.trim() === "" ? null : sessionNotes,
      packages,
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-3xl font-semibold">Packaging</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Prepare a Packaging Session from completed Trays, create Packages, and
          print human-readable labels before moving to the packaging table.
        </p>
      </section>

      {result ? <PackagingComplete result={result} /> : null}

      <section className="panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Package Types</h3>
            <p className="mt-1 text-sm text-slate-600">
              Bag sizes and defaults used during Packaging. Oxygen absorbers are
              suggestions and may be changed per Package.
            </p>
          </div>
        </div>
        <form
          className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]"
          onSubmit={handlePackageTypeCreate}
        >
          <label className="field">
            <span>Name</span>
            <input
              required
              value={newPackageType.name}
              onChange={(event) =>
                setNewPackageType((value) => ({
                  ...value,
                  name: event.target.value,
                }))
              }
              placeholder="Quart Mylar"
            />
          </label>
          <label className="field">
            <span>Default Absorber</span>
            <input
              value={newPackageType.default_oxygen_absorber}
              onChange={(event) =>
                setNewPackageType((value) => ({
                  ...value,
                  default_oxygen_absorber: event.target.value,
                }))
              }
              placeholder="500cc"
            />
          </label>
          <label className="field">
            <span>Label Template</span>
            <input
              value={newPackageType.default_label_template}
              onChange={(event) =>
                setNewPackageType((value) => ({
                  ...value,
                  default_label_template: event.target.value,
                }))
              }
              placeholder="standard"
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <input
              value={newPackageType.notes}
              onChange={(event) =>
                setNewPackageType((value) => ({
                  ...value,
                  notes: event.target.value,
                }))
              }
              placeholder="fast notebook notes"
            />
          </label>
          <button className="secondary-action self-end" type="submit">
            + Add Package Type
          </button>
        </form>
        {packageTypes.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {packageTypes.map((packageType) => (
              <div
                className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                key={packageType.id}
              >
                <span>
                  <strong>{packageType.name}</strong>
                  {packageType.default_oxygen_absorber
                    ? ` · ${packageType.default_oxygen_absorber}`
                    : ""}
                </span>
                <button
                  className="quiet-action min-h-0 px-2 py-1"
                  type="button"
                  onClick={() => archivePackageType.mutate(packageType.id)}
                >
                  Archive
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Packaging Worksheet</h3>
            <p className="mt-1 text-sm text-slate-600">
              Select completed Trays from one Production Batch. Trays already
              Packaged are excluded.
            </p>
          </div>
          {selectedTrays.length > 0 ? (
            <p className="text-sm font-semibold text-slate-700">
              Selected source weight:{" "}
              {formatGrams(String(selectedSourceWeight))}
            </p>
          ) : null}
        </div>
        {worksheetQuery.isLoading ? (
          <p className="mt-4 text-slate-600">Loading Packaging Worksheet.</p>
        ) : worksheet.length === 0 ? (
          <p className="mt-4 text-slate-600">
            No completed Trays are ready for Packaging.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {worksheet.map((item) => {
              const isDifferentBatch =
                selectedBatchId !== null &&
                selectedBatchId !== item.production_batch.id;
              return (
                <article className="object-card" key={item.production_batch.id}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="font-semibold">
                        {item.production_batch.batch_number}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {item.production_batch.freeze_dryer.name} ·{" "}
                        {formatGrams(String(item.source_weight_grams))} ready
                      </p>
                    </div>
                    <Link
                      className="text-link text-sm"
                      to={`/production/${item.production_batch.id}`}
                    >
                      View Batch
                    </Link>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Slot</th>
                          <th>Product</th>
                          <th>Finished Product Weight</th>
                          <th>Preparation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.eligible_trays.map((tray) => (
                          <tr key={tray.id}>
                            <td>
                              <input
                                checked={selectedTrayIds.includes(tray.id)}
                                disabled={isDifferentBatch}
                                type="checkbox"
                                onChange={() => toggleTray(item, tray.id)}
                              />
                            </td>
                            <td>Slot {tray.tray_slot.slot_number}</td>
                            <td>{tray.product_name}</td>
                            <td>{formatGrams(tray.final_dry_weight_grams)}</td>
                            <td>{tray.preparation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <form className="panel space-y-5" onSubmit={handlePackageSubmit}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Create Packages</h3>
            <p className="mt-1 text-sm text-slate-600">
              Enter sealed Package Weight. It may differ from Finished Product
              Weight because bags and absorbers add weight.
            </p>
          </div>
          <button
            className="secondary-action"
            type="button"
            onClick={() =>
              setPackageLines((lines) => [
                ...lines,
                createPackageLine(packageTypes[0]),
              ])
            }
          >
            + Add Package
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Packaging Date</span>
            <input
              type="datetime-local"
              value={packagedAt}
              onChange={(event) => setPackagedAt(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Packaging Notes</span>
            <input
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
              placeholder="fast notebook notes"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Package Type</th>
                <th>Sealed Package Weight</th>
                <th>Unit</th>
                <th>Oxygen Absorber</th>
                <th>Storage</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {packageLines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <select
                      className="table-input"
                      required
                      value={line.package_type_id}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          package_type_id: event.target.value,
                        })
                      }
                    >
                      <option value="">Select</option>
                      {packageTypes.map((packageType) => (
                        <option key={packageType.id} value={packageType.id}>
                          {packageType.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      min="0"
                      required
                      step="0.001"
                      type="number"
                      value={line.package_weight_value}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          package_weight_value: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={line.package_weight_unit}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          package_weight_unit: event.target.value as WeightUnit,
                        })
                      }
                    >
                      {WEIGHT_UNIT_OPTIONS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={line.oxygen_absorber}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          oxygen_absorber: event.target.value,
                        })
                      }
                      placeholder="default"
                    />
                  </td>
                  <td>
                    <select
                      className="table-input"
                      value={line.storage_location_id}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          storage_location_id: event.target.value,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {storageLocations
                        .filter((location) => location.name !== "Unassigned")
                        .map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="table-input"
                      value={line.notes}
                      onChange={(event) =>
                        updatePackageLine(line.id, {
                          notes: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="quiet-action"
                      disabled={packageLines.length === 1}
                      type="button"
                      onClick={() =>
                        setPackageLines((lines) =>
                          lines.filter((candidate) => candidate.id !== line.id),
                        )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Math.abs(weightDifference) > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Package weights differ from selected Finished Product Weight by{" "}
            {formatGrams(String(weightDifference))}. This warning will not block
            Packaging.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          className="primary-action"
          disabled={
            selectedTrayIds.length === 0 ||
            packageTypes.length === 0 ||
            packageTrays.isPending
          }
          type="submit"
        >
          Create Packages
        </button>
      </form>
    </div>
  );
}

function PackagingComplete({ result }: { result: PackagingResult }) {
  return (
    <section className="panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="section-title">Packaging Complete</h3>
          <p className="mt-1 text-sm text-slate-600">
            Created {result.packages.length} Package
            {result.packages.length === 1 ? "" : "s"}.
          </p>
        </div>
        <button
          className="secondary-action"
          type="button"
          onClick={() =>
            printAvery5163Labels(
              result.labels.map((label) => ({
                packageIdentifier: label.package_identifier,
                productName: label.product_summary,
                packageLine: `${label.package_type} · ${formatGrams(label.package_weight_grams)}`,
                batchLine: `${label.batch_number} · ${label.freeze_dryer}`,
                oxygenAbsorber: label.oxygen_absorber,
                storageLocation: label.storage_location,
              })),
            )
          }
        >
          Print Avery 5163 Labels
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Print settings: US Letter / 8.5&quot; x 11&quot;, 100% scale, headers
        and footers off. If Safari shows 8 x 10, change the paper size to US
        Letter before printing.
      </p>
      {result.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {result.labels.map((label) => (
          <article
            className="rounded-md border border-slate-300 p-4"
            key={label.package_id}
          >
            <p className="text-xs font-semibold uppercase text-slate-500">
              {label.package_identifier}
            </p>
            <h4 className="mt-1 text-lg font-semibold">
              {label.product_summary}
            </h4>
            <p className="text-sm text-slate-700">
              {label.package_type} · {formatGrams(label.package_weight_grams)}
            </p>
            <p className="text-sm text-slate-700">
              Batch {label.batch_number} · {label.freeze_dryer}
            </p>
            <p className="text-sm text-slate-700">
              Storage: {label.storage_location}
            </p>
            {label.oxygen_absorber ? (
              <p className="text-sm text-slate-700">
                Oxygen absorber: {label.oxygen_absorber}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function createPackageLine(packageType?: PackageType): PackageLineForm {
  return {
    id: Math.random().toString(36).slice(2),
    package_type_id: packageType?.id ?? "",
    package_weight_value: "",
    package_weight_unit: "oz",
    oxygen_absorber: packageType?.default_oxygen_absorber ?? "",
    storage_location_id: "",
    notes: "",
  };
}

function packageLineWithType(
  line: PackageLineForm,
  packageType: PackageType,
): PackageLineForm {
  return {
    ...line,
    package_type_id: packageType.id,
    oxygen_absorber: packageType.default_oxygen_absorber ?? "",
  };
}

function findBatchIdForTray(
  worksheet: PackagingWorksheetItem[],
  trayId?: string,
) {
  if (!trayId) return null;
  for (const item of worksheet) {
    if (item.eligible_trays.some((tray) => tray.id === trayId)) {
      return item.production_batch.id;
    }
  }
  return null;
}
