import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useSearchParams } from "react-router";

import {
  ApiError,
  Package,
  PackageLabel,
  PackageLabelPrintResult,
  PackageLabelUpdate,
  PackageType,
  PlannedPackageInput,
  PlannedPackageRow,
  PackagingOperation,
  PackagingResult,
  PackagingWorksheetItem,
  ProductionBatch,
  StorageLocation,
  packagingApi,
  productionApi,
} from "../api/client";
import {
  PlannedPackageEditor,
  PlannedPackageProjection,
} from "../components/PlannedPackageEditor";
import {
  PackageLabelEditor,
  PlannedPackageRecordAction,
} from "../components/PackagingWorkspaceActions";
import { PackageLabelPreview } from "../components/PackageLabelPreview";
import {
  ALLOCATION_TOLERANCE_GRAMS,
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  toGrams,
} from "../utils/weights";
import {
  printAvery5163Labels,
  reserveAvery5163PrintOutput,
} from "../utils/avery5163Labels";

type PackageLineForm = {
  id: string;
  package_type_id: string;
  package_weight_value: string;
  package_weight_unit: WeightUnit;
  finished_product_weight_value: string;
  finished_product_weight_unit: WeightUnit;
  oxygen_absorber: string;
  storage_location_id: string;
  notes: string;
};

export function PackagingPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const worksheetQuery = useQuery({
    queryKey: ["packaging-worksheet"],
    queryFn: packagingApi.getWorksheet,
  });
  const batchesQuery = useQuery({
    queryKey: ["production-batches"],
    queryFn: productionApi.listProductionBatches,
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
  const completedBatches = useMemo(
    () =>
      (batchesQuery.data ?? []).filter((batch) => batch.status === "Completed"),
    [batchesQuery.data],
  );
  const [activeBatchId, setActiveBatchId] = useState(
    () => searchParams.get("batch") ?? "",
  );
  const requestedBatchId = searchParams.get("batch") ?? "";
  const workspaceRequested = searchParams.get("workspace") === "1";
  const operationQueries = useQueries({
    queries: completedBatches.map((batch) => ({
      queryKey: ["packaging-operation-by-batch", batch.id],
      queryFn: () => getBatchPackagingOperationOrNull(batch.id),
      retry: false,
    })),
  });
  const [selectedTrayIds, setSelectedTrayIds] = useState<string[]>([]);
  const [packageLines, setPackageLines] = useState<PackageLineForm[]>([
    createPackageLine(),
  ]);
  const [packageCountInput, setPackageCountInput] = useState("1");
  const [packagedAt, setPackagedAt] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");
  const [allocationSaveMessage, setAllocationSaveMessage] = useState<
    string | null
  >(null);
  const [newPackageType, setNewPackageType] = useState({
    name: "",
    default_oxygen_absorber: "",
    default_label_template: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackagingResult | null>(null);
  const startingBatchIdRef = useRef<string | null>(null);
  const savingAllocationOperationIdRef = useRef<string | null>(null);

  const activeWorksheetItem = useMemo(
    () =>
      worksheet.find((item) => item.production_batch.id === activeBatchId) ??
      null,
    [activeBatchId, worksheet],
  );
  const worksheetByBatch = useMemo(
    () => new Map(worksheet.map((item) => [item.production_batch.id, item])),
    [worksheet],
  );
  const operationsByBatch = useMemo(
    () =>
      new Map(
        completedBatches.map((batch, index) => [
          batch.id,
          operationQueries[index]?.data ?? null,
        ]),
      ),
    [completedBatches, operationQueries],
  );
  const operationDiscoveryLoading = operationQueries.some(
    (query) => query.isLoading,
  );
  const discoverableBatches = useMemo(
    () =>
      completedBatches.filter(
        (batch) =>
          worksheetByBatch.has(batch.id) ||
          operationsByBatch.get(batch.id) !== null,
      ),
    [completedBatches, operationsByBatch, worksheetByBatch],
  );
  const activeBatch =
    completedBatches.find((batch) => batch.id === activeBatchId) ?? null;
  const activeOperation = operationsByBatch.get(activeBatchId) ?? null;
  const activeOperationQuery = operationQueries.find(
    (_query, index) => completedBatches[index]?.id === activeBatchId,
  );
  const allocatedTrayIds = useMemo(
    () =>
      new Set(
        activeOperation?.allocations.flatMap((allocation) =>
          allocation.source_trays.map((tray) => tray.id),
        ) ?? [],
      ),
    [activeOperation],
  );
  const availableTrays = useMemo(
    () =>
      activeWorksheetItem?.eligible_trays.filter(
        (tray) => !allocatedTrayIds.has(tray.id),
      ) ?? [],
    [activeWorksheetItem, allocatedTrayIds],
  );
  const selectableTrays = useMemo(
    () => availableTrays.filter(hasUsableFinishedProductWeight),
    [availableTrays],
  );
  const allEligibleTraysAllocated =
    (activeWorksheetItem?.eligible_trays.length ?? 0) > 0 &&
    availableTrays.length === 0;
  const selectedTrays = useMemo(
    () => selectableTrays.filter((tray) => selectedTrayIds.includes(tray.id)),
    [selectableTrays, selectedTrayIds],
  );
  const availableSourceWeight = selectableTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams),
    0,
  );
  const selectedSourceWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams),
    0,
  );
  const packageWeightTotal = packageLines.reduce((total, line) => {
    const grams = toGrams(line.package_weight_value, line.package_weight_unit);
    return total + (grams === "" ? 0 : Number(grams));
  }, 0);
  const allocatedFinishedProductWeight = packageLines.reduce((total, line) => {
    const grams = toGrams(
      line.finished_product_weight_value,
      line.finished_product_weight_unit,
    );
    return total + (grams === "" ? 0 : Number(grams));
  }, 0);
  const remainingProductWeight =
    selectedSourceWeight - allocatedFinishedProductWeight;
  const weightDifference = packageWeightTotal - selectedSourceWeight;
  const allocationComplete =
    selectedSourceWeight > 0 &&
    Math.abs(remainingProductWeight) <= ALLOCATION_TOLERANCE_GRAMS;

  const createPackageType = useMutation({
    mutationFn: packagingApi.createPackageType,
    onError: (mutationError) => setError(formatApiError(mutationError)),
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
    onError: (mutationError) => setError(formatApiError(mutationError)),
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
  const startPackagingOperation = useMutation({
    mutationFn: (batchId: string) =>
      packagingApi.startOrResumePackagingOperation({ batchId, body: {} }),
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: (operation) => {
      setError(null);
      queryClient.setQueryData(
        ["packaging-operation-by-batch", operation.production_batch_id],
        operation,
      );
      setSearchParams({
        batch: operation.production_batch_id,
        workspace: "1",
      });
    },
    onSettled: () => {
      startingBatchIdRef.current = null;
    },
  });
  const savePackagingAllocation = useMutation({
    mutationFn: ({
      operationId,
      body,
    }: {
      operationId: string;
      batchId: string;
      body: { tray_ids: string[]; notes: string | null };
    }) => packagingApi.createPackagingAllocation({ operationId, body }),
    onError: (mutationError, variables) => {
      setError(formatApiError(mutationError));
      setAllocationSaveMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["packaging-worksheet"] });
      void queryClient.invalidateQueries({
        queryKey: ["packaging-operation-by-batch", variables.batchId],
      });
    },
    onSuccess: async (_allocation, variables) => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["packaging-worksheet"] }),
        queryClient.invalidateQueries({
          queryKey: ["packaging-operation-by-batch", variables.batchId],
        }),
      ]);
      setSelectedTrayIds([]);
      setAllocationNotes("");
      setAllocationSaveMessage("Packaging Allocation saved.");
    },
    onSettled: () => {
      savingAllocationOperationIdRef.current = null;
    },
  });
  const packageTrays = useMutation({
    mutationFn: packagingApi.packageTrays,
    onError: (mutationError, variables) => {
      setError(formatApiError(mutationError));
      void queryClient.invalidateQueries({ queryKey: ["packaging-worksheet"] });
      void queryClient.invalidateQueries({
        queryKey: [
          "packaging-operation-by-batch",
          variables.production_batch_id,
        ],
      });
    },
    onSuccess: (packagingResult) => {
      setResult(packagingResult);
      setError(null);
      setSelectedTrayIds([]);
      setPackageLines([createPackageLine(packageTypes[0])]);
      setPackageCountInput("1");
      setPackagedAt("");
      setSessionNotes("");
      setAllocationNotes("");
      setAllocationSaveMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["packaging-worksheet"] });
      void queryClient.invalidateQueries({ queryKey: ["production-batches"] });
      void queryClient.invalidateQueries({ queryKey: ["freeze-dryers"] });
      void queryClient.invalidateQueries({
        queryKey: [
          "packaging-operation-by-batch",
          packagingResult.packaging_operation.production_batch_id,
        ],
      });
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

  useEffect(() => {
    const selectableTrayIds = new Set(selectableTrays.map((tray) => tray.id));
    setSelectedTrayIds((current) => {
      const next = current.filter((trayId) => selectableTrayIds.has(trayId));
      return next.length === current.length ? current : next;
    });
  }, [selectableTrays]);

  useEffect(() => {
    if (requestedBatchId !== "") {
      if (activeBatchId !== requestedBatchId) {
        setActiveBatchId(requestedBatchId);
        setSelectedTrayIds([]);
        setPackageLines([createPackageLine(packageTypes[0])]);
        setPackageCountInput("1");
        setPackagedAt("");
        setSessionNotes("");
        setAllocationNotes("");
        setAllocationSaveMessage(null);
        setResult(null);
        setError(null);
      }
      return;
    }
    if (discoverableBatches.some((batch) => batch.id === activeBatchId)) {
      setSearchParams({ batch: activeBatchId }, { replace: true });
      return;
    }
    const defaultBatchId = discoverableBatches[0]?.id ?? "";
    setActiveBatchId(defaultBatchId);
    if (defaultBatchId !== "") {
      setSearchParams({ batch: defaultBatchId }, { replace: true });
    }
  }, [
    activeBatchId,
    discoverableBatches,
    packageTypes,
    requestedBatchId,
    setSearchParams,
  ]);

  const discoveryLoading =
    batchesQuery.isLoading ||
    worksheetQuery.isLoading ||
    operationDiscoveryLoading;
  const selectedBatchProblem = getSelectedBatchProblem({
    activeBatch,
    activeBatchId,
    activeOperation,
    activeOperationQuery,
    batches: batchesQuery.data ?? [],
    discoveryLoading,
    requestedBatchId,
    worksheetItem: activeWorksheetItem,
  });

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

  function toggleTray(trayId: string) {
    if (!selectableTrays.some((tray) => tray.id === trayId)) return;
    setResult(null);
    setAllocationSaveMessage(null);
    setSelectedTrayIds((current) => {
      if (current.includes(trayId)) {
        return current.filter((id) => id !== trayId);
      }
      return [...current, trayId];
    });
  }

  function selectBatch(batchId: string) {
    setActiveBatchId(batchId);
    setSelectedTrayIds([]);
    setPackageLines([createPackageLine(packageTypes[0])]);
    setPackageCountInput("1");
    setPackagedAt("");
    setSessionNotes("");
    setAllocationNotes("");
    setAllocationSaveMessage(null);
    setResult(null);
    setError(null);
    if (batchId === "") {
      setSearchParams({});
    } else {
      setSearchParams({ batch: batchId });
    }
  }

  function openWorkspace(
    batchId: string,
    operation: PackagingOperation | null,
  ) {
    setActiveBatchId(batchId);
    setError(null);
    if (operation) {
      setSearchParams({ batch: batchId, workspace: "1" });
      return;
    }
    if (startingBatchIdRef.current !== null) return;
    startingBatchIdRef.current = batchId;
    startPackagingOperation.mutate(batchId);
  }

  function selectAllActiveTrays() {
    setResult(null);
    setAllocationSaveMessage(null);
    setSelectedTrayIds(selectableTrays.map((tray) => tray.id));
  }

  function saveSelectedPackagingAllocation() {
    if (
      !activeBatch ||
      !activeOperation ||
      activeOperation.status !== "Open" ||
      selectedTrays.length === 0 ||
      savingAllocationOperationIdRef.current !== null
    ) {
      return;
    }
    savingAllocationOperationIdRef.current = activeOperation.id;
    setError(null);
    setAllocationSaveMessage(null);
    savePackagingAllocation.mutate({
      operationId: activeOperation.id,
      batchId: activeBatch.id,
      body: {
        tray_ids: selectedTrays.map((tray) => tray.id),
        notes: allocationNotes.trim() === "" ? null : allocationNotes.trim(),
      },
    });
  }

  function setPackageCount(count: number) {
    if (!Number.isInteger(count) || count < 1 || count > 50) return;
    setPackageCountInput(String(count));
    setPackageLines((lines) => {
      if (count <= lines.length) return lines.slice(0, count);
      return [
        ...lines,
        ...Array.from({ length: count - lines.length }, () =>
          createPackageLine(packageTypes[0]),
        ),
      ];
    });
  }

  function changePackageCount(value: string) {
    setPackageCountInput(value);
    if (!/^\d+$/.test(value)) return;
    const count = Number(value);
    if (!Number.isInteger(count) || count < 1 || count > 50) return;
    setPackageLines((lines) => {
      if (count <= lines.length) return lines.slice(0, count);
      return [
        ...lines,
        ...Array.from({ length: count - lines.length }, () =>
          createPackageLine(packageTypes[0]),
        ),
      ];
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

  function addPackageForRemaining() {
    if (remainingProductWeight <= ALLOCATION_TOLERANCE_GRAMS) return;

    setPackageLines((lines) => {
      const finishedProductWeight = formatEditableGrams(remainingProductWeight);
      const emptyLineIndex = lines.findIndex(
        (line) => line.finished_product_weight_value === "",
      );
      const nextLines =
        emptyLineIndex >= 0
          ? lines.map((line, index) =>
              index === emptyLineIndex
                ? {
                    ...line,
                    finished_product_weight_value: finishedProductWeight,
                    finished_product_weight_unit: "g" as WeightUnit,
                  }
                : line,
            )
          : [
              ...lines,
              {
                ...createPackageLine(packageTypes[0]),
                finished_product_weight_value: finishedProductWeight,
                finished_product_weight_unit: "g" as WeightUnit,
              },
            ];
      setPackageCountInput(String(nextLines.length));
      return nextLines;
    });
  }

  function handlePackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorksheetItem) {
      setError("Select a Production Batch before finishing Packaging.");
      return;
    }
    if (!allocationComplete) {
      setError(
        "Allocate all selected Finished Product Weight before finishing Packaging.",
      );
      return;
    }
    const packages = packageLines
      .map((line) => ({
        package_type_id: line.package_type_id,
        finished_product_weight_grams: toGrams(
          line.finished_product_weight_value,
          line.finished_product_weight_unit,
        ),
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
          line.package_type_id !== "" &&
          line.finished_product_weight_grams !== "" &&
          line.package_weight_grams !== "",
      );
    packageTrays.mutate({
      production_batch_id: activeWorksheetItem.production_batch.id,
      tray_ids: selectedTrays.map((tray) => tray.id),
      packaged_at:
        packagedAt === "" ? null : new Date(packagedAt).toISOString(),
      notes: sessionNotes.trim() === "" ? null : sessionNotes,
      packages,
      batch_number: activeWorksheetItem.production_batch.batch_number,
      freeze_dryer: activeWorksheetItem.production_batch.freeze_dryer.name,
      product_summary: uniqueSummary(
        selectedTrays.map((tray) => tray.product_name),
      ),
      preparation_summary: uniqueSummary(
        selectedTrays.map((tray) => tray.preparation),
      ),
      source_starting_weight_grams: selectedTrays.reduce(
        (total, tray) => total + Number(tray.starting_weight_grams ?? 0),
        0,
      ),
    });
  }

  async function savePlannedPackages(
    operationId: string,
    allocationId: string,
    plannedPackages: PlannedPackageInput[],
  ) {
    await packagingApi.updatePackagingAllocation({
      operationId,
      allocationId,
      body: { planned_packages: plannedPackages },
    });
  }

  async function refreshPlannedPackages(batchId: string, allocationId: string) {
    const refreshedOperation = await refreshPackagingOperation(batchId);
    const refreshedAllocation = refreshedOperation.allocations.find(
      (allocation) => allocation.id === allocationId,
    );
    if (!refreshedAllocation) {
      throw new Error(
        "The saved Packaging Allocation is no longer present in the latest operation state.",
      );
    }
    return refreshedAllocation.planned_packages;
  }

  async function refreshPackagingOperation(batchId: string) {
    const queryKey = ["packaging-operation-by-batch", batchId] as const;
    const currentOperation =
      queryClient.getQueryData<PackagingOperation | null>(queryKey);
    await queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    let refreshedOperation: PackagingOperation | null;
    try {
      refreshedOperation = await queryClient.fetchQuery({
        queryKey,
        queryFn: () => getBatchPackagingOperationOrNull(batchId),
      });
    } catch (refreshError) {
      if (currentOperation !== undefined) {
        queryClient.setQueryData(queryKey, currentOperation);
      }
      throw refreshError;
    }
    if (!refreshedOperation) {
      throw new Error(
        "The saved Packaging Operation is no longer present in the latest backend state.",
      );
    }
    return refreshedOperation;
  }

  async function refreshPackagingWorksheet() {
    const queryKey = ["packaging-worksheet"] as const;
    const currentWorksheet =
      queryClient.getQueryData<PackagingWorksheetItem[]>(queryKey);
    await queryClient.invalidateQueries({ queryKey, refetchType: "none" });
    try {
      return await queryClient.fetchQuery({
        queryKey,
        queryFn: packagingApi.getWorksheet,
      });
    } catch (refreshError) {
      if (currentWorksheet !== undefined) {
        queryClient.setQueryData(queryKey, currentWorksheet);
      }
      throw refreshError;
    }
  }

  async function completePackagingOperation(
    operationId: string,
    batchId: string,
  ) {
    const completedOperation = await packagingApi.completePackagingOperation({
      operationId,
      body: {},
    });
    queryClient.setQueryData(
      ["packaging-operation-by-batch", batchId],
      completedOperation,
    );
    return completedOperation;
  }

  async function refreshCompletedPackagingWorkspace(batchId: string) {
    await Promise.all([
      refreshPackagingOperation(batchId),
      refreshPackagingWorksheet(),
    ]);
  }

  async function recordPlannedPackage(
    operationId: string,
    allocationId: string,
    plannedPackageRowId: string,
  ) {
    await packagingApi.recordAllocationPackages({
      operationId,
      allocationId,
      body: {
        packages: [{ planned_package_row_id: plannedPackageRowId }],
      },
    });
  }

  async function savePackageLabel(packageId: string, body: PackageLabelUpdate) {
    await packagingApi.updatePackageLabel({ packageId, body });
  }

  async function refreshPackageLabel(batchId: string, packageId: string) {
    const refreshedOperation = await refreshPackagingOperation(batchId);
    const recordedPackage = refreshedOperation.allocations
      .flatMap((allocation) => allocation.packages)
      .find((candidate) => candidate.id === packageId);
    if (!recordedPackage?.label) {
      throw new Error(
        "The saved Package Label is no longer present in the latest operation state.",
      );
    }
    return recordedPackage.label;
  }

  async function previewPackageLabels(packageLabelIds: string[]) {
    return packagingApi.previewPackageLabels({
      package_label_ids: packageLabelIds,
    });
  }

  async function printPackageLabels(
    batchId: string,
    packageLabelIds: string[],
  ) {
    const printResult = await packagingApi.printPackageLabels({
      package_label_ids: packageLabelIds,
      template: "Avery 5163",
    });
    const queryKey = ["packaging-operation-by-batch", batchId] as const;
    queryClient.setQueryData<PackagingOperation | null>(queryKey, (current) =>
      current
        ? operationWithAuthoritativeLabels(current, printResult.labels)
        : current,
    );
    return printResult;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="order-1">
        <h2 className="text-3xl font-semibold">Packaging</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Prepare a Packaging Session from completed Trays, create Packages, and
          print human-readable labels before moving to the packaging table.
        </p>
      </section>

      {result ? (
        <div className="order-2">
          <PackagingComplete result={result} />
        </div>
      ) : null}

      {error ? (
        <p
          className="order-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="panel order-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">Packaging Worksheet</h3>
            <p className="mt-1 text-sm text-slate-600">
              Choose one Production Batch, then select the Trays being combined
              for this Packaging Session.
            </p>
          </div>
          {selectedTrays.length > 0 ? (
            <p className="text-sm font-semibold text-slate-700">
              Selected source weight:{" "}
              {formatGrams(String(selectedSourceWeight))}
            </p>
          ) : null}
        </div>
        {discoveryLoading ? (
          <p className="mt-4 text-slate-600">Loading Packaging Worksheet.</p>
        ) : worksheetQuery.isError || batchesQuery.isError ? (
          <p className="mt-4 text-red-700" role="alert">
            {formatApiError(worksheetQuery.error ?? batchesQuery.error)}
          </p>
        ) : discoverableBatches.length === 0 && !selectedBatchProblem ? (
          <p className="mt-4 text-slate-600">
            No completed Trays are ready for Packaging.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="field max-w-xl">
              <span>Production Batch</span>
              <select
                aria-label="Production Batch"
                disabled={savePackagingAllocation.isPending}
                value={
                  discoverableBatches.some(
                    (batch) => batch.id === activeBatchId,
                  )
                    ? activeBatchId
                    : ""
                }
                onChange={(event) => selectBatch(event.target.value)}
              >
                <option value="">Select a Production Batch</option>
                {discoverableBatches.map((batch) => {
                  const worksheetItem = worksheetByBatch.get(batch.id);
                  const eligibleTrayCount =
                    worksheetItem?.eligible_trays.length ?? 0;
                  return (
                    <option key={batch.id} value={batch.id}>
                      {batch.batch_number} · {batch.freeze_dryer.name} ·{" "}
                      {eligibleTrayCount} completed Tray
                      {eligibleTrayCount === 1 ? "" : "s"} ·{" "}
                      {formatGrams(
                        String(worksheetItem?.source_weight_grams ?? 0),
                      )}{" "}
                      ready ·{" "}
                      {operationsByBatch.get(batch.id)?.status ?? "Not Started"}
                    </option>
                  );
                })}
              </select>
            </label>

            {selectedBatchProblem ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-950" role="alert">
                  {selectedBatchProblem}
                </p>
                {discoverableBatches.length > 0 ? (
                  <p className="mt-1 text-sm text-amber-900">
                    Select another Production Batch to continue Packaging.
                  </p>
                ) : null}
              </div>
            ) : activeBatch ? (
              <article className="object-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-semibold">
                      {activeBatch.batch_number}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {activeBatch.freeze_dryer.name} · {availableTrays.length}{" "}
                      completed Tray
                      {availableTrays.length === 1 ? "" : "s"} ·{" "}
                      {formatGrams(String(availableSourceWeight))} available
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      Packaging Operation:{" "}
                      {activeOperation?.status ?? "Not Started"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="primary-action"
                      disabled={
                        startPackagingOperation.isPending ||
                        activeOperationQuery?.isLoading ||
                        activeOperationQuery?.isError
                      }
                      type="button"
                      onClick={() =>
                        openWorkspace(activeBatch.id, activeOperation)
                      }
                    >
                      {activeOperation?.status === "Open"
                        ? "Continue Packaging"
                        : activeOperation?.status === "Completed"
                          ? "View Packaging"
                          : "Start Packaging"}
                    </button>
                    <Link
                      className="text-link text-sm"
                      to={`/production/${activeBatch.id}`}
                    >
                      View Batch
                    </Link>
                  </div>
                </div>
                {activeOperationQuery?.isError ? (
                  <p className="mt-3 text-red-700" role="alert">
                    {formatApiError(activeOperationQuery.error)}
                  </p>
                ) : null}
                {workspaceRequested && activeOperation ? (
                  <>
                    <PackagingOperationWorkspace
                      availableTrays={availableTrays}
                      batch={activeBatch}
                      formatError={formatApiError}
                      key={activeOperation.id}
                      onCompleteOperation={() =>
                        completePackagingOperation(
                          activeOperation.id,
                          activeOperation.production_batch_id,
                        )
                      }
                      onRecordPlannedPackage={recordPlannedPackage}
                      onPreviewPackageLabels={previewPackageLabels}
                      onPrintPackageLabels={(packageLabelIds) =>
                        printPackageLabels(
                          activeOperation.production_batch_id,
                          packageLabelIds,
                        )
                      }
                      onRefreshOperation={async (batchId) => {
                        await refreshPackagingOperation(batchId);
                      }}
                      onRefreshCompletedWorkspace={() =>
                        refreshCompletedPackagingWorkspace(
                          activeOperation.production_batch_id,
                        )
                      }
                      onRefreshPlannedPackages={refreshPlannedPackages}
                      onRefreshPackageLabel={refreshPackageLabel}
                      onSavePackageLabel={savePackageLabel}
                      onSavePlannedPackages={savePlannedPackages}
                      operation={activeOperation}
                      packageTypes={packageTypes}
                      storageLocations={storageLocations}
                    />
                    {activeOperation.status === "Open" ? (
                      <section
                        aria-label="Prepare Packaging Allocation"
                        className="mt-5 border-t border-slate-200 pt-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h5 className="font-semibold">
                              Prepare Packaging Allocation
                            </h5>
                            <p className="mt-1 text-sm text-slate-600">
                              Select completed Trays from this Production Batch
                              for the next Packaging Allocation. Save the source
                              selection to resume later, or continue below when
                              you are ready to record Packages.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectableTrays.length > 0 ? (
                              <button
                                className="quiet-action"
                                disabled={savePackagingAllocation.isPending}
                                type="button"
                                onClick={selectAllActiveTrays}
                              >
                                Select All Available Trays
                              </button>
                            ) : null}
                            {selectedTrays.length > 0 ? (
                              <button
                                className="quiet-action"
                                disabled={savePackagingAllocation.isPending}
                                type="button"
                                onClick={() => {
                                  setSelectedTrayIds([]);
                                  setAllocationSaveMessage(null);
                                }}
                              >
                                Clear Selection
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div
                          aria-busy={savePackagingAllocation.isPending}
                          className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                        >
                          <label className="field">
                            <span>Allocation Notes</span>
                            <input
                              disabled={savePackagingAllocation.isPending}
                              placeholder="Optional context for this product combination"
                              value={allocationNotes}
                              onChange={(event) => {
                                setAllocationNotes(event.target.value);
                                setAllocationSaveMessage(null);
                              }}
                            />
                          </label>
                          <button
                            className="primary-action"
                            disabled={
                              selectedTrays.length === 0 ||
                              savePackagingAllocation.isPending
                            }
                            type="button"
                            onClick={saveSelectedPackagingAllocation}
                          >
                            {savePackagingAllocation.isPending
                              ? "Saving Packaging Allocation…"
                              : "Save Packaging Allocation"}
                          </button>
                          <p className="text-sm text-slate-600 sm:col-span-2">
                            Saving records this source selection in Freezeflow
                            so the Packaging Allocation can be resumed later. It
                            does not complete Packaging.
                          </p>
                        </div>

                        {allocationSaveMessage ? (
                          <p
                            className="mt-3 text-sm font-semibold text-emerald-800"
                            role="status"
                          >
                            {allocationSaveMessage}
                          </p>
                        ) : null}

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="object-card">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Available Completed Trays
                            </p>
                            <p className="mt-1 text-xl font-semibold">
                              {availableTrays.length}
                            </p>
                          </div>
                          <div className="object-card">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Available Source Weight
                            </p>
                            <p className="mt-1 text-xl font-semibold">
                              {formatGrams(String(availableSourceWeight))}
                            </p>
                          </div>
                          <div className="object-card">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Selected Completed Trays
                            </p>
                            <p className="mt-1 text-xl font-semibold">
                              {selectedTrays.length}
                            </p>
                          </div>
                          <div className="object-card">
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              Selected Source Weight
                            </p>
                            <p className="mt-1 text-xl font-semibold">
                              {formatGrams(String(selectedSourceWeight))}
                            </p>
                          </div>
                        </div>

                        {selectedTrays.length === 0 ? (
                          <p className="mt-3 text-sm text-slate-600">
                            No completed Trays are selected for the pending
                            Packaging Allocation.
                          </p>
                        ) : (
                          <p className="mt-3 text-sm font-semibold text-slate-700">
                            {selectedTrays.length} completed Tray
                            {selectedTrays.length === 1 ? "" : "s"} selected ·{" "}
                            {formatGrams(String(selectedSourceWeight))} selected
                            source weight
                          </p>
                        )}

                        {availableTrays.length > selectableTrays.length ? (
                          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {availableTrays.length - selectableTrays.length}{" "}
                            completed Tray
                            {availableTrays.length - selectableTrays.length ===
                            1
                              ? " has"
                              : "s have"}{" "}
                            unavailable Finished Product Weight and cannot be
                            selected.
                          </p>
                        ) : null}

                        {availableTrays.length === 0 ? (
                          <p className="mt-3 text-slate-600">
                            {allEligibleTraysAllocated
                              ? "All completed Trays available to this operation are already assigned to saved Packaging Allocations."
                              : "No additional completed Trays are available for this Packaging Operation."}
                          </p>
                        ) : (
                          <div className="mt-3 overflow-x-auto">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Select</th>
                                  <th>Physical Tray / Slot</th>
                                  <th>Product</th>
                                  <th>Finished Product Weight</th>
                                  <th>Preparation / Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {availableTrays.map((tray) => {
                                  const selectable =
                                    hasUsableFinishedProductWeight(tray);
                                  const selected = selectedTrayIds.includes(
                                    tray.id,
                                  );
                                  return (
                                    <tr
                                      className={
                                        selected ? "bg-sky-50" : undefined
                                      }
                                      key={tray.id}
                                    >
                                      <td>
                                        <input
                                          aria-label={`Select Slot ${tray.tray_slot.slot_number} ${tray.product_name}`}
                                          checked={selected}
                                          disabled={
                                            !selectable ||
                                            savePackagingAllocation.isPending
                                          }
                                          type="checkbox"
                                          onChange={() => toggleTray(tray.id)}
                                        />
                                      </td>
                                      <td>
                                        <span className="font-semibold">
                                          {tray.physical_tray.label}
                                        </span>
                                        <span className="block text-sm text-slate-600">
                                          Slot {tray.tray_slot.slot_number}
                                        </span>
                                      </td>
                                      <td>{tray.product_name}</td>
                                      <td>
                                        {selectable ? (
                                          formatGrams(
                                            tray.final_dry_weight_grams,
                                          )
                                        ) : (
                                          <span className="font-semibold text-amber-800">
                                            Unavailable — weight history
                                            incomplete
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {tray.preparation || "No preparation"}
                                        {tray.notes ? (
                                          <span className="block text-sm text-slate-600">
                                            {tray.notes}
                                          </span>
                                        ) : null}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Start or continue this Packaging Operation to open its saved
                    workspace.
                  </p>
                )}
              </article>
            ) : null}
          </div>
        )}
      </section>

      {workspaceRequested &&
      activeOperation?.status === "Open" &&
      activeWorksheetItem ? (
        <form
          className="panel order-4 space-y-5"
          onSubmit={handlePackageSubmit}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="section-title">Create Packages</h3>
              <p className="mt-1 text-sm text-slate-600">
                Divide the selected mixed product among Packages. Finished
                Product Weight reduces the amount left to package; Sealed
                Package Weight includes the bag and absorber.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <label className="field w-32">
                <span>Package Count</span>
                <input
                  aria-label="Package Count"
                  max="50"
                  min="1"
                  type="number"
                  value={packageCountInput}
                  onBlur={() =>
                    setPackageCountInput(String(packageLines.length))
                  }
                  onChange={(event) => changePackageCount(event.target.value)}
                />
              </label>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setPackageCount(packageLines.length + 1)}
              >
                + Add Package
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Selected Source
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatGrams(String(selectedSourceWeight))}
              </p>
              <p className="text-sm text-slate-600">
                {selectedTrays.length} Tray
                {selectedTrays.length === 1 ? "" : "s"} mixed
              </p>
            </div>
            <div className="rounded-md border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Allocated To Packages
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatGrams(String(allocatedFinishedProductWeight))}
              </p>
            </div>
            <div
              className={`rounded-md border px-4 py-3 ${
                Math.abs(remainingProductWeight) > ALLOCATION_TOLERANCE_GRAMS
                  ? "border-amber-300 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase text-slate-600">
                {remainingProductWeight < 0
                  ? "Over Allocated"
                  : "Remaining To Package"}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatGrams(String(Math.abs(remainingProductWeight)))}
              </p>
            </div>
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
                  <th>Package</th>
                  <th>Package Type</th>
                  <th>Finished Product Weight</th>
                  <th>Sealed Package Weight</th>
                  <th>Oxygen Absorber</th>
                  <th>Storage</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {packageLines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="font-semibold">{index + 1}</td>
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
                      <div className="flex min-w-48 items-center gap-2">
                        <input
                          aria-label="Finished Product Weight"
                          className="table-input min-w-0 flex-1"
                          min="0"
                          required
                          step="0.001"
                          type="number"
                          value={line.finished_product_weight_value}
                          onChange={(event) =>
                            updatePackageLine(line.id, {
                              finished_product_weight_value: event.target.value,
                            })
                          }
                        />
                        <select
                          aria-label="Finished Product Weight Unit"
                          className="table-input w-20 shrink-0"
                          value={line.finished_product_weight_unit}
                          onChange={(event) =>
                            updatePackageLine(line.id, {
                              finished_product_weight_unit: event.target
                                .value as WeightUnit,
                            })
                          }
                        >
                          {WEIGHT_UNIT_OPTIONS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div className="flex min-w-48 items-center gap-2">
                        <input
                          aria-label="Sealed Package Weight"
                          className="table-input min-w-0 flex-1"
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
                        <select
                          aria-label="Sealed Package Weight Unit"
                          className="table-input w-20 shrink-0"
                          value={line.package_weight_unit}
                          onChange={(event) =>
                            updatePackageLine(line.id, {
                              package_weight_unit: event.target
                                .value as WeightUnit,
                            })
                          }
                        >
                          {WEIGHT_UNIT_OPTIONS.map((unit) => (
                            <option key={unit.value} value={unit.value}>
                              {unit.label}
                            </option>
                          ))}
                        </select>
                      </div>
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
                            lines.filter(
                              (candidate) => candidate.id !== line.id,
                            ),
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

          {remainingProductWeight > ALLOCATION_TOLERANCE_GRAMS ? (
            <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-amber-950">
                {formatGrams(String(remainingProductWeight))} still needs a
                Package. Add another Package before finishing Packaging.
              </p>
              <button
                className="secondary-action shrink-0"
                type="button"
                onClick={addPackageForRemaining}
              >
                + Add Package for Remaining
              </button>
            </div>
          ) : null}

          {remainingProductWeight < 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Finished Product Weight is over allocated by{" "}
              {formatGrams(String(Math.abs(remainingProductWeight)))}. Review
              the Package rows before finishing.
            </p>
          ) : null}
          {packageWeightTotal > 0 && Math.abs(weightDifference) > 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Package weights differ from selected Finished Product Weight by{" "}
              {formatGrams(String(weightDifference))}. This warning will not
              block Packaging.
            </p>
          ) : null}
          <button
            className="primary-action"
            disabled={
              selectedTrays.length === 0 ||
              packageTypes.length === 0 ||
              !allocationComplete ||
              packageTrays.isPending
            }
            type="submit"
          >
            Finish Packaging
          </button>
        </form>
      ) : null}

      <section className="panel order-5">
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
          <button
            className="secondary-action self-end"
            disabled={createPackageType.isPending}
            type="submit"
          >
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
                  disabled={archivePackageType.isPending}
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
    </div>
  );
}

async function getBatchPackagingOperationOrNull(batchId: string) {
  try {
    return await packagingApi.getBatchPackagingOperation(batchId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function getSelectedBatchProblem({
  activeBatch,
  activeBatchId,
  activeOperation,
  activeOperationQuery,
  batches,
  discoveryLoading,
  requestedBatchId,
  worksheetItem,
}: {
  activeBatch: ProductionBatch | null;
  activeBatchId: string;
  activeOperation: PackagingOperation | null;
  activeOperationQuery: { isError: boolean; error: Error | null } | undefined;
  batches: ProductionBatch[];
  discoveryLoading: boolean;
  requestedBatchId: string;
  worksheetItem: PackagingWorksheetItem | null;
}) {
  if (discoveryLoading || requestedBatchId === "") return null;
  if (activeOperationQuery?.isError) {
    return `Packaging Operation failed to load: ${formatApiError(
      activeOperationQuery.error,
    )}`;
  }

  const requestedBatch = batches.find((batch) => batch.id === requestedBatchId);
  if (!requestedBatch) {
    return `The selected Production Batch (${activeBatchId}) no longer exists.`;
  }
  if (requestedBatch.status !== "Completed") {
    return `${requestedBatch.batch_number} is not available for Packaging because it is not Completed.`;
  }
  if (!activeBatch || (!worksheetItem && !activeOperation)) {
    return `${requestedBatch.batch_number} has no completed Trays ready for Packaging and no saved Packaging Operation.`;
  }
  return null;
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    const detail = formatApiErrorDetail(error.detail) || error.message;
    return error.code ? `${error.code}: ${detail}` : detail;
  }
  return error instanceof Error
    ? error.message || "Unable to complete the Packaging action."
    : "Unable to complete the Packaging request.";
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail.map(formatApiErrorDetail).filter(Boolean).join("; ");
  }
  if (!detail || typeof detail !== "object") return "";

  const value = detail as Record<string, unknown>;
  const directMessage = value.message ?? value.msg ?? value.reason;
  if (typeof directMessage === "string" && directMessage.trim() !== "") {
    const location =
      formatApiErrorLocation(value.loc) ||
      (typeof value.field === "string"
        ? value.field.trim().replace(/_/g, " ")
        : "");
    const formattedMessage = location
      ? `${location}: ${directMessage.trim()}`
      : directMessage.trim();
    const nestedErrors = formatApiErrorDetail(value.errors);
    return nestedErrors
      ? `${formattedMessage}; ${nestedErrors}`
      : formattedMessage;
  }

  for (const key of ["detail", "errors", "error"]) {
    const nestedMessage = formatApiErrorDetail(value[key]);
    if (nestedMessage) return nestedMessage;
  }

  return Object.entries(value)
    .filter(([key]) => !["code", "status", "type", "loc"].includes(key))
    .map(([, nestedValue]) => formatApiErrorDetail(nestedValue))
    .filter(Boolean)
    .join("; ");
}

function formatApiErrorLocation(location: unknown) {
  if (!Array.isArray(location)) return "";
  return location
    .filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number",
    )
    .filter((part) => part !== "body")
    .map((part) => String(part).replace(/_/g, " "))
    .join(" ");
}

function PackagingOperationWorkspace({
  availableTrays,
  batch,
  formatError,
  onCompleteOperation,
  onRecordPlannedPackage,
  onPreviewPackageLabels,
  onPrintPackageLabels,
  onRefreshOperation,
  onRefreshCompletedWorkspace,
  onRefreshPackageLabel,
  onRefreshPlannedPackages,
  onSavePackageLabel,
  onSavePlannedPackages,
  operation,
  packageTypes,
  storageLocations,
}: {
  availableTrays: PackagingWorksheetItem["eligible_trays"];
  batch: ProductionBatch;
  formatError: (error: unknown) => string;
  onCompleteOperation: () => Promise<PackagingOperation>;
  onRecordPlannedPackage: (
    operationId: string,
    allocationId: string,
    plannedPackageRowId: string,
  ) => Promise<void>;
  onPreviewPackageLabels: (
    packageLabelIds: string[],
  ) => Promise<PackageLabel[]>;
  onPrintPackageLabels: (
    packageLabelIds: string[],
  ) => Promise<PackageLabelPrintResult>;
  onRefreshOperation: (batchId: string) => Promise<void>;
  onRefreshCompletedWorkspace: () => Promise<void>;
  onRefreshPackageLabel: (
    batchId: string,
    packageId: string,
  ) => Promise<PackageLabel>;
  onRefreshPlannedPackages: (
    batchId: string,
    allocationId: string,
  ) => Promise<PlannedPackageRow[]>;
  onSavePackageLabel: (
    packageId: string,
    body: PackageLabelUpdate,
  ) => Promise<void>;
  onSavePlannedPackages: (
    operationId: string,
    allocationId: string,
    plannedPackages: PlannedPackageInput[],
  ) => Promise<void>;
  operation: PackagingOperation;
  packageTypes: PackageType[];
  storageLocations: StorageLocation[];
}) {
  const [draftProjections, setDraftProjections] = useState<
    Record<string, PlannedPackageProjection>
  >({});
  const handleProjectionChange = useCallback(
    (projection: PlannedPackageProjection) => {
      setDraftProjections((current) => {
        const previous = current[projection.allocationId];
        if (
          previous &&
          previous.balanceState === projection.balanceState &&
          previous.dirty === projection.dirty &&
          previous.locallyValid === projection.locallyValid &&
          previous.projectedAllocatedWeightGrams ===
            projection.projectedAllocatedWeightGrams &&
          previous.projectedRemainingWeightGrams ===
            projection.projectedRemainingWeightGrams
        ) {
          return current;
        }
        return { ...current, [projection.allocationId]: projection };
      });
    },
    [],
  );
  const selectedWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.selected_weight_grams),
    ),
  );
  const allocatedWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.allocated_weight_grams),
    ),
  );
  const remainingWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.remaining_weight_grams),
    ),
  );
  const plannedPackageCount = operation.allocations.reduce(
    (total, allocation) => total + allocation.planned_packages.length,
    0,
  );
  const recordedPackageCount = operation.allocations.reduce(
    (total, allocation) => total + allocation.packages.length,
    0,
  );
  const allocationEvaluations = operation.allocations.map(
    (allocation, index) => {
      const savedWeightsAvailable = [
        allocation.selected_weight_grams,
        allocation.allocated_weight_grams,
        allocation.remaining_weight_grams,
      ].every(isFiniteWeight);
      const savedRowsValid = allocation.planned_packages
        .filter((row) => row.recorded_package_id === null)
        .every((row) =>
          isSavedPlannedPackageValid(row, packageTypes, storageLocations),
        );
      const savedBalanceState = getAllocationBalanceState(
        savedWeightsAvailable
          ? Number(allocation.remaining_weight_grams)
          : null,
        savedRowsValid && savedWeightsAvailable,
      );
      const projection =
        operation.status === "Open"
          ? draftProjections[allocation.id]
          : undefined;
      return {
        allocation,
        allocationNumber: index + 1,
        effectiveBalanceState: projection?.dirty
          ? projection.balanceState
          : savedBalanceState,
        projection,
        savedBalanceState,
        savedWeightsAvailable,
      };
    },
  );
  const dirtyEvaluations = allocationEvaluations.filter(
    ({ projection }) => projection?.dirty,
  );
  const projectedAllocatedWeight = sumAvailableWeights(
    allocationEvaluations.map(({ allocation, projection }) =>
      projection?.dirty
        ? projection.projectedAllocatedWeightGrams
        : Number(allocation.allocated_weight_grams),
    ),
  );
  const projectedRemainingWeight = sumAvailableWeights(
    allocationEvaluations.map(({ allocation, projection }) =>
      projection?.dirty
        ? projection.projectedRemainingWeightGrams
        : Number(allocation.remaining_weight_grams),
    ),
  );
  const stateCounts = allocationEvaluations.reduce(
    (counts, evaluation) => ({
      ...counts,
      [evaluation.effectiveBalanceState]:
        counts[evaluation.effectiveBalanceState] + 1,
    }),
    { Balanced: 0, Incomplete: 0, Overallocated: 0, Remaining: 0 },
  );
  const completionBlockers = getCompletionBlockers(
    operation,
    allocationEvaluations,
  );
  const appearsEligible =
    operation.status === "Open" && completionBlockers.length === 0;

  return (
    <section
      aria-label="Packaging Operation workspace"
      className="mt-5 space-y-4 border-t border-slate-200 pt-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h5 className="font-semibold">Packaging Operation</h5>
          <p className="mt-1 text-sm text-slate-600">
            {batch.batch_number} · {batch.freeze_dryer.name}
          </p>
        </div>
        <p className="font-semibold text-slate-700">{operation.status}</p>
      </div>

      {operation.status === "Completed" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Packaging is complete. This workspace is read-only history.
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            It remains available as historical context for this Production
            Batch.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-sm font-semibold text-sky-950">
            Packaging is in progress and this work is saved in Freezeflow.
          </p>
          <p className="mt-1 text-sm text-sky-900">
            Refreshing or closing this page does not discard backend-saved work.
            You may safely leave and resume later.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Production Batch
          </p>
          <p className="mt-1 font-semibold">{batch.batch_number}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Freeze Dryer
          </p>
          <p className="mt-1 font-semibold">{batch.freeze_dryer.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Status
          </p>
          <p className="mt-1 font-semibold">{operation.status}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Started
          </p>
          <p className="mt-1 text-sm">
            <time dateTime={operation.started_at}>
              {new Date(operation.started_at).toLocaleString()}
            </time>
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Last Updated
          </p>
          <p className="mt-1 text-sm">
            <time dateTime={operation.updated_at}>
              {new Date(operation.updated_at).toLocaleString()}
            </time>
          </p>
        </div>
        {operation.completed_at ? (
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Completed
            </p>
            <p className="mt-1 text-sm">
              <time dateTime={operation.completed_at}>
                {new Date(operation.completed_at).toLocaleString()}
              </time>
            </p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Notes
          </p>
          <p className="mt-1 text-sm">{operation.notes || "No notes"}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Packaging Allocations
          </p>
          <p className="mt-1 text-xl font-semibold">
            {operation.allocations.length}
          </p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Planned Package Rows
          </p>
          <p className="mt-1 text-xl font-semibold">{plannedPackageCount}</p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Recorded Packages
          </p>
          <p className="mt-1 text-xl font-semibold">{recordedPackageCount}</p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Available Completed Trays
          </p>
          <p className="mt-1 text-xl font-semibold">{availableTrays.length}</p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Saved Selected Source Weight
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatOptionalWorkspaceWeight(selectedWeight)}
          </p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Saved Allocated Weight
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatOptionalWorkspaceWeight(allocatedWeight)}
          </p>
        </div>
        <div className="object-card">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Saved Remaining Weight
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatOptionalWorkspaceWeight(remainingWeight)}
          </p>
        </div>
      </div>

      {dirtyEvaluations.length > 0 ? (
        <section
          aria-label="Projected operation weight totals"
          className="rounded-md border border-sky-200 bg-sky-50 p-4"
        >
          <h5 className="text-sm font-semibold">Projected unsaved totals</h5>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <WorkspaceDetail
              label="Projected Allocated Weight"
              value={formatOptionalWorkspaceWeight(projectedAllocatedWeight)}
            />
            <WorkspaceDetail
              label="Projected Remaining Weight"
              value={formatOptionalWorkspaceWeight(projectedRemainingWeight)}
            />
          </div>
          <p className="mt-2 text-sm text-sky-950">
            These totals include unsaved Planned Package changes from{" "}
            {dirtyEvaluations.length} Allocation
            {dirtyEvaluations.length === 1 ? "" : "s"}.
          </p>
        </section>
      ) : null}

      {operation.allocations.length > 0 ? (
        <p className="text-sm text-slate-700">
          Allocation states: {stateCounts.Balanced} Balanced ·{" "}
          {stateCounts.Remaining} Remaining · {stateCounts.Overallocated}{" "}
          Overallocated · {stateCounts.Incomplete} Incomplete
        </p>
      ) : null}

      {operation.allocations.length === 0 ? (
        <p className="text-sm text-slate-600">
          No Packaging Allocations have been saved yet.
        </p>
      ) : (
        <div className="space-y-3">
          {operation.allocations.map((allocation, index) => (
            <article className="object-card" key={allocation.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h5 className="font-semibold">Allocation {index + 1}</h5>
                  <p className="mt-1 text-sm text-slate-600">
                    {allocation.notes || "No notes"}
                  </p>
                </div>
                <div className="text-sm text-slate-600 sm:text-right">
                  <p>
                    Created{" "}
                    <time dateTime={allocation.created_at}>
                      {new Date(allocation.created_at).toLocaleString()}
                    </time>
                  </p>
                  <p>
                    Updated{" "}
                    <time dateTime={allocation.updated_at}>
                      {new Date(allocation.updated_at).toLocaleString()}
                    </time>
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Saved Selected Source Weight
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatOptionalWorkspaceWeight(
                      finiteWeightOrNull(allocation.selected_weight_grams),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Saved Allocated Weight
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatOptionalWorkspaceWeight(
                      finiteWeightOrNull(allocation.allocated_weight_grams),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Saved Remaining Weight
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatOptionalWorkspaceWeight(
                      finiteWeightOrNull(allocation.remaining_weight_grams),
                    )}
                  </p>
                </div>
              </div>

              <AllocationBalanceSummary
                allocationNumber={index + 1}
                balanceState={
                  allocationEvaluations[index]?.savedBalanceState ??
                  "Incomplete"
                }
                remainingWeightGrams={
                  allocationEvaluations[index]?.savedWeightsAvailable
                    ? Number(allocation.remaining_weight_grams)
                    : null
                }
              />

              <p className="mt-3 text-sm text-slate-600">
                {allocation.source_trays.length} source completed Tray
                {allocation.source_trays.length === 1 ? "" : "s"} ·{" "}
                {allocation.planned_packages.length} planned Package row
                {allocation.planned_packages.length === 1 ? "" : "s"} ·{" "}
                {allocation.packages.length} recorded Package
                {allocation.packages.length === 1 ? "" : "s"}
              </p>

              <section
                className="mt-4"
                aria-label={`Allocation ${index + 1} source completed Trays`}
              >
                <h6 className="text-sm font-semibold">
                  Source completed Trays
                </h6>
                {allocation.source_trays.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    No source completed Trays are recorded for this Allocation.
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                    {allocation.source_trays.map((tray) => (
                      <li
                        className="rounded-md border border-slate-200 p-3"
                        key={tray.id}
                      >
                        <p className="font-semibold">
                          Slot {tray.slot_number} · {tray.product_name}
                        </p>
                        <dl className="mt-2 grid gap-1 text-sm text-slate-600">
                          <div>
                            <dt className="inline font-semibold">
                              Tray Status:{" "}
                            </dt>
                            <dd className="inline">{tray.status}</dd>
                          </div>
                          {tray.physical_tray_label ? (
                            <div>
                              <dt className="inline font-semibold">
                                Physical Tray:{" "}
                              </dt>
                              <dd className="inline">
                                {tray.physical_tray_label}
                              </dd>
                            </div>
                          ) : null}
                          <div>
                            <dt className="inline font-semibold">
                              Finished Product Weight:{" "}
                            </dt>
                            <dd className="inline">
                              {formatGrams(String(tray.final_dry_weight_grams))}
                            </dd>
                          </div>
                          {tray.notes ? (
                            <div>
                              <dt className="inline font-semibold">
                                Tray Notes:{" "}
                              </dt>
                              <dd className="inline">{tray.notes}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-label={`Allocation ${index + 1} planned Package rows`}
                className="mt-4 border-t border-slate-200 pt-4"
              >
                <h6 className="text-sm font-semibold">Planned Package rows</h6>
                {allocation.planned_packages.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    No planned Package rows are recorded for this Allocation.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {allocation.planned_packages.map(
                      (plannedPackage, rowIndex) => (
                        <PlannedPackageSummary
                          allocationId={allocation.id}
                          formatError={formatError}
                          key={plannedPackage.id}
                          onRecord={() =>
                            onRecordPlannedPackage(
                              operation.id,
                              allocation.id,
                              plannedPackage.id,
                            )
                          }
                          onRefresh={() =>
                            onRefreshOperation(operation.production_batch_id)
                          }
                          operationStatus={operation.status}
                          packageTypes={packageTypes}
                          plannedPackage={plannedPackage}
                          rowNumber={rowIndex + 1}
                          storageLocations={storageLocations}
                          unsavedAllocationChanges={Boolean(
                            allocationEvaluations[index]?.projection?.dirty,
                          )}
                        />
                      ),
                    )}
                  </div>
                )}
              </section>

              {operation.status === "Open" ? (
                <PlannedPackageEditor
                  allocationId={allocation.id}
                  allocationNumber={index + 1}
                  authoritativeVersion={allocation.updated_at}
                  formatError={formatError}
                  key={allocation.id}
                  onProjectionChange={handleProjectionChange}
                  onRefresh={() =>
                    onRefreshPlannedPackages(
                      operation.production_batch_id,
                      allocation.id,
                    )
                  }
                  onSave={(plannedPackages) =>
                    onSavePlannedPackages(
                      operation.id,
                      allocation.id,
                      plannedPackages,
                    )
                  }
                  packageTypes={packageTypes}
                  plannedPackages={allocation.planned_packages}
                  recordedFinishedProductWeightGrams={sumRecordedPackageWeights(
                    allocation.packages,
                  )}
                  selectedWeightGrams={finiteWeightOrNull(
                    allocation.selected_weight_grams,
                  )}
                  storageLocations={storageLocations}
                />
              ) : null}

              <section
                aria-label={`Allocation ${index + 1} recorded Packages`}
                className="mt-4 border-t border-slate-200 pt-4"
              >
                <h6 className="text-sm font-semibold">Recorded Packages</h6>
                {allocation.packages.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    No recorded Packages exist for this Allocation.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {allocation.packages.map((recordedPackage) => (
                      <RecordedPackageSummary
                        editable={operation.status === "Open"}
                        formatError={formatError}
                        key={recordedPackage.id}
                        onRefreshLabel={() =>
                          onRefreshPackageLabel(
                            operation.production_batch_id,
                            recordedPackage.id,
                          )
                        }
                        onSaveLabel={(body) =>
                          onSavePackageLabel(recordedPackage.id, body)
                        }
                        recordedPackage={recordedPackage}
                      />
                    ))}
                  </div>
                )}
              </section>
            </article>
          ))}
        </div>
      )}

      <PackageLabelPreview
        formatError={formatError}
        onOpenPrintOutput={printAvery5163Labels}
        onPreview={onPreviewPackageLabels}
        onPrint={onPrintPackageLabels}
        onReservePrintOutput={reserveAvery5163PrintOutput}
        onRefreshOperation={() =>
          onRefreshOperation(operation.production_batch_id)
        }
        operation={operation}
      />

      <section
        aria-label="Packaging completion eligibility"
        className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <h5 className="text-sm font-semibold">Completion eligibility</h5>
        {operation.status === "Completed" ? (
          <p className="mt-1 text-sm text-slate-700">
            Packaging is already Completed. This historical workspace is not an
            actionable completion candidate.
          </p>
        ) : appearsEligible ? (
          <div className="mt-1 text-sm text-slate-700">
            <p className="font-semibold">Appears eligible for completion</p>
            <p>
              Every Allocation is independently balanced and the visible saved
              Package and Label requirements are satisfied. Backend validation
              remains authoritative.
            </p>
          </div>
        ) : (
          <div className="mt-1">
            <p className="text-sm font-semibold text-amber-950">
              Not yet eligible for completion
            </p>
            <ul className="mt-1 space-y-1 text-sm text-amber-900">
              {completionBlockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
        <PackagingCompletionAction
          eligible={appearsEligible}
          formatError={formatError}
          onComplete={onCompleteOperation}
          onRefresh={onRefreshCompletedWorkspace}
          operation={operation}
        />
      </section>
    </section>
  );
}

function PackagingCompletionAction({
  eligible,
  formatError,
  onComplete,
  onRefresh,
  operation,
}: {
  eligible: boolean;
  formatError: (error: unknown) => string;
  onComplete: () => Promise<PackagingOperation>;
  onRefresh: () => Promise<void>;
  operation: PackagingOperation;
}) {
  const completingInFlight = useRef(false);
  const refreshingInFlight = useRef(false);
  const [completing, setCompleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completionConfirmation, setCompletionConfirmation] = useState<
    string | null
  >(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function completeOperation() {
    if (
      operation.status !== "Open" ||
      !eligible ||
      completingInFlight.current
    ) {
      return;
    }
    completingInFlight.current = true;
    setCompleting(true);
    setCompletionError(null);
    setCompletionConfirmation(null);
    setRefreshError(null);
    try {
      const completedOperation = await onComplete();
      setCompletionConfirmation(
        `Packaging completion was recorded${
          completedOperation.completed_at
            ? ` at ${new Date(completedOperation.completed_at).toLocaleString()}`
            : ""
        }.`,
      );
      try {
        await onRefresh();
      } catch (refreshFailure) {
        setRefreshError(
          `Packaging completion was recorded, but the authoritative workspace refresh failed. ${formatError(refreshFailure)}`,
        );
      }
    } catch (completionFailure) {
      setCompletionError(formatError(completionFailure));
    } finally {
      completingInFlight.current = false;
      setCompleting(false);
    }
  }

  async function retryRefresh() {
    if (!refreshError || refreshingInFlight.current) return;
    refreshingInFlight.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
      setRefreshError(null);
    } catch (refreshFailure) {
      setRefreshError(
        `Packaging completion was recorded, but the authoritative workspace refresh failed. ${formatError(refreshFailure)}`,
      );
    } finally {
      refreshingInFlight.current = false;
      setRefreshing(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      {operation.status === "Open" && eligible ? (
        <>
          <p className="text-sm text-slate-700">
            Completion is an explicit, irreversible workflow transition. The
            backend will perform final validation before marking source Trays
            Packaged.
          </p>
          <button
            className="primary-action mt-3"
            disabled={completing}
            type="button"
            onClick={() => void completeOperation()}
          >
            {completing ? "Completing Packaging…" : "Complete Packaging"}
          </button>
        </>
      ) : null}
      {completionError ? (
        <p className="error-banner mt-3" role="alert">
          Packaging was not completed. {completionError}
        </p>
      ) : null}
      {completionConfirmation ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {completionConfirmation}
        </p>
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
            onClick={() => void retryRefresh()}
          >
            {refreshing
              ? "Refreshing Completed Workspace…"
              : "Retry Completed Workspace Refresh"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type WorkspaceAllocationEvaluation = {
  allocation: PackagingOperation["allocations"][number];
  allocationNumber: number;
  effectiveBalanceState: PlannedPackageProjection["balanceState"];
  projection: PlannedPackageProjection | undefined;
  savedBalanceState: PlannedPackageProjection["balanceState"];
  savedWeightsAvailable: boolean;
};

function AllocationBalanceSummary({
  allocationNumber,
  balanceState,
  remainingWeightGrams,
}: {
  allocationNumber: number;
  balanceState: PlannedPackageProjection["balanceState"];
  remainingWeightGrams: number | null;
}) {
  let message =
    "Saved balance: Incomplete because authoritative weight or Planned Package data is unavailable.";
  if (balanceState === "Balanced") {
    message =
      "Saved balance: Balanced. All selected Finished Product Weight is allocated.";
  } else if (balanceState === "Remaining" && remainingWeightGrams !== null) {
    message = `Saved balance: ${formatGrams(String(remainingWeightGrams), 3)} remaining to allocate.`;
  } else if (
    balanceState === "Overallocated" &&
    remainingWeightGrams !== null
  ) {
    message = `Saved balance: Overallocated by ${formatGrams(String(Math.abs(remainingWeightGrams)), 3)}.`;
  }
  return (
    <p
      aria-label={`Allocation ${allocationNumber} saved balance`}
      className="mt-3 text-sm font-semibold text-slate-700"
    >
      {message}
    </p>
  );
}

function getCompletionBlockers(
  operation: PackagingOperation,
  evaluations: WorkspaceAllocationEvaluation[],
) {
  if (operation.status === "Completed") {
    return ["Packaging Operation is already Completed."];
  }
  if (evaluations.length === 0) {
    return ["No Packaging Allocations have been saved."];
  }

  const blockers = new Set<string>();
  for (const evaluation of evaluations) {
    const { allocation, allocationNumber, effectiveBalanceState, projection } =
      evaluation;
    if (!evaluation.savedWeightsAvailable) {
      blockers.add(
        `Allocation ${allocationNumber} has unavailable authoritative weight data.`,
      );
    }
    if (projection?.dirty) {
      blockers.add(
        `Allocation ${allocationNumber} has unsaved Planned Package changes.`,
      );
    }
    if (effectiveBalanceState === "Incomplete") {
      blockers.add(
        `Allocation ${allocationNumber} has incomplete or invalid Planned Package work.`,
      );
    } else if (effectiveBalanceState === "Remaining") {
      const remaining = projection?.dirty
        ? projection.projectedRemainingWeightGrams
        : Number(allocation.remaining_weight_grams);
      blockers.add(
        `Allocation ${allocationNumber} has ${formatOptionalWorkspaceWeight(remaining)} remaining to package.`,
      );
    } else if (effectiveBalanceState === "Overallocated") {
      const remaining = projection?.dirty
        ? projection.projectedRemainingWeightGrams
        : Number(allocation.remaining_weight_grams);
      blockers.add(
        `Allocation ${allocationNumber} is overallocated by ${formatOptionalWorkspaceWeight(remaining === null ? null : Math.abs(remaining))}.`,
      );
    }
    if (allocation.packages.length === 0) {
      blockers.add(
        `Allocation ${allocationNumber} requires at least one recorded Package.`,
      );
    }
    if (
      allocation.planned_packages.some(
        (plannedPackage) => plannedPackage.recorded_package_id === null,
      )
    ) {
      blockers.add(
        `Allocation ${allocationNumber} has Planned Packages that must be recorded before completion.`,
      );
    }
    if (allocation.packages.some((recordedPackage) => !recordedPackage.label)) {
      blockers.add(
        `Allocation ${allocationNumber} has recorded Package Label data that is unavailable.`,
      );
    }
    if (
      allocation.packages.some(
        (recordedPackage) => recordedPackage.label?.status === "Draft",
      )
    ) {
      blockers.add(
        `Allocation ${allocationNumber} has Package Labels that are not Ready.`,
      );
    }
  }
  return Array.from(blockers);
}

function getAllocationBalanceState(
  remainingWeightGrams: number | null,
  valid: boolean,
): PlannedPackageProjection["balanceState"] {
  if (!valid || remainingWeightGrams === null) return "Incomplete";
  if (Math.abs(remainingWeightGrams) <= ALLOCATION_TOLERANCE_GRAMS) {
    return "Balanced";
  }
  return remainingWeightGrams > 0 ? "Remaining" : "Overallocated";
}

function isSavedPlannedPackageValid(
  plannedPackage: PlannedPackageRow,
  packageTypes: PackageType[],
  storageLocations: StorageLocation[],
) {
  const packageTypeAvailable =
    plannedPackage.package_type_id !== null &&
    packageTypes.some(
      (packageType) => packageType.id === plannedPackage.package_type_id,
    );
  const storageAvailable =
    plannedPackage.storage_location_id === null ||
    storageLocations.some(
      (location) => location.id === plannedPackage.storage_location_id,
    );
  const finishedWeightValid = isPositiveFiniteWeight(
    plannedPackage.finished_product_weight_grams,
  );
  const sealedWeightValid =
    plannedPackage.sealed_package_weight_grams === null ||
    isPositiveFiniteWeight(plannedPackage.sealed_package_weight_grams);
  const finishedUnitValid = isSupportedWeightUnit(
    plannedPackage.finished_product_weight_unit,
  );
  const sealedUnitValid = isSupportedWeightUnit(
    plannedPackage.sealed_package_weight_unit,
  );
  return (
    packageTypeAvailable &&
    storageAvailable &&
    finishedWeightValid &&
    sealedWeightValid &&
    finishedUnitValid &&
    sealedUnitValid
  );
}

function getPackageRecordingBlockers(
  allocationId: string,
  plannedPackage: PlannedPackageRow,
  packageTypes: PackageType[],
  storageLocations: StorageLocation[],
  unsavedAllocationChanges: boolean,
) {
  const blockers: string[] = [];
  if (plannedPackage.packaging_allocation_id !== allocationId) {
    blockers.push("This Planned Package does not belong to this Allocation.");
  }
  if (
    !plannedPackage.package_type_id ||
    !packageTypes.some(
      (packageType) => packageType.id === plannedPackage.package_type_id,
    )
  ) {
    blockers.push("Select an available Package Type and save the plan.");
  }
  if (!isPositiveFiniteWeight(plannedPackage.finished_product_weight_grams)) {
    blockers.push("Enter a valid Finished Product Weight and save the plan.");
  }
  if (!isSupportedWeightUnit(plannedPackage.finished_product_weight_unit)) {
    blockers.push("Select a supported Finished Product Weight unit.");
  }
  if (!isPositiveFiniteWeight(plannedPackage.sealed_package_weight_grams)) {
    blockers.push("Enter a valid Sealed Package Weight and save the plan.");
  }
  if (!isSupportedWeightUnit(plannedPackage.sealed_package_weight_unit)) {
    blockers.push("Select a supported Sealed Package Weight unit.");
  }
  if (
    plannedPackage.storage_location_id !== null &&
    !storageLocations.some(
      (location) => location.id === plannedPackage.storage_location_id,
    )
  ) {
    blockers.push("Select an available Storage Location and save the plan.");
  }
  if (unsavedAllocationChanges) {
    blockers.push("Save or discard Planned Package changes before recording.");
  }
  return blockers;
}

function sumRecordedPackageWeights(packages: Package[]) {
  let total = 0;
  for (const recordedPackage of packages) {
    if (
      !isPositiveFiniteWeight(recordedPackage.finished_product_weight_grams)
    ) {
      return null;
    }
    total += Number(recordedPackage.finished_product_weight_grams);
  }
  return total;
}

function sumAvailableWeights(weights: Array<number | null>) {
  if (weights.some((weight) => weight === null || !Number.isFinite(weight))) {
    return null;
  }
  return weights.reduce<number>((total, weight) => total + (weight ?? 0), 0);
}

function finiteWeightOrNull(value: string | number | null) {
  if (value === null) return null;
  const weight = Number(value);
  return Number.isFinite(weight) ? weight : null;
}

function isFiniteWeight(value: unknown) {
  return value !== null && Number.isFinite(Number(value));
}

function isPositiveFiniteWeight(value: string | number | null) {
  if (value === null) return false;
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0;
}

function isSupportedWeightUnit(value: string | null) {
  return value === "g" || value === "oz" || value === "lb";
}

function formatOptionalWorkspaceWeight(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : formatGrams(String(value), 3);
}

function PlannedPackageSummary({
  allocationId,
  formatError,
  onRecord,
  onRefresh,
  operationStatus,
  packageTypes,
  plannedPackage,
  rowNumber,
  storageLocations,
  unsavedAllocationChanges,
}: {
  allocationId: string;
  formatError: (error: unknown) => string;
  onRecord: () => Promise<void>;
  onRefresh: () => Promise<void>;
  operationStatus: PackagingOperation["status"];
  packageTypes: PackageType[];
  plannedPackage: PlannedPackageRow;
  rowNumber: number;
  storageLocations: StorageLocation[];
  unsavedAllocationChanges: boolean;
}) {
  const packageTypeName = plannedPackage.package_type_id
    ? (packageTypes.find(
        (packageType) => packageType.id === plannedPackage.package_type_id,
      )?.name ?? "Package Type unavailable")
    : "Not specified";
  const storageLocationName = plannedPackage.storage_location_id
    ? (storageLocations.find(
        (storageLocation) =>
          storageLocation.id === plannedPackage.storage_location_id,
      )?.name ?? "Storage Location unavailable")
    : "Not specified";
  const recordingBlockers = getPackageRecordingBlockers(
    allocationId,
    plannedPackage,
    packageTypes,
    storageLocations,
    unsavedAllocationChanges,
  );

  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h6 className="font-semibold">Planned Package {rowNumber}</h6>
          <p className="mt-1 text-sm text-slate-600">
            {plannedPackage.recorded_package_id
              ? "Recorded Package created"
              : "Not yet recorded as a Package"}
          </p>
        </div>
        <div className="text-sm text-slate-600 sm:text-right">
          <p>
            Created{" "}
            <time dateTime={plannedPackage.created_at}>
              {new Date(plannedPackage.created_at).toLocaleString()}
            </time>
          </p>
          <p>
            Updated{" "}
            <time dateTime={plannedPackage.updated_at}>
              {new Date(plannedPackage.updated_at).toLocaleString()}
            </time>
          </p>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceDetail label="Package Type" value={packageTypeName} />
        <WorkspaceDetail
          label="Planned Finished Product Weight"
          value={formatPlannedWeight(
            plannedPackage.finished_product_weight_grams,
            plannedPackage.finished_product_weight_unit,
          )}
        />
        <WorkspaceDetail
          label="Planned Sealed Package Weight"
          value={formatPlannedWeight(
            plannedPackage.sealed_package_weight_grams,
            plannedPackage.sealed_package_weight_unit,
          )}
        />
        <WorkspaceDetail
          label="Oxygen Absorber"
          value={plannedPackage.oxygen_absorber || "Not specified"}
        />
        <WorkspaceDetail label="Storage Location" value={storageLocationName} />
        <WorkspaceDetail
          label="Notes"
          value={plannedPackage.notes || "No notes"}
        />
      </dl>

      <PackageLabelDetails
        description={plannedPackage.label_description}
        displayName={plannedPackage.label_display_name}
        freshEquivalentDisplay={plannedPackage.label_fresh_equivalent_display}
        ingredientsSummary={plannedPackage.label_ingredients_summary}
        netWeightDisplay={plannedPackage.label_net_weight_display}
        preparationSummary={plannedPackage.label_preparation_summary}
        rehydrationInstructions={plannedPackage.label_rehydration_instructions}
        servingNotes={plannedPackage.label_serving_notes}
        status={plannedPackage.label_status}
      />

      {operationStatus === "Open" && !plannedPackage.recorded_package_id ? (
        <PlannedPackageRecordAction
          blockers={recordingBlockers}
          formatError={formatError}
          onRecord={onRecord}
          onRefresh={onRefresh}
          rowNumber={rowNumber}
        />
      ) : null}
    </article>
  );
}

function RecordedPackageSummary({
  editable,
  formatError,
  onRefreshLabel,
  onSaveLabel,
  recordedPackage,
}: {
  editable: boolean;
  formatError: (error: unknown) => string;
  onRefreshLabel: () => Promise<PackageLabel>;
  onSaveLabel: (body: PackageLabelUpdate) => Promise<void>;
  recordedPackage: Package;
}) {
  const label = recordedPackage.label as PackageLabel | null | undefined;

  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h6 className="font-semibold">
            {recordedPackage.package_identifier}
          </h6>
          <p className="mt-1 text-sm text-slate-600">
            {recordedPackage.status}
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Packaged{" "}
          <time dateTime={recordedPackage.packaged_at}>
            {new Date(recordedPackage.packaged_at).toLocaleString()}
          </time>
        </p>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceDetail
          label="Package Type"
          value={
            recordedPackage.package_type?.name ?? "Package Type unavailable"
          }
        />
        <WorkspaceDetail
          label="Finished Product Weight"
          value={
            recordedPackage.finished_product_weight_grams === null
              ? "Not specified"
              : formatGrams(
                  String(recordedPackage.finished_product_weight_grams),
                )
          }
        />
        <WorkspaceDetail
          label="Sealed Package Weight"
          value={formatGrams(String(recordedPackage.package_weight_grams))}
        />
        <WorkspaceDetail
          label="Oxygen Absorber"
          value={recordedPackage.oxygen_absorber || "Not specified"}
        />
        <WorkspaceDetail
          label="Storage Location"
          value={
            recordedPackage.storage_location?.name ??
            "Storage Location unavailable"
          }
        />
        <WorkspaceDetail
          label="Notes"
          value={recordedPackage.notes || "No notes"}
        />
      </dl>

      {label ? (
        <>
          <PackageLabelDetails
            description={label.description}
            displayName={label.display_name}
            freshEquivalentDisplay={label.fresh_equivalent_display}
            ingredientsSummary={label.ingredients_summary}
            netWeightDisplay={label.net_weight_display}
            preparationSummary={label.preparation_summary}
            rehydrationInstructions={label.rehydration_instructions}
            servingNotes={label.serving_notes}
            status={label.status}
          />
          {editable ? (
            <PackageLabelEditor
              formatError={formatError}
              label={label}
              onRefresh={onRefreshLabel}
              onSave={onSaveLabel}
              packageIdentifier={recordedPackage.package_identifier}
            />
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          No Package Label is recorded for this Package.
        </p>
      )}
    </article>
  );
}

function PackageLabelDetails({
  description,
  displayName,
  freshEquivalentDisplay,
  ingredientsSummary,
  netWeightDisplay,
  preparationSummary,
  rehydrationInstructions,
  servingNotes,
  status,
}: {
  description: string | null;
  displayName: string | null;
  freshEquivalentDisplay: string | null;
  ingredientsSummary: string | null;
  netWeightDisplay: string | null;
  preparationSummary: string | null;
  rehydrationInstructions: string | null;
  servingNotes: string | null;
  status: string;
}) {
  return (
    <section className="mt-3 rounded-md bg-slate-100 p-3">
      <h6 className="text-sm font-semibold">Package Label</h6>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <WorkspaceDetail label="Package Label Status" value={status} />
        <WorkspaceDetail
          label="Display Name"
          value={displayName || "Not specified"}
        />
        <WorkspaceDetail
          label="Description"
          value={description || "Not specified"}
        />
        <WorkspaceDetail
          label="Ingredients Summary"
          value={ingredientsSummary || "Not specified"}
        />
        <WorkspaceDetail
          label="Preparation Summary"
          value={preparationSummary || "Not specified"}
        />
        <WorkspaceDetail
          label="Rehydration Instructions"
          value={rehydrationInstructions || "Not specified"}
        />
        <WorkspaceDetail
          label="Serving Notes"
          value={servingNotes || "Not specified"}
        />
        <WorkspaceDetail
          label="Net Weight Display"
          value={netWeightDisplay || "Not specified"}
        />
        <WorkspaceDetail
          label="Fresh Equivalent Display"
          value={freshEquivalentDisplay || "Not specified"}
        />
      </dl>
    </section>
  );
}

function WorkspaceDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-slate-700">{value}</dd>
    </div>
  );
}

function formatPlannedWeight(
  grams: string | number | null,
  unit: string | null,
) {
  if (grams === null) return "Not specified";
  const numericGrams = Number(grams);
  if (!Number.isFinite(numericGrams)) return "Not specified";

  if (unit === "oz")
    return formatWorkspaceWeight(numericGrams / 28.349523125, "oz");
  if (unit === "lb")
    return formatWorkspaceWeight(numericGrams / 453.59237, "lb");
  if (unit && unit !== "g") return `${formatGrams(String(grams))} · ${unit}`;
  return formatGrams(String(grams));
}

function formatWorkspaceWeight(value: number, unit: string) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`;
}

function uniqueSummary(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, summaries) => summaries.indexOf(value) === index)
    .join(" + ");
}

function operationWithAuthoritativeLabels(
  operation: PackagingOperation,
  labels: PackageLabel[],
) {
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const withAuthoritativeLabel = (recordedPackage: Package) => {
    const currentLabel = recordedPackage.label as
      | PackageLabel
      | null
      | undefined;
    if (!currentLabel) return recordedPackage;
    const label = labelsById.get(currentLabel.id);
    return label && label.package_id === recordedPackage.id
      ? { ...recordedPackage, label }
      : recordedPackage;
  };
  return {
    ...operation,
    allocations: operation.allocations.map((allocation) => ({
      ...allocation,
      packages: allocation.packages.map(withAuthoritativeLabel),
    })),
    packages: operation.packages.map(withAuthoritativeLabel),
  };
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
                preparationSummary: label.preparation_summary,
                freshEquivalentGrams: label.fresh_equivalent_grams,
                finishedProductWeightGrams: label.finished_product_weight_grams,
                packageType: label.package_type,
                batchLine: `${label.batch_number} · ${label.freeze_dryer}`,
                oxygenAbsorber: label.oxygen_absorber,
                packagedAt: label.packaged_at,
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
              Finished product:{" "}
              {label.finished_product_weight_grams === null
                ? "Not recorded"
                : formatGrams(label.finished_product_weight_grams)}
            </p>
            <p className="text-sm text-slate-700">
              Sealed package: {formatGrams(label.package_weight_grams)}
            </p>
            <p className="text-sm text-slate-700">
              Batch {label.batch_number} · {label.freeze_dryer}
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
    package_weight_unit: "g",
    finished_product_weight_value: "",
    finished_product_weight_unit: "g",
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

function hasUsableFinishedProductWeight(
  tray: PackagingWorksheetItem["eligible_trays"][number],
) {
  if (tray.final_dry_weight_grams === null) return false;
  const weight = Number(tray.final_dry_weight_grams);
  return Number.isFinite(weight) && weight > 0;
}

function formatEditableGrams(value: number) {
  return String(Number(value.toFixed(3)));
}
