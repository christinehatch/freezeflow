import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router";

import {
  ApiError,
  Package,
  PackagingAllocation,
  PackageLineCreate,
  PackageLabel,
  PackageLabelPrintResult,
  PackageLabelUpdate,
  PackageType,
  PlannedPackageInput,
  PlannedPackageRow,
  PackagingLossReason,
  PackagingOperation,
  PackagingResult,
  PackagingWorksheetItem,
  ProductionBatch,
  RecordPackagingLossRequest,
  StorageLocation,
  packagingApi,
  productionApi,
} from "../api/client";
import type { PlannedPackageProjection } from "../components/PlannedPackageEditor";
import {
  PackageLabelEditor,
  PlannedPackageRecordAction,
} from "../components/PackagingWorkspaceActions";
import { PackageLabelPreview } from "../components/PackageLabelPreview";
import {
  ButtonLink,
  Field,
  NumberField,
  PageHeader,
  Select,
  SummaryPanel,
  Textarea,
  TextField,
  WorkflowStage,
  WorkflowStepper,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";
import {
  ALLOCATION_TOLERANCE_GRAMS,
  WEIGHT_UNIT_OPTIONS,
  WeightUnit,
  formatGrams,
  formatWeightInUnit,
  fromGramsForInput,
  toGrams,
} from "../utils/weights";
import {
  printAvery5163Labels,
  reserveAvery5163PrintOutput,
} from "../utils/avery5163Labels";
import {
  type PackagingStageId,
  getCurrentPackagingStage,
  getPackagingStagePosition,
} from "./packagingStages";

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
  const [visibleStage, setVisibleStage] = useState<PackagingStageId>("source");
  const [batchTraysOpen, setBatchTraysOpen] = useState(false);
  const [reviewingDirectPackages, setReviewingDirectPackages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackagingResult | null>(null);
  const startingBatchIdRef = useRef<string | null>(null);
  const savingAllocationOperationIdRef = useRef<string | null>(null);
  const restoredWorkspaceIdentityRef = useRef<string | null>(null);

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
      setVisibleStage("packages");
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
  const currentStage = getCurrentPackagingStage(
    workspaceRequested ? activeOperation : null,
  );
  const workflowSteps = createPackagingWorkflowSteps(
    visibleStage,
    currentStage,
  );

  useEffect(() => {
    const workspaceIdentity = workspaceRequested
      ? `${activeBatchId ?? "none"}:${activeOperation?.id ?? "loading"}`
      : `${activeBatchId ?? "none"}:source`;
    if (restoredWorkspaceIdentityRef.current === workspaceIdentity) return;
    restoredWorkspaceIdentityRef.current = workspaceIdentity;
    setVisibleStage(workspaceRequested ? currentStage : "source");
  }, [activeBatchId, activeOperation?.id, currentStage, workspaceRequested]);

  useEffect(() => {
    const headingId = `workflow-stage-${getPackagingStagePosition(visibleStage) + 1}`;
    document.getElementById(headingId)?.focus();
  }, [visibleStage]);

  function toggleTray(trayId: string) {
    if (!selectableTrays.some((tray) => tray.id === trayId)) return;
    setResult(null);
    setAllocationSaveMessage(null);
    setReviewingDirectPackages(false);
    setSelectedTrayIds((current) => {
      if (current.includes(trayId)) {
        return current.filter((id) => id !== trayId);
      }
      return [...current, trayId];
    });
  }

  function selectBatch(batchId: string) {
    setActiveBatchId(batchId);
    setBatchTraysOpen(false);
    setSelectedTrayIds([]);
    setPackageLines([createPackageLine(packageTypes[0])]);
    setPackageCountInput("1");
    setPackagedAt("");
    setSessionNotes("");
    setAllocationNotes("");
    setAllocationSaveMessage(null);
    setReviewingDirectPackages(false);
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

  function startNewPackagingRound(batchId: string) {
    if (startingBatchIdRef.current !== null) return;
    startingBatchIdRef.current = batchId;
    startPackagingOperation.mutate(batchId);
  }

  function advanceFromBatch(
    batchId: string,
    operation: PackagingOperation | null,
  ) {
    if (workspaceRequested && operation) {
      setVisibleStage(getCurrentPackagingStage(operation));
      return;
    }
    openWorkspace(batchId, operation);
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
    setReviewingDirectPackages(false);
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
    setReviewingDirectPackages(false);
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
    setReviewingDirectPackages(false);
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

    setReviewingDirectPackages(false);
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

  function reviewDirectPackages(event: FormEvent<HTMLFormElement>) {
    if (reviewingDirectPackages) {
      handlePackageSubmit(event);
      return;
    }
    event.preventDefault();
    setError(null);
    setReviewingDirectPackages(true);
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

  async function recordBag(
    operationId: string,
    allocationId: string,
    bag: PackageLineCreate,
  ) {
    const response = await packagingApi.recordAllocationPackages({
      operationId,
      allocationId,
      body: { packages: [bag] },
    });
    queryClient.setQueryData(
      [
        "packaging-operation-by-batch",
        response.packaging_operation.production_batch_id,
      ],
      response.packaging_operation,
    );
    return response.packaging_operation;
  }

  async function recordLoss(
    operationId: string,
    allocationId: string,
    body: RecordPackagingLossRequest,
  ) {
    const response = await packagingApi.recordAllocationLoss({
      operationId,
      allocationId,
      body,
    });
    queryClient.setQueryData(
      [
        "packaging-operation-by-batch",
        response.packaging_operation.production_batch_id,
      ],
      response.packaging_operation,
    );
    return response.packaging_operation;
  }

  async function autosavePlannedPackages(
    operationId: string,
    allocationId: string,
    plannedPackages: PlannedPackageInput[],
  ) {
    const updatedAllocation = await packagingApi.updatePackagingAllocation({
      operationId,
      allocationId,
      body: { planned_packages: plannedPackages },
    });
    if (activeOperation) {
      const queryKey = [
        "packaging-operation-by-batch",
        activeOperation.production_batch_id,
      ] as const;
      queryClient.setQueryData<PackagingOperation | null>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                allocations: current.allocations.map((allocation) =>
                  allocation.id === updatedAllocation.id
                    ? updatedAllocation
                    : allocation,
                ),
              }
            : current,
      );
    }
    return updatedAllocation;
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
    <div
      className={`packaging-page${workspaceRequested && activeOperation ? " packaging-page--workspace" : ""}`}
    >
      <PageHeader
        action={
          <ButtonLink to="/packaging/package-types" variant="secondary">
            Manage Package Types
          </ButtonLink>
        }
        description="Turn completed product into balanced, labeled Packages through a saved workflow you can safely resume."
        eyebrow="Production to inventory"
        title="Packaging"
      />

      <WorkflowStepper
        label="Packaging progress"
        steps={workflowSteps}
        onStepSelect={(step) => setVisibleStage(step.id as PackagingStageId)}
      />

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

      <WorkflowStage
        className={`packaging-source-stage packaging-source-stage--${visibleStage}`}
        collapsible={
          workspaceRequested && activeOperation?.status === "Completed"
        }
        description="Select a completed Batch, or return to packaging you already started."
        stage={1}
        status={visibleStage === "source" ? "current" : "complete"}
        title="Choose a batch"
      >
        {discoveryLoading ? (
          <p className="mt-4 text-slate-600">Finding batches to package.</p>
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
            {discoverableBatches.length > 1 ? (
              <Field
                className="packaging-batch-selector max-w-xl"
                htmlFor="packaging-batch"
                label="Which batch are you packaging?"
              >
                <Select
                  aria-label="Production Batch"
                  disabled={savePackagingAllocation.isPending}
                  id="packaging-batch"
                  options={discoverableBatches.map((batch) => ({
                    value: batch.id,
                    label: batch.batch_number,
                    description: batch.freeze_dryer.name,
                  }))}
                  placeholder="Choose a batch"
                  value={
                    discoverableBatches.some(
                      (batch) => batch.id === activeBatchId,
                    )
                      ? activeBatchId
                      : ""
                  }
                  onChange={selectBatch}
                />
              </Field>
            ) : null}

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
              <article className="object-card packaging-batch-card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="font-semibold">
                      {activeBatch.batch_number}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {activeBatch.freeze_dryer.name}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {getBatchPackagingSummary({
                        availableSourceWeight,
                        availableTrayCount: availableTrays.length,
                        operationStatus: activeOperation?.status,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {visibleStage !== "source" && activeOperation ? (
                      <p className="packaging-workspace-state">
                        {activeOperation.status === "Completed"
                          ? "Packaging complete"
                          : "Packaging in progress"}
                      </p>
                    ) : (
                      <>
                        <button
                          className="primary-action"
                          disabled={
                            startPackagingOperation.isPending ||
                            activeOperationQuery?.isLoading ||
                            activeOperationQuery?.isError
                          }
                          type="button"
                          onClick={() =>
                            advanceFromBatch(activeBatch.id, activeOperation)
                          }
                        >
                          {activeOperation?.status === "Completed"
                            ? "Next — View history"
                            : "Next — Choose trays"}
                        </button>
                        {activeOperation?.status === "Completed" &&
                        (activeWorksheetItem?.eligible_trays.length ?? 0) >
                          0 ? (
                          <button
                            className="secondary-action"
                            disabled={
                              startPackagingOperation.isPending ||
                              activeOperationQuery?.isLoading ||
                              activeOperationQuery?.isError
                            }
                            type="button"
                            onClick={() =>
                              startNewPackagingRound(activeBatch.id)
                            }
                          >
                            Start Packaging the remaining Trays
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {visibleStage === "source" &&
                activeWorksheetItem &&
                activeWorksheetItem.eligible_trays.length > 0 ? (
                  <details
                    className="packaging-batch-trays mt-3"
                    open={batchTraysOpen}
                    onToggle={(event) =>
                      setBatchTraysOpen(event.currentTarget.open)
                    }
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                      What&rsquo;s in this batch?
                    </summary>
                    {batchTraysOpen ? (
                      <ul className="mt-2 space-y-2 text-sm">
                        {activeWorksheetItem.eligible_trays.map((tray) => (
                          <li
                            className="flex items-baseline justify-between gap-3"
                            key={tray.id}
                          >
                            <span>
                              <span className="text-slate-500">
                                {tray.physical_tray.label}
                              </span>{" "}
                              <span className="font-semibold">
                                {tray.product_name}
                              </span>
                              {tray.preparation ? (
                                <span className="text-slate-600">
                                  {" "}
                                  · {tray.preparation}
                                </span>
                              ) : null}
                            </span>
                            <span className="whitespace-nowrap text-slate-700">
                              {formatGrams(tray.final_dry_weight_grams)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </details>
                ) : null}
                {activeOperationQuery?.isError ? (
                  <p className="mt-3 text-red-700" role="alert">
                    {formatApiError(activeOperationQuery.error)}
                  </p>
                ) : null}
                {workspaceRequested && activeOperation ? (
                  <>
                    {activeOperation.status === "Open" &&
                    visibleStage === "product" ? (
                      <WorkflowStage
                        className="packaging-product-stage"
                        description="Select the completed Trays to combine for this Packaging Allocation."
                        stage={2}
                        status="current"
                        title="Choose trays"
                      >
                        <div aria-label="Prepare Packaging Allocation">
                          <div className="packaging-product-stage__intro flex flex-wrap items-center justify-end gap-2">
                            {selectableTrays.length > 0 ? (
                              <button
                                className="quiet-action"
                                disabled={savePackagingAllocation.isPending}
                                type="button"
                                onClick={selectAllActiveTrays}
                              >
                                Select all
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
                                Clear
                              </button>
                            ) : null}
                          </div>

                          <div className="packaging-source-metrics mt-4 grid gap-3 sm:grid-cols-2">
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
                          ) : null}

                          {availableTrays.length > selectableTrays.length ? (
                            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                              {availableTrays.length - selectableTrays.length}{" "}
                              completed Tray
                              {availableTrays.length -
                                selectableTrays.length ===
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
                            <div className="packaging-table-wrap mt-3 overflow-x-auto">
                              <table className="data-table packaging-source-table">
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

                          <div
                            aria-busy={savePackagingAllocation.isPending}
                            className="packaging-allocation-save mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
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
                            <div className="packaging-stage-actions">
                              <button
                                className="quiet-action"
                                disabled={savePackagingAllocation.isPending}
                                type="button"
                                onClick={() => setVisibleStage("source")}
                              >
                                Back
                              </button>
                              {selectedTrays.length === 0 &&
                              activeOperation.allocations.length > 0 ? (
                                <button
                                  className="primary-action"
                                  type="button"
                                  onClick={() => setVisibleStage("packages")}
                                >
                                  Continue to packages
                                </button>
                              ) : (
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
                                    ? "Saving…"
                                    : "Save & Continue"}
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 sm:col-span-2">
                              Saving records this source selection in Freezeflow
                              so the Packaging Allocation can be resumed later.
                              It does not complete Packaging.
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
                        </div>
                      </WorkflowStage>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Your progress is saved, so you can leave and return at any
                    time.
                  </p>
                )}
              </article>
            ) : null}
          </div>
        )}
      </WorkflowStage>

      {workspaceRequested && activeOperation && activeBatch ? (
        <PackagingOperationWorkspace
          availableTrays={availableTrays}
          batch={activeBatch}
          visibleStage={visibleStage}
          formatError={formatApiError}
          key={activeOperation.id}
          onCompleteOperation={() =>
            completePackagingOperation(
              activeOperation.id,
              activeOperation.production_batch_id,
            )
          }
          onRecordBag={recordBag}
          onRecordLoss={recordLoss}
          onAutosavePlannedPackages={autosavePlannedPackages}
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
          onRefreshPackageLabel={refreshPackageLabel}
          onSavePackageLabel={savePackageLabel}
          onStageChange={setVisibleStage}
          operation={activeOperation}
          packageTypes={packageTypes}
          storageLocations={storageLocations}
        />
      ) : null}

      {workspaceRequested &&
      activeOperation?.status === "Open" &&
      activeWorksheetItem &&
      visibleStage === "packages" &&
      selectedTrays.length > 0 ? (
        <WorkflowStage
          className="packaging-direct-package-stage"
          collapsible
          id="direct-package-entry"
          description="Create one or more Packages and keep Finished Product Weight balanced against the selected source."
          stage={3}
          status={
            currentStage === "product" && selectedTrays.length > 0
              ? "available"
              : stageStatus(currentStage, "packages")
          }
          title="Allocate packages"
        >
          <form
            className="packaging-package-form space-y-5"
            onSubmit={reviewDirectPackages}
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

            <p className="text-sm text-slate-600">
              {selectedTrays.length} Tray
              {selectedTrays.length === 1 ? "" : "s"} mixed
            </p>

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

            <div className="packaging-table-wrap overflow-x-auto">
              <table className="data-table packaging-package-table">
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
                        <Select
                          className="table-input"
                          options={packageTypes.map((packageType) => ({
                            value: packageType.id,
                            label: packageType.name,
                          }))}
                          placeholder="Select"
                          value={line.package_type_id}
                          onChange={(packageTypeId) =>
                            updatePackageLine(line.id, {
                              package_type_id: packageTypeId,
                            })
                          }
                        />
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
                                finished_product_weight_value:
                                  event.target.value,
                              })
                            }
                          />
                          <Select
                            aria-label="Finished Product Weight Unit"
                            className="table-input w-20 shrink-0"
                            options={WEIGHT_UNIT_OPTIONS.map((unit) => ({
                              value: unit.value,
                              label: unit.label,
                            }))}
                            value={line.finished_product_weight_unit}
                            onChange={(unit) =>
                              updatePackageLine(line.id, {
                                finished_product_weight_unit:
                                  unit as WeightUnit,
                              })
                            }
                          />
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
                          <Select
                            aria-label="Sealed Package Weight Unit"
                            className="table-input w-20 shrink-0"
                            options={WEIGHT_UNIT_OPTIONS.map((unit) => ({
                              value: unit.value,
                              label: unit.label,
                            }))}
                            value={line.package_weight_unit}
                            onChange={(unit) =>
                              updatePackageLine(line.id, {
                                package_weight_unit: unit as WeightUnit,
                              })
                            }
                          />
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
                        <Select
                          className="table-input"
                          options={storageLocations
                            .filter(
                              (location) => location.name !== "Unassigned",
                            )
                            .map((location) => ({
                              value: location.id,
                              label: location.name,
                            }))}
                          placeholder="Unassigned"
                          value={line.storage_location_id}
                          onChange={(storageLocationId) =>
                            updatePackageLine(line.id, {
                              storage_location_id: storageLocationId,
                            })
                          }
                        />
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
            {reviewingDirectPackages ? (
              <section
                aria-label="Package creation review"
                className="packaging-package-review"
              >
                <div>
                  <p className="text-sm font-semibold">
                    Ready to create Packages
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {packageLines.length} Package
                    {packageLines.length === 1 ? "" : "s"} will use{" "}
                    {formatGrams(String(allocatedFinishedProductWeight))} of
                    Finished Product Weight. Confirm to record the Packages and
                    finish this Packaging Session.
                  </p>
                </div>
                <button
                  className="quiet-action"
                  type="button"
                  onClick={() => setReviewingDirectPackages(false)}
                >
                  Back to Package rows
                </button>
              </section>
            ) : null}
            <div className="packaging-stage-navigation">
              <button
                className="quiet-action"
                type="button"
                onClick={() => setVisibleStage("product")}
              >
                Back
              </button>
              <button
                className="primary-action packaging-primary-review-action"
                disabled={
                  selectedTrays.length === 0 ||
                  packageTypes.length === 0 ||
                  !allocationComplete ||
                  packageTrays.isPending
                }
                type="submit"
              >
                {reviewingDirectPackages
                  ? "Finish Packaging"
                  : "Review & Create Packages"}
              </button>
            </div>
          </form>
        </WorkflowStage>
      ) : null}
    </div>
  );
}

export function PackagingSessionSummary({
  allocatedWeightGrams,
  operationStatus,
  packageCount,
  remainingWeightGrams,
  selectedWeightGrams,
  trayCount,
}: {
  allocatedWeightGrams: number | null;
  operationStatus: PackagingOperation["status"];
  packageCount: number;
  remainingWeightGrams: number | null;
  selectedWeightGrams: number | null;
  trayCount: number;
}) {
  const allocationState =
    remainingWeightGrams === null
      ? "unavailable"
      : remainingWeightGrams < -ALLOCATION_TOLERANCE_GRAMS
        ? "overallocated"
        : remainingWeightGrams > ALLOCATION_TOLERANCE_GRAMS
          ? "remaining"
          : "balanced";
  const allocationTitle =
    operationStatus === "Completed"
      ? "Packaging complete"
      : allocationState === "balanced"
        ? "Weight is balanced"
        : allocationState === "overallocated"
          ? "Weight is overallocated"
          : allocationState === "remaining"
            ? "Weight remains to package"
            : "Waiting for source weight";
  const allocationCopy =
    operationStatus === "Completed"
      ? "Saved as read-only production history."
      : allocationState === "balanced"
        ? "Selected Finished Product Weight is fully allocated."
        : allocationState === "overallocated"
          ? `${formatOptionalWorkspaceWeight(Math.abs(remainingWeightGrams ?? 0))} must be removed from Package rows.`
          : allocationState === "remaining"
            ? `${formatOptionalWorkspaceWeight(remainingWeightGrams)} is still available to divide.`
            : "Select completed Trays or resume a saved Allocation.";

  return (
    <section
      aria-label="Packaging session summary"
      className="packaging-session-summary"
    >
      <dl className="packaging-session-summary__metrics">
        <div className="packaging-session-summary__metric">
          <dt>Selected source</dt>
          <dd>{formatOptionalWorkspaceWeight(selectedWeightGrams)}</dd>
          <p>
            From {trayCount} Tray{trayCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="packaging-session-summary__metric">
          <dt>Total to package</dt>
          <dd>{formatOptionalWorkspaceWeight(selectedWeightGrams)}</dd>
          <p>
            {formatOptionalWorkspaceWeight(allocatedWeightGrams)} allocated ·{" "}
            {formatOptionalWorkspaceWeight(remainingWeightGrams)} remaining
          </p>
        </div>
        <div className="packaging-session-summary__metric">
          <dt>Package count</dt>
          <dd>{packageCount}</dd>
          <p>planned or recorded</p>
        </div>
      </dl>
      <div
        className={`packaging-session-summary__status packaging-session-summary__status--${allocationState}`}
      >
        <span
          aria-hidden="true"
          className="packaging-session-summary__status-icon"
        >
          {allocationState === "balanced"
            ? "✓"
            : allocationState === "overallocated"
              ? "!"
              : "→"}
        </span>
        <div>
          <p className="packaging-session-summary__status-title">
            {allocationTitle}
          </p>
          <p>{allocationCopy}</p>
        </div>
      </div>
    </section>
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

function getBatchPackagingSummary({
  availableSourceWeight,
  availableTrayCount,
  operationStatus,
}: {
  availableSourceWeight: number;
  availableTrayCount: number;
  operationStatus: PackagingOperation["status"] | undefined;
}) {
  if (operationStatus === "Completed") {
    return "Packaging is complete. Open it to view the saved history.";
  }

  if (operationStatus === "Open") {
    if (availableTrayCount === 0) {
      return "Packaging is in progress. No additional Trays are ready to add.";
    }
    return `Packaging is in progress. ${availableTrayCount} additional ${availableTrayCount === 1 ? "Tray is" : "Trays are"} ready (${formatGrams(String(availableSourceWeight))}).`;
  }

  return `${availableTrayCount} ${availableTrayCount === 1 ? "Tray is" : "Trays are"} ready to package (${formatGrams(String(availableSourceWeight))}).`;
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

function PackagingOperationWorkspace({
  availableTrays,
  batch,
  visibleStage,
  formatError,
  onCompleteOperation,
  onRecordBag,
  onRecordLoss,
  onAutosavePlannedPackages,
  onPreviewPackageLabels,
  onPrintPackageLabels,
  onRefreshOperation,
  onRefreshCompletedWorkspace,
  onRefreshPackageLabel,
  onSavePackageLabel,
  onStageChange,
  operation,
  packageTypes,
  storageLocations,
}: {
  availableTrays: PackagingWorksheetItem["eligible_trays"];
  batch: ProductionBatch;
  visibleStage: PackagingStageId;
  formatError: (error: unknown) => string;
  onCompleteOperation: () => Promise<PackagingOperation>;
  onRecordBag: (
    operationId: string,
    allocationId: string,
    bag: PackageLineCreate,
  ) => Promise<PackagingOperation>;
  onRecordLoss: (
    operationId: string,
    allocationId: string,
    loss: RecordPackagingLossRequest,
  ) => Promise<PackagingOperation>;
  onAutosavePlannedPackages: (
    operationId: string,
    allocationId: string,
    plannedPackages: PlannedPackageInput[],
  ) => Promise<PackagingAllocation>;
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
  onSavePackageLabel: (
    packageId: string,
    body: PackageLabelUpdate,
  ) => Promise<void>;
  onStageChange: (stage: PackagingStageId) => void;
  operation: PackagingOperation;
  packageTypes: PackageType[];
  storageLocations: StorageLocation[];
}) {
  const draftProjections: Record<string, PlannedPackageProjection> = {};
  const selectedWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.selected_weight_grams),
    ),
  );
  const baggedWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.bagged_weight_grams),
    ),
  );
  const remainingToBagWeight = sumAvailableWeights(
    operation.allocations.map((allocation) =>
      finiteWeightOrNull(allocation.remaining_to_bag_grams),
    ),
  );
  const unrecordedPlannedPackageCount = operation.allocations.reduce(
    (total, allocation) =>
      total +
      allocation.planned_packages.filter(
        (row) => row.recorded_package_id === null,
      ).length,
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
  const completionBlockers = getCompletionBlockers(
    operation,
    allocationEvaluations,
  );
  const appearsEligible =
    operation.status === "Open" && completionBlockers.length === 0;

  return (
    <section
      aria-label="Packaging Operation workspace"
      className="packaging-operation-workspace mt-5 space-y-4 border-t border-slate-200 pt-5"
      hidden={visibleStage === "source" || visibleStage === "product"}
    >
      {operation.status === "Completed" && visibleStage === "finish" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Packaging is complete. This workspace is read-only history.
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            It remains available as historical context for this Production
            Batch.
          </p>
        </div>
      ) : null}

      <details
        className="packaging-operation-details rounded-md border border-slate-200 bg-white p-4"
        hidden={visibleStage === "packages"}
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Saved operation details
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="object-card">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Product Sources
            </p>
            <p className="mt-1 text-xl font-semibold">
              {operation.allocations.length}
            </p>
          </div>
          <div className="object-card">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Bags in Progress
            </p>
            <p className="mt-1 text-xl font-semibold">
              {unrecordedPlannedPackageCount}
            </p>
          </div>
          <div className="object-card">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Bags Saved
            </p>
            <p className="mt-1 text-xl font-semibold">{recordedPackageCount}</p>
          </div>
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
              Total in Source
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatOptionalWorkspaceWeight(selectedWeight)}
            </p>
          </div>
          <div className="object-card">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Bagged
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatOptionalWorkspaceWeight(baggedWeight)}
            </p>
          </div>
          <div className="object-card">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Remaining to Bag
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatOptionalWorkspaceWeight(remainingToBagWeight)}
            </p>
          </div>
        </div>
      </details>

      {visibleStage === "packages" && dirtyEvaluations.length > 0 ? (
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

      <div hidden={visibleStage !== "packages"}>
        <WorkflowStage
          className="packaging-allocations-stage"
          description="Fill and record one physical bag, then decide what to do next."
          stage={3}
          status="current"
          title="Package one bag at a time"
        >
          {operation.allocations.length === 0 ? (
            <div className="space-y-1 text-sm text-slate-600">
              <p>No product source has been selected yet.</p>
              <p>Go back and choose completed Trays before creating a bag.</p>
            </div>
          ) : (
            <SingleBagEntryLoop
              formatError={formatError}
              onBack={() => onStageChange("product")}
              onRecordBag={(allocationId, bag) =>
                onRecordBag(operation.id, allocationId, bag)
              }
              onRecordLoss={(allocationId, loss) =>
                onRecordLoss(operation.id, allocationId, loss)
              }
              onAutosavePlannedPackages={(allocationId, plannedPackages) =>
                onAutosavePlannedPackages(
                  operation.id,
                  allocationId,
                  plannedPackages,
                )
              }
              onRefreshLabel={(packageId) =>
                onRefreshPackageLabel(operation.production_batch_id, packageId)
              }
              onReview={() => onStageChange("review")}
              onSaveLabel={(packageId, body) =>
                onSavePackageLabel(packageId, body)
              }
              operation={operation}
              packageTypes={packageTypes}
              storageLocations={storageLocations}
            />
          )}
        </WorkflowStage>
      </div>

      <div hidden={visibleStage !== "review"}>
        <WorkflowStage
          className="packaging-review-stage"
          description="Confirm Package details, prepare labels, and print or reprint selected Avery 5163 labels."
          stage={4}
          status="current"
          title="Review & labels"
        >
          <PackagingReviewSummary operation={operation} />
          {operation.status === "Open" ? (
            recordedPackageCount > 0 ? (
              <PackageReviewWalkthrough
                formatError={formatError}
                onRefreshLabel={(packageId) =>
                  onRefreshPackageLabel(
                    operation.production_batch_id,
                    packageId,
                  )
                }
                onSaveLabel={(packageId, body) =>
                  onSavePackageLabel(packageId, body)
                }
                operation={operation}
              />
            ) : null
          ) : recordedPackageCount > 0 ? (
            <section
              aria-label="Package and Label details"
              className="space-y-2"
            >
              <h5 className="text-sm font-semibold">
                Package and Label details
              </h5>
              {operation.packages.map((recordedPackage) => (
                <details
                  className="packaging-review-package"
                  open={
                    !recordedPackage.label ||
                    recordedPackage.label.status === "Draft"
                      ? true
                      : undefined
                  }
                  key={recordedPackage.id}
                >
                  <summary>
                    {recordedPackage.package_identifier} ·{" "}
                    {recordedPackage.label?.status ?? "Label unavailable"}
                  </summary>
                  <RecordedPackageSummary
                    editable={false}
                    formatError={formatError}
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
                </details>
              ))}
            </section>
          ) : null}
          {recordedPackageCount === 0 ? (
            <p className="text-sm text-slate-600">
              Record a Package before reviewing labels and print output.
            </p>
          ) : (
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
          )}
          <StageNavigation
            backLabel="Back"
            nextDisabled={recordedPackageCount === 0}
            nextLabel="Next — Finish"
            onBack={() => onStageChange("packages")}
            onNext={() => onStageChange("finish")}
          />
        </WorkflowStage>
      </div>

      <div hidden={visibleStage !== "finish"}>
        <WorkflowStage
          className="packaging-finish-stage"
          description="Resolve every blocker, then explicitly complete Packaging and preserve the workspace as read-only history."
          stage={5}
          status="current"
          title="Finish"
        >
          <section aria-label="Packaging completion eligibility">
            <h5 className="text-sm font-semibold">Completion eligibility</h5>
            {operation.status === "Completed" ? (
              <p className="mt-1 text-sm text-slate-700">
                Packaging is already Completed. This historical workspace is not
                an actionable completion candidate.
              </p>
            ) : appearsEligible ? (
              <div className="mt-1 text-sm text-slate-700">
                <p className="font-semibold">Appears eligible for completion</p>
                <p>
                  Every Allocation is independently balanced and the visible
                  saved Package and Label requirements are satisfied. Backend
                  validation remains authoritative.
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
            {operation.status !== "Completed" && availableTrays.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">
                  {availableTrays.length} completed Tray
                  {availableTrays.length === 1 ? "" : "s"} for this Batch{" "}
                  {availableTrays.length === 1 ? "hasn't" : "haven't"} been
                  added to a Packaging Allocation.
                </p>
                <p className="mt-1">
                  Completing this Packaging Operation won&rsquo;t include{" "}
                  {availableTrays.length === 1 ? "it" : "them"}. A new Packaging
                  Operation will be needed to package{" "}
                  {availableTrays.length === 1 ? "it" : "them"} later.
                </p>
              </div>
            ) : null}
            <PackagingCompletionAction
              eligible={appearsEligible}
              formatError={formatError}
              onComplete={onCompleteOperation}
              onRefresh={onRefreshCompletedWorkspace}
              operation={operation}
            />
            <StageNavigation
              backLabel="Back"
              hideNext
              onBack={() => onStageChange("review")}
              onNext={() => undefined}
            />
          </section>
        </WorkflowStage>
      </div>
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

type BagEntryPhase = "enteringBag" | "recordingLoss" | "choosingNextAction";

type BagDraft = {
  packageTypeId: string;
  finishedWeight: string;
  finishedWeightUnit: WeightUnit;
  sealedWeight: string;
  sealedWeightUnit: WeightUnit;
  oxygenAbsorber: string;
  storageLocationId: string;
  notes: string;
  plannedPackageRowId: string | null;
};

/**
 * ADR-0017: the Bag form is the sole editor for its Planned Package Row.
 * "idle" — nothing meaningful entered yet, no row created.
 * "unsaved" — edited since the last successful autosave, save pending.
 * "saving" — autosave request in flight.
 * "saved" — matches what the backend holds.
 * "error" — the last autosave attempt failed.
 */
type AutosaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;

function isBagDraftBlank(draft: BagDraft): boolean {
  return (
    draft.packageTypeId === "" &&
    draft.finishedWeight === "" &&
    draft.sealedWeight === "" &&
    draft.oxygenAbsorber === "" &&
    draft.storageLocationId === "" &&
    draft.notes === ""
  );
}

type LossDraft = {
  weight: string;
  weightUnit: WeightUnit;
  reason: PackagingLossReason | "";
  reasonDetail: string;
};

const PACKAGING_LOSS_REASON_OPTIONS: {
  label: string;
  value: PackagingLossReason;
}[] = [
  { label: "Sampled", value: "Sampled" },
  { label: "Spilled", value: "Spilled" },
  { label: "Crumbs", value: "Crumbs" },
  { label: "Other", value: "Other" },
];

type SavedEntry =
  | { kind: "bag"; bagNumber: number; remainingWeight: number }
  | { kind: "loss"; remainingWeight: number };

function SingleBagEntryLoop({
  formatError,
  onBack,
  onRecordBag,
  onRecordLoss,
  onAutosavePlannedPackages,
  onRefreshLabel,
  onReview,
  onSaveLabel,
  operation,
  packageTypes,
  storageLocations,
}: {
  formatError: (error: unknown) => string;
  onBack: () => void;
  onRecordBag: (
    allocationId: string,
    bag: PackageLineCreate,
  ) => Promise<PackagingOperation>;
  onRecordLoss: (
    allocationId: string,
    loss: RecordPackagingLossRequest,
  ) => Promise<PackagingOperation>;
  onAutosavePlannedPackages: (
    allocationId: string,
    plannedPackages: PlannedPackageInput[],
  ) => Promise<PackagingAllocation>;
  onRefreshLabel: (packageId: string) => Promise<PackageLabel>;
  onReview: () => void;
  onSaveLabel: (packageId: string, body: PackageLabelUpdate) => Promise<void>;
  operation: PackagingOperation;
  packageTypes: PackageType[];
  storageLocations: StorageLocation[];
}) {
  const firstOpenAllocation =
    operation.allocations.find(
      (allocation) =>
        Number(allocation.remaining_weight_grams) >
          ALLOCATION_TOLERANCE_GRAMS ||
        allocation.planned_packages.some(
          (row) => row.recorded_package_id === null,
        ),
    ) ?? operation.allocations[0];
  const [activeAllocationId, setActiveAllocationId] = useState(
    firstOpenAllocation?.id ?? "",
  );
  const activeAllocation =
    operation.allocations.find(
      (allocation) => allocation.id === activeAllocationId,
    ) ?? firstOpenAllocation;
  const activePlan = activeAllocation?.planned_packages.find(
    (row) => row.recorded_package_id === null,
  );
  const activeRemaining = activeAllocation
    ? Number(activeAllocation.remaining_weight_grams)
    : 0;
  const activeRemainingToBag = activeAllocation
    ? Number(activeAllocation.remaining_to_bag_grams)
    : 0;
  const initialPhase: BagEntryPhase =
    operation.status === "Open" &&
    (activeRemaining > ALLOCATION_TOLERANCE_GRAMS || Boolean(activePlan))
      ? "enteringBag"
      : "choosingNextAction";
  const [phase, setPhase] = useState<BagEntryPhase>(initialPhase);
  const [draft, setDraft] = useState<BagDraft>(() =>
    createBagDraft(activePlan),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<SavedEntry | null>(null);
  const [lossDraft, setLossDraft] = useState<LossDraft>(() =>
    createLossDraft(),
  );
  const [lossErrors, setLossErrors] = useState<Record<string, string>>({});
  const [lossSaving, setLossSaving] = useState(false);
  const [lossSaveError, setLossSaveError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>(() =>
    activePlan ? "saved" : "idle",
  );
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [editingSavedBagIds, setEditingSavedBagIds] = useState<Set<string>>(
    () => new Set(),
  );
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushAutosaveRef = useRef<() => void>(() => {});
  const bagHeadingRef = useRef<HTMLHeadingElement>(null);
  const lossHeadingRef = useRef<HTMLHeadingElement>(null);
  const lossReturnPhaseRef = useRef<BagEntryPhase>("choosingNextAction");
  const bagNumber = operation.packages.length + 1;
  const totalPackagedWeight = operation.packages.reduce(
    (total, recordedPackage) =>
      total + Number(recordedPackage.finished_product_weight_grams ?? 0),
    0,
  );
  const activePackageType = packageTypes.find(
    (packageType) => packageType.id === draft.packageTypeId,
  );
  const unbalancedAllocation = operation.allocations.find(
    (allocation) =>
      Math.abs(Number(allocation.remaining_weight_grams)) >
      ALLOCATION_TOLERANCE_GRAMS,
  );
  const unrecordedPlanCount = operation.allocations.reduce(
    (total, allocation) =>
      total +
      allocation.planned_packages.filter(
        (row) => row.recorded_package_id === null,
      ).length,
    0,
  );
  const nextOpenAllocation = operation.allocations.find(
    (allocation) =>
      Number(allocation.remaining_weight_grams) > ALLOCATION_TOLERANCE_GRAMS ||
      allocation.planned_packages.some(
        (row) => row.recorded_package_id === null,
      ),
  );
  const activeSourceNumber =
    operation.allocations.findIndex(
      (allocation) => allocation.id === activeAllocation?.id,
    ) + 1;
  const nextOpenSourceNumber = nextOpenAllocation
    ? operation.allocations.findIndex(
        (allocation) => allocation.id === nextOpenAllocation.id,
      ) + 1
    : null;
  const switchesSource = Boolean(
    nextOpenAllocation && nextOpenAllocation.id !== activeAllocation?.id,
  );
  const reviewBlocked = Boolean(
    unbalancedAllocation || unrecordedPlanCount > 0,
  );
  const reviewBlockMessage = getReviewBlockMessage(
    operation,
    unbalancedAllocation,
    unrecordedPlanCount,
  );

  useEffect(() => {
    if (phase === "enteringBag") bagHeadingRef.current?.focus();
    if (phase === "recordingLoss") lossHeadingRef.current?.focus();
  }, [activeAllocationId, phase]);

  useEffect(() => {
    return () => {
      flushAutosaveRef.current();
    };
  }, []);

  function chooseAllocation(allocationId: string) {
    const allocation = operation.allocations.find(
      (candidate) => candidate.id === allocationId,
    );
    if (!allocation) return;
    flushAutosaveRef.current();
    setActiveAllocationId(allocationId);
    const nextPlan = allocation.planned_packages.find(
      (row) => row.recorded_package_id === null,
    );
    setDraft(createBagDraft(nextPlan, draft.packageTypeId));
    setAutosaveStatus(nextPlan ? "saved" : "idle");
    setAutosaveError(null);
    setErrors({});
    setSaveError(null);
    setDecisionError(null);
    setPhase("enteringBag");
  }

  function scheduleAutosave(target: BagDraft) {
    if (!activeAllocation) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!target.plannedPackageRowId && isBagDraftBlank(target)) {
      setAutosaveStatus("idle");
      return;
    }
    setAutosaveStatus("unsaved");
    autosaveTimerRef.current = setTimeout(() => {
      void performAutosave(target);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function performAutosave(target: BagDraft) {
    if (!activeAllocation) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setAutosaveStatus("saving");
    const knownSiblingIds = new Set(
      activeAllocation.planned_packages
        .filter(
          (row) =>
            row.recorded_package_id === null &&
            row.id !== target.plannedPackageRowId,
        )
        .map((row) => row.id),
    );
    try {
      const updatedAllocation = await onAutosavePlannedPackages(
        activeAllocation.id,
        buildPlannedPackagesPayload(activeAllocation, target),
      );
      const savedRowId = target.plannedPackageRowId
        ? target.plannedPackageRowId
        : (updatedAllocation.planned_packages.find(
            (row) =>
              row.recorded_package_id === null && !knownSiblingIds.has(row.id),
          )?.id ?? null);
      setDraft((current) =>
        current.plannedPackageRowId
          ? current
          : { ...current, plannedPackageRowId: savedRowId },
      );
      setAutosaveStatus("saved");
      setAutosaveError(null);
    } catch (error) {
      setAutosaveStatus("error");
      setAutosaveError(formatError(error));
    }
  }

  function flushAutosave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
      if (autosaveStatus === "unsaved") {
        void performAutosave(draft);
      }
    }
  }
  flushAutosaveRef.current = flushAutosave;

  function retryAutosave() {
    void performAutosave(draft);
  }

  function handleBack() {
    flushAutosaveRef.current();
    onBack();
  }

  function updateDraft(values: Partial<BagDraft>) {
    const next = { ...draft, ...values };
    setDraft(next);
    setErrors({});
    setSaveError(null);
    scheduleAutosave(next);
  }

  function changePackageType(packageTypeId: string) {
    const previous = packageTypes.find(
      (packageType) => packageType.id === draft.packageTypeId,
    );
    const next = packageTypes.find(
      (packageType) => packageType.id === packageTypeId,
    );
    const shouldUseDefault =
      draft.oxygenAbsorber.trim() === "" ||
      draft.oxygenAbsorber === (previous?.default_oxygen_absorber ?? "");
    updateDraft({
      packageTypeId,
      oxygenAbsorber: shouldUseDefault
        ? (next?.default_oxygen_absorber ?? "")
        : draft.oxygenAbsorber,
    });
  }

  async function saveBag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAllocation || saving) return;
    if (
      autosaveStatus === "unsaved" ||
      autosaveStatus === "saving" ||
      autosaveStatus === "error"
    ) {
      return;
    }
    const persistedRowWeight = draft.plannedPackageRowId
      ? Number(
          activeAllocation.planned_packages.find(
            (row) => row.id === draft.plannedPackageRowId,
          )?.finished_product_weight_grams ?? 0,
        )
      : 0;
    const nextErrors = validateBagDraft(
      draft,
      activeRemaining + persistedRowWeight,
      packageTypes,
    );
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await onRecordBag(activeAllocation.id, {
        planned_package_row_id: draft.plannedPackageRowId,
        package_type_id: draft.packageTypeId,
        finished_product_weight_grams: toGrams(
          draft.finishedWeight,
          draft.finishedWeightUnit,
        ),
        sealed_package_weight_grams: toGrams(
          draft.sealedWeight,
          draft.sealedWeightUnit,
        ),
        oxygen_absorber: draft.oxygenAbsorber.trim() || null,
        storage_location_id: draft.storageLocationId || null,
        notes: draft.notes.trim() || null,
      });
      const updatedAllocation = updated.allocations.find(
        (allocation) => allocation.id === activeAllocation.id,
      );
      setLastSaved({
        kind: "bag",
        bagNumber,
        remainingWeight: Number(updatedAllocation?.remaining_weight_grams ?? 0),
      });
      setAutosaveStatus("idle");
      setAutosaveError(null);
      setDecisionError(null);
      setPhase("choosingNextAction");
    } catch (error) {
      setSaveError(formatError(error));
    } finally {
      setSaving(false);
    }
  }

  function addAnotherBag() {
    const nextAllocation = nextOpenAllocation ?? activeAllocation;
    if (!nextAllocation) return;
    setActiveAllocationId(nextAllocation.id);
    const nextPlan = nextAllocation.planned_packages.find(
      (row) => row.recorded_package_id === null,
    );
    setDraft(createBagDraft(nextPlan, draft.packageTypeId));
    setAutosaveStatus(nextPlan ? "saved" : "idle");
    setAutosaveError(null);
    setErrors({});
    setSaveError(null);
    setDecisionError(null);
    setPhase("enteringBag");
  }

  function startRecordingLoss() {
    lossReturnPhaseRef.current =
      phase === "recordingLoss" ? "enteringBag" : phase;
    setLossDraft(createLossDraft());
    setLossErrors({});
    setLossSaveError(null);
    setDecisionError(null);
    setPhase("recordingLoss");
  }

  function updateLossDraft(values: Partial<LossDraft>) {
    setLossDraft((current) => ({ ...current, ...values }));
    setLossErrors({});
    setLossSaveError(null);
  }

  function cancelRecordingLoss() {
    setLossErrors({});
    setLossSaveError(null);
    setPhase(lossReturnPhaseRef.current);
  }

  async function saveLoss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAllocation || lossSaving) return;
    const nextErrors = validateLossDraft(lossDraft, activeRemaining);
    if (Object.keys(nextErrors).length > 0) {
      setLossErrors(nextErrors);
      return;
    }
    setLossSaving(true);
    setLossSaveError(null);
    try {
      const updated = await onRecordLoss(activeAllocation.id, {
        weight_grams: toGrams(lossDraft.weight, lossDraft.weightUnit),
        reason: lossDraft.reason as PackagingLossReason,
        reason_detail:
          lossDraft.reason === "Other"
            ? lossDraft.reasonDetail.trim() || null
            : null,
      });
      const updatedAllocation = updated.allocations.find(
        (allocation) => allocation.id === activeAllocation.id,
      );
      setLastSaved({
        kind: "loss",
        remainingWeight: Number(updatedAllocation?.remaining_weight_grams ?? 0),
      });
      setDecisionError(null);
      setPhase("choosingNextAction");
    } catch (error) {
      setLossSaveError(formatError(error));
    } finally {
      setLossSaving(false);
    }
  }

  function reviewBags() {
    if (reviewBlocked) {
      setDecisionError(reviewBlockMessage);
      return;
    }
    onReview();
  }

  if (!activeAllocation) return null;

  const isOverallocated = activeRemaining < -ALLOCATION_TOLERANCE_GRAMS;
  const switchableAllocations = operation.allocations.filter(
    (allocation) =>
      allocation.id === activeAllocation.id ||
      Math.abs(Number(allocation.remaining_weight_grams)) >
        ALLOCATION_TOLERANCE_GRAMS,
  );
  const activeDisplayUnit: WeightUnit =
    phase === "recordingLoss" ? lossDraft.weightUnit : draft.finishedWeightUnit;
  const formatWorkspaceWeight = (value: number | null) =>
    value === null || !Number.isFinite(value)
      ? "Unavailable"
      : formatWeightInUnit(value, activeDisplayUnit, 3);

  return (
    <div className="single-bag-loop">
      <section
        aria-label="Packaging weight status"
        className={`single-bag-hero${isOverallocated ? " single-bag-hero--attention" : ""}`}
      >
        <p className="single-bag-hero__remaining">
          {isOverallocated
            ? `${formatWeightInUnit(Math.abs(activeRemaining), activeDisplayUnit)} overallocated`
            : `${formatWeightInUnit(activeRemainingToBag, activeDisplayUnit)} remaining to package`}
        </p>
        <p className="single-bag-hero__packaged">
          {formatWeightInUnit(totalPackagedWeight, activeDisplayUnit)} packaged
          across {operation.packages.length} bag
          {operation.packages.length === 1 ? "" : "s"}
        </p>
      </section>

      <SummaryPanel
        className="single-bag-sidebar"
        items={[
          {
            label: "Total in source",
            value: formatWorkspaceWeight(
              finiteWeightOrNull(activeAllocation.selected_weight_grams),
            ),
          },
          {
            label: "Bagged",
            value: formatWorkspaceWeight(
              finiteWeightOrNull(activeAllocation.bagged_weight_grams),
            ),
          },
          {
            label: "Bags saved",
            value: activeAllocation.packages.length,
          },
          {
            label: isOverallocated ? "Overallocated" : "Remaining to bag",
            value: formatWorkspaceWeight(
              isOverallocated
                ? Math.abs(
                    finiteWeightOrNull(
                      activeAllocation.remaining_weight_grams,
                    ) ?? 0,
                  )
                : finiteWeightOrNull(activeAllocation.remaining_to_bag_grams),
            ),
            emphasis: true,
          },
        ]}
        title="Packaging summary"
      >
        <p className="single-bag-sidebar__eyebrow">Current Package Type</p>
        <p className="single-bag-sidebar__package-type">
          {activePackageType?.name ?? "Not selected"}
        </p>
        <p className="single-bag-sidebar__detail">
          {activePackageType
            ? activePackageType.default_oxygen_absorber
              ? `Default oxygen absorber: ${activePackageType.default_oxygen_absorber}`
              : "No default oxygen absorber"
            : "Choose a Package Type for this Bag."}
        </p>
      </SummaryPanel>

      {switchableAllocations.length > 1 ? (
        <Field
          className="single-bag-source-selector"
          htmlFor="bag-product-source"
          label="Product source"
        >
          <Select
            id="bag-product-source"
            options={switchableAllocations.map((allocation) => ({
              value: allocation.id,
              label: `Source ${
                operation.allocations.findIndex(
                  (candidate) => candidate.id === allocation.id,
                ) + 1
              }`,
              description: `${formatGrams(String(allocation.remaining_weight_grams), 3)} remaining`,
            }))}
            value={activeAllocation.id}
            onChange={chooseAllocation}
          />
        </Field>
      ) : null}

      {operation.packages.length > 0
        ? (() => {
            const activeSourcePackages: Array<{
              recordedPackage: (typeof operation.packages)[number];
              index: number;
            }> = [];
            const otherSourcePackages: Array<{
              recordedPackage: (typeof operation.packages)[number];
              index: number;
            }> = [];
            operation.packages.forEach((recordedPackage, index) => {
              const bucket =
                recordedPackage.packaging_allocation_id === activeAllocation.id
                  ? activeSourcePackages
                  : otherSourcePackages;
              bucket.push({ recordedPackage, index });
            });

            const renderSavedBagCard = ({
              recordedPackage,
              index,
            }: {
              recordedPackage: (typeof operation.packages)[number];
              index: number;
            }) => {
              const label = recordedPackage.label as
                | PackageLabel
                | null
                | undefined;
              const isEditingSavedBag = editingSavedBagIds.has(
                recordedPackage.id,
              );
              return (
                <details
                  aria-label={`Bag ${index + 1}, ${recordedPackage.package_type.name}, ${formatOptionalWorkspaceWeight(
                    finiteWeightOrNull(
                      recordedPackage.finished_product_weight_grams,
                    ),
                  )}, Saved`}
                  className="saved-bag-card"
                  key={recordedPackage.id}
                  role="listitem"
                >
                  <summary className="saved-bag-card__summary">
                    <span aria-hidden="true" className="saved-bag-card__icon">
                      ▣
                    </span>
                    <span className="saved-bag-card__copy">
                      <strong>Bag {index + 1}</strong>
                      <span>{recordedPackage.package_type.name}</span>
                    </span>
                    <span className="saved-bag-card__weight">
                      {formatOptionalWorkspaceWeight(
                        finiteWeightOrNull(
                          recordedPackage.finished_product_weight_grams,
                        ),
                      )}
                    </span>
                    <span className="saved-bag-card__status">Saved</span>
                  </summary>
                  <div className="saved-bag-card__details mt-3">
                    {!label ? (
                      <p className="text-sm text-slate-600">
                        No Package Label is recorded for this Package.
                      </p>
                    ) : isEditingSavedBag ? (
                      <PackageLabelEditor
                        formatError={formatError}
                        key={recordedPackage.id}
                        label={label}
                        onRefresh={() => onRefreshLabel(recordedPackage.id)}
                        onSave={(body) => onSaveLabel(recordedPackage.id, body)}
                        packageIdentifier={recordedPackage.package_identifier}
                      />
                    ) : (
                      <>
                        <BagLabelPreview
                          label={label}
                          recordedPackage={recordedPackage}
                        />
                        <button
                          className="secondary-action mt-3"
                          type="button"
                          onClick={() =>
                            setEditingSavedBagIds((current) => {
                              if (current.has(recordedPackage.id))
                                return current;
                              const next = new Set(current);
                              next.add(recordedPackage.id);
                              return next;
                            })
                          }
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </details>
              );
            };

            return (
              <>
                {activeSourcePackages.length > 0 ? (
                  <section
                    className="saved-bag-summary"
                    aria-label="Saved bags"
                  >
                    <h5>Saved bags</h5>
                    <div className="saved-bag-summary__rows" role="list">
                      {activeSourcePackages.map(renderSavedBagCard)}
                    </div>
                  </section>
                ) : null}
                {otherSourcePackages.length > 0 ? (
                  <section
                    className="saved-bag-summary saved-bag-summary--other"
                    aria-label="Other saved bags this session"
                  >
                    <h5>Other saved bags this session</h5>
                    <p className="text-sm text-slate-600">
                      Saved from a different Product Source earlier in this
                      Packaging Operation.
                    </p>
                    <div className="saved-bag-summary__rows" role="list">
                      {otherSourcePackages.map(renderSavedBagCard)}
                    </div>
                  </section>
                ) : null}
              </>
            );
          })()
        : null}

      <p className="sr-only" aria-live="polite" role="status">
        {lastSaved
          ? lastSaved.kind === "bag"
            ? `Bag ${lastSaved.bagNumber} saved. ${formatGrams(String(lastSaved.remainingWeight), 3)} remaining to package.`
            : `Packaging Loss recorded. ${formatGrams(String(lastSaved.remainingWeight), 3)} remaining to package.`
          : ""}
      </p>

      {phase === "enteringBag" && operation.status === "Open" ? (
        <form className="single-bag-form" onSubmit={saveBag} noValidate>
          <h5 ref={bagHeadingRef} tabIndex={-1}>
            Bag {bagNumber}
          </h5>
          <div className="single-bag-form__fields">
            <Field
              error={errors.packageType}
              errorId="bag-package-type-error"
              htmlFor="bag-package-type"
              label="Package Type"
            >
              <Select
                aria-describedby={
                  errors.packageType ? "bag-package-type-error" : undefined
                }
                aria-invalid={Boolean(errors.packageType)}
                id="bag-package-type"
                options={packageTypes.map((packageType) => ({
                  value: packageType.id,
                  label: packageType.name,
                  description: packageType.default_oxygen_absorber
                    ? `Default absorber: ${packageType.default_oxygen_absorber}`
                    : undefined,
                }))}
                placeholder="Select Package Type"
                value={draft.packageTypeId}
                onChange={changePackageType}
              />
            </Field>
            <BagWeightField
              error={errors.finishedWeight}
              id="bag-finished-weight"
              label="Finished Product Weight"
              unit={draft.finishedWeightUnit}
              value={draft.finishedWeight}
              onChange={(finishedWeight) => updateDraft({ finishedWeight })}
              onUnitChange={(finishedWeightUnit) =>
                updateDraft({ finishedWeightUnit })
              }
            />
            <BagWeightField
              error={errors.sealedWeight}
              id="bag-sealed-weight"
              label="Sealed Package Weight"
              unit={draft.sealedWeightUnit}
              value={draft.sealedWeight}
              onChange={(sealedWeight) => updateDraft({ sealedWeight })}
              onUnitChange={(sealedWeightUnit) =>
                updateDraft({ sealedWeightUnit })
              }
            />
            <Field htmlFor="bag-oxygen-absorber" label="Oxygen Absorber">
              <TextField
                id="bag-oxygen-absorber"
                placeholder="Enter absorber size"
                value={draft.oxygenAbsorber}
                onChange={(event) =>
                  updateDraft({ oxygenAbsorber: event.target.value })
                }
              />
            </Field>
            <Field htmlFor="bag-storage-location" label="Storage Location">
              <Select
                id="bag-storage-location"
                options={storageLocations
                  .filter((location) => location.name !== "Unassigned")
                  .map((location) => ({
                    value: location.id,
                    label: location.name,
                  }))}
                placeholder="Unassigned"
                value={draft.storageLocationId}
                onChange={(storageLocationId) =>
                  updateDraft({ storageLocationId })
                }
              />
            </Field>
            <Field
              className="single-bag-form__notes"
              htmlFor="bag-notes"
              label="Notes"
              optional
            >
              <Textarea
                id="bag-notes"
                maxLength={200}
                placeholder="Add notes about this bag…"
                rows={3}
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
              />
              <span className="single-bag-form__character-count">
                {draft.notes.length} / 200
              </span>
            </Field>
          </div>
          {autosaveStatus !== "idle" ? (
            <p className="single-bag-form__autosave-status" aria-live="polite">
              {autosaveStatus === "saving"
                ? "Saving…"
                : autosaveStatus === "saved"
                  ? "Saved"
                  : autosaveStatus === "error"
                    ? "Autosave failed"
                    : "Unsaved"}
            </p>
          ) : null}
          {autosaveStatus === "error" ? (
            <div className="error-banner" role="alert">
              <p>
                {autosaveError ?? "This Bag could not be saved."} Save Bag is
                unavailable until it saves successfully.
              </p>
              <button
                className="secondary-action mt-2"
                type="button"
                onClick={retryAutosave}
              >
                Retry saving this Bag
              </button>
            </div>
          ) : null}
          {saveError ? (
            <p className="error-banner" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="single-bag-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={handleBack}
            >
              Back
            </button>
            {activeRemaining > ALLOCATION_TOLERANCE_GRAMS ? (
              <button
                className="secondary-action"
                type="button"
                onClick={startRecordingLoss}
              >
                Record loss
              </button>
            ) : null}
            <button
              className="primary-action"
              disabled={
                saving ||
                autosaveStatus === "unsaved" ||
                autosaveStatus === "saving" ||
                autosaveStatus === "error"
              }
              type="submit"
            >
              {saving ? "Saving…" : `Save Bag ${bagNumber}`}
            </button>
          </div>
        </form>
      ) : phase === "recordingLoss" && operation.status === "Open" ? (
        <form className="single-bag-form" onSubmit={saveLoss} noValidate>
          <h5 ref={lossHeadingRef} tabIndex={-1}>
            Record Packaging Loss
          </h5>
          <div className="single-bag-form__fields">
            <BagWeightField
              error={lossErrors.weight}
              id="loss-weight"
              label="Weight"
              unit={lossDraft.weightUnit}
              value={lossDraft.weight}
              onChange={(weight) => updateLossDraft({ weight })}
              onUnitChange={(weightUnit) => updateLossDraft({ weightUnit })}
            />
            <Field
              error={lossErrors.reason}
              errorId="loss-reason-error"
              htmlFor="loss-reason"
              label="Reason"
            >
              <Select
                aria-describedby={
                  lossErrors.reason ? "loss-reason-error" : undefined
                }
                aria-invalid={Boolean(lossErrors.reason)}
                id="loss-reason"
                options={PACKAGING_LOSS_REASON_OPTIONS}
                placeholder="Select a reason"
                value={lossDraft.reason}
                onChange={(reason) =>
                  updateLossDraft({
                    reason: reason as PackagingLossReason,
                    reasonDetail:
                      reason === "Other" ? lossDraft.reasonDetail : "",
                  })
                }
              />
            </Field>
            {lossDraft.reason === "Other" ? (
              <Field
                className="single-bag-form__notes"
                htmlFor="loss-reason-detail"
                label="Detail"
                optional
              >
                <Textarea
                  id="loss-reason-detail"
                  maxLength={200}
                  placeholder="Describe what happened…"
                  rows={3}
                  value={lossDraft.reasonDetail}
                  onChange={(event) =>
                    updateLossDraft({ reasonDetail: event.target.value })
                  }
                />
                <span className="single-bag-form__character-count">
                  {lossDraft.reasonDetail.length} / 200
                </span>
              </Field>
            ) : null}
          </div>
          {lossSaveError ? (
            <p className="error-banner" role="alert">
              {lossSaveError}
            </p>
          ) : null}
          <div className="single-bag-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={cancelRecordingLoss}
            >
              Cancel
            </button>
            <button
              className="primary-action"
              disabled={lossSaving}
              type="submit"
            >
              {lossSaving ? "Saving…" : "Save Packaging Loss"}
            </button>
          </div>
        </form>
      ) : (
        <section
          className="single-bag-decision"
          aria-labelledby="bag-next-action"
        >
          {lastSaved ? (
            <p className="single-bag-decision__saved">
              {lastSaved.kind === "bag"
                ? `Bag ${lastSaved.bagNumber} saved`
                : "Packaging Loss recorded"}{" "}
              · {formatGrams(String(lastSaved.remainingWeight), 3)} remaining to
              package
            </p>
          ) : null}
          <h5 id="bag-next-action">
            {switchesSource
              ? `Source ${activeSourceNumber} is complete. Continue with Source ${nextOpenSourceNumber}?`
              : "Do you have another bag to package?"}
          </h5>
          <div className="single-bag-decision__actions">
            <button
              className={reviewBlocked ? "primary-action" : "secondary-action"}
              disabled={!nextOpenAllocation}
              type="button"
              onClick={addAnotherBag}
            >
              {switchesSource
                ? `Continue with Source ${nextOpenSourceNumber}`
                : "Add another bag"}
            </button>
            {operation.status === "Open" &&
            activeRemaining > ALLOCATION_TOLERANCE_GRAMS ? (
              <button
                className="secondary-action"
                type="button"
                onClick={startRecordingLoss}
              >
                Record loss
              </button>
            ) : null}
            <button
              aria-describedby={
                reviewBlocked ? "bag-review-blocked" : undefined
              }
              className={reviewBlocked ? "secondary-action" : "primary-action"}
              disabled={reviewBlocked}
              type="button"
              onClick={reviewBags}
            >
              No more bags — Review
            </button>
          </div>
          {reviewBlocked ? (
            <p
              className="single-bag-decision__guidance"
              id="bag-review-blocked"
            >
              {reviewBlockMessage}
            </p>
          ) : null}
          {decisionError ? (
            <p className="field-error" role="alert">
              {decisionError}
            </p>
          ) : null}
          <button className="quiet-action" type="button" onClick={handleBack}>
            Back
          </button>
        </section>
      )}

      <details className="single-bag-history">
        <summary>Allocation history</summary>
        <div className="single-bag-history__content">
          {operation.allocations.map((allocation, index) => (
            <div key={allocation.id}>
              <p>
                Source {index + 1} · {allocation.source_trays.length} Tray
                {allocation.source_trays.length === 1 ? "" : "s"} ·{" "}
                {formatGrams(String(allocation.remaining_weight_grams), 3)}{" "}
                remaining
              </p>
              {allocation.packaging_losses.map((loss) => (
                <p className="single-bag-history__loss" key={loss.id}>
                  Packaging Loss · {formatGrams(String(loss.weight_grams), 3)} ·{" "}
                  {loss.reason}
                  {loss.reason === "Other" && loss.reason_detail
                    ? ` — ${loss.reason_detail}`
                    : ""}
                </p>
              ))}
            </div>
          ))}
        </div>
      </details>
      <details className="single-bag-history">
        <summary>Recorded Package history</summary>
        <div className="single-bag-history__content">
          {operation.packages.map((recordedPackage) => (
            <p key={recordedPackage.id}>
              {recordedPackage.package_identifier} · {recordedPackage.status}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}

function createBagDraft(
  plannedPackage?: PlannedPackageRow,
  defaultPackageTypeId = "",
): BagDraft {
  const finishedWeight = fromGramsForInput(
    plannedPackage?.finished_product_weight_grams?.toString() ?? null,
  );
  const sealedWeight = fromGramsForInput(
    plannedPackage?.sealed_package_weight_grams?.toString() ?? null,
  );
  return {
    packageTypeId: plannedPackage?.package_type_id ?? defaultPackageTypeId,
    finishedWeight: finishedWeight.value,
    finishedWeightUnit: finishedWeight.unit,
    sealedWeight: sealedWeight.value,
    sealedWeightUnit: sealedWeight.unit,
    oxygenAbsorber: plannedPackage?.oxygen_absorber ?? "",
    storageLocationId: plannedPackage?.storage_location_id ?? "",
    notes: plannedPackage?.notes ?? "",
    plannedPackageRowId: plannedPackage?.id ?? null,
  };
}

/**
 * Builds the PATCH .../allocations/{id} payload for autosaving one Bag's
 * draft. Per ADR-0017's Reconciliation scope, this only ever needs to
 * describe the Allocation's unrecorded Planned Package Rows: sibling rows
 * are passed through by id alone (a no-op update, protecting them from the
 * endpoint's remove-if-absent reconciliation), and the current draft carries
 * its full field set so edits and clears both persist.
 */
function buildPlannedPackagesPayload(
  allocation: PackagingAllocation,
  draft: BagDraft,
): PlannedPackageInput[] {
  const siblings: PlannedPackageInput[] = allocation.planned_packages
    .filter(
      (row) =>
        row.recorded_package_id === null &&
        row.id !== draft.plannedPackageRowId,
    )
    .map((row) => ({ id: row.id }));
  const current: PlannedPackageInput = {
    ...(draft.plannedPackageRowId ? { id: draft.plannedPackageRowId } : {}),
    package_type_id: draft.packageTypeId || null,
    finished_product_weight_grams:
      toGrams(draft.finishedWeight, draft.finishedWeightUnit) || null,
    finished_product_weight_unit: draft.finishedWeightUnit,
    sealed_package_weight_grams:
      toGrams(draft.sealedWeight, draft.sealedWeightUnit) || null,
    sealed_package_weight_unit: draft.sealedWeightUnit,
    oxygen_absorber: draft.oxygenAbsorber.trim() || null,
    storage_location_id: draft.storageLocationId || null,
    notes: draft.notes.trim() || null,
  };
  return [...siblings, current];
}

function validateBagDraft(
  draft: BagDraft,
  remainingWeight: number,
  packageTypes: PackageType[],
) {
  const errors: Record<string, string> = {};
  const finishedWeight = Number(
    toGrams(draft.finishedWeight, draft.finishedWeightUnit),
  );
  const sealedWeight = Number(
    toGrams(draft.sealedWeight, draft.sealedWeightUnit),
  );
  if (!packageTypes.some((type) => type.id === draft.packageTypeId)) {
    errors.packageType = "Select a Package Type.";
  }
  if (!Number.isFinite(finishedWeight) || finishedWeight <= 0) {
    errors.finishedWeight = "Enter a Finished Product Weight greater than 0 g.";
  } else if (finishedWeight - remainingWeight > ALLOCATION_TOLERANCE_GRAMS) {
    errors.finishedWeight = `Finished Product Weight exceeds the remaining ${formatGrams(String(remainingWeight), 3)}.`;
  }
  if (!Number.isFinite(sealedWeight) || sealedWeight <= 0) {
    errors.sealedWeight = "Enter a Sealed Package Weight greater than 0 g.";
  } else if (Number.isFinite(finishedWeight) && sealedWeight < finishedWeight) {
    errors.sealedWeight =
      "Sealed Package Weight cannot be lower than Finished Product Weight.";
  }
  return errors;
}

function createLossDraft(): LossDraft {
  return {
    weight: "",
    weightUnit: "g",
    reason: "",
    reasonDetail: "",
  };
}

function validateLossDraft(draft: LossDraft, remainingWeight: number) {
  const errors: Record<string, string> = {};
  const weight = Number(toGrams(draft.weight, draft.weightUnit));
  if (!draft.reason) {
    errors.reason = "Select a reason.";
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    errors.weight = "Enter a weight greater than 0 g.";
  } else if (weight - remainingWeight > ALLOCATION_TOLERANCE_GRAMS) {
    errors.weight = `Weight exceeds the remaining ${formatGrams(String(remainingWeight), 3)}.`;
  }
  return errors;
}

function getReviewBlockMessage(
  operation: PackagingOperation,
  unbalancedAllocation: PackagingOperation["allocations"][number] | undefined,
  unrecordedPlanCount: number,
) {
  if (unbalancedAllocation) {
    const sourceNumber =
      operation.allocations.findIndex(
        (allocation) => allocation.id === unbalancedAllocation.id,
      ) + 1;
    const remainingWeight = Number(unbalancedAllocation.remaining_weight_grams);
    if (remainingWeight < -ALLOCATION_TOLERANCE_GRAMS) {
      return `Source ${sourceNumber} is overallocated by ${formatGrams(String(Math.abs(remainingWeight)), 3)}. Correct its saved Bags before Review.`;
    }
    return `Source ${sourceNumber} has ${formatGrams(String(remainingWeight), 3)} remaining before Review.`;
  }
  if (unrecordedPlanCount > 0) {
    return `${unrecordedPlanCount} planned Bag${unrecordedPlanCount === 1 ? "" : "s"} still need to be recorded before Review.`;
  }
  return "Packaging is ready for Review.";
}

function BagWeightField({
  error,
  id,
  label,
  onChange,
  onUnitChange,
  unit,
  value,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  onUnitChange: (unit: WeightUnit) => void;
  unit: WeightUnit;
  value: string;
}) {
  const errorId = `${id}-error`;
  return (
    <Field error={error} errorId={errorId} htmlFor={id} label={label}>
      <div className="packaging-weight-input">
        <NumberField
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          id={id}
          min="0"
          placeholder="Enter weight"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Select
          aria-label={`${label} unit`}
          className="packaging-weight-input__unit"
          id={`${id}-unit`}
          options={WEIGHT_UNIT_OPTIONS.map((weightUnit) => ({
            label: weightUnit.label,
            value: weightUnit.value,
          }))}
          value={unit}
          onChange={(nextUnit) => onUnitChange(nextUnit as WeightUnit)}
        />
      </div>
    </Field>
  );
}

export function AllocationBalanceSummary({
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

export function PlannedPackageSummary({
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

function PackageReviewWalkthrough({
  formatError,
  onRefreshLabel,
  onSaveLabel,
  operation,
}: {
  formatError: (error: unknown) => string;
  onRefreshLabel: (packageId: string) => Promise<PackageLabel>;
  onSaveLabel: (packageId: string, body: PackageLabelUpdate) => Promise<void>;
  operation: PackagingOperation;
}) {
  const packages = operation.packages;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(
    () =>
      new Set(
        packages
          .filter(
            (recordedPackage) =>
              !recordedPackage.label ||
              recordedPackage.label.status === "Draft",
          )
          .map((recordedPackage) => recordedPackage.id),
      ),
  );
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());

  if (packages.length === 0) return null;

  if (currentIndex >= packages.length) {
    return (
      <div
        aria-label="Bag review complete"
        className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700"
      >
        <p>
          You&rsquo;ve reviewed all {packages.length} Bag
          {packages.length === 1 ? "" : "s"}. Continue to labels and printing
          below, or look back at a Bag.
        </p>
        <button
          className="quiet-action mt-2"
          type="button"
          onClick={() => setCurrentIndex(Math.max(packages.length - 1, 0))}
        >
          Review Bags again
        </button>
      </div>
    );
  }

  const recordedPackage = packages[currentIndex];
  const bagNumber = currentIndex + 1;
  const isApproved = approvedIds.has(recordedPackage.id);
  const isEditing = editingIds.has(recordedPackage.id);
  const isDirty = dirtyIds.has(recordedPackage.id);
  const label = recordedPackage.label as PackageLabel | null | undefined;
  const allocationIndex = operation.allocations.findIndex((allocation) =>
    allocation.packages.some(
      (candidate) => candidate.id === recordedPackage.id,
    ),
  );

  function setMembership(
    setState: Dispatch<SetStateAction<Set<string>>>,
    id: string,
    included: boolean,
  ) {
    setState((current) => {
      if (current.has(id) === included) return current;
      const next = new Set(current);
      if (included) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <article
      aria-label={`Bag ${bagNumber} review`}
      className="packaging-bag-review rounded-md border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h6 className="text-base font-semibold">
          {isApproved ? "✓ " : ""}
          Bag {bagNumber}
        </h6>
        <p className="text-sm text-slate-600">
          {bagNumber} of {packages.length}
          {allocationIndex >= 0 ? ` · Source ${allocationIndex + 1}` : ""}
        </p>
      </div>
      <p className="text-xs text-slate-500">
        {recordedPackage.package_identifier}
      </p>

      {!label ? (
        <p className="mt-3 text-sm text-slate-600">
          No Package Label is recorded for this Package.
        </p>
      ) : (
        <>
          {isEditing ? (
            <PackageLabelEditor
              formatError={formatError}
              key={recordedPackage.id}
              label={label}
              onDirtyChange={(dirty) =>
                setMembership(setDirtyIds, recordedPackage.id, dirty)
              }
              onRefresh={() => onRefreshLabel(recordedPackage.id)}
              onSave={(body) => onSaveLabel(recordedPackage.id, body)}
              packageIdentifier={recordedPackage.package_identifier}
            />
          ) : (
            <BagLabelPreview label={label} recordedPackage={recordedPackage} />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!isEditing ? (
              <button
                className="secondary-action"
                type="button"
                onClick={() =>
                  setMembership(setEditingIds, recordedPackage.id, true)
                }
              >
                Edit
              </button>
            ) : null}
            <button
              className="primary-action"
              disabled={isDirty}
              type="button"
              onClick={() => {
                setMembership(setApprovedIds, recordedPackage.id, true);
                setCurrentIndex((index) => index + 1);
              }}
            >
              Approve and next
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            {currentIndex > 0 ? (
              <button
                className="quiet-action"
                type="button"
                onClick={() =>
                  setCurrentIndex((index) => Math.max(index - 1, 0))
                }
              >
                &larr; Bag {bagNumber - 1}
              </button>
            ) : (
              <span />
            )}
            <button
              className="quiet-action"
              type="button"
              onClick={() => setCurrentIndex(packages.length)}
            >
              Skip to summary
            </button>
            {currentIndex < packages.length - 1 ? (
              <button
                className="quiet-action"
                type="button"
                onClick={() =>
                  setCurrentIndex((index) =>
                    Math.min(index + 1, packages.length - 1),
                  )
                }
              >
                Bag {bagNumber + 1} &rarr;
              </button>
            ) : (
              <span />
            )}
          </div>
        </>
      )}
    </article>
  );
}

function BagLabelPreview({
  label,
  recordedPackage,
}: {
  label: PackageLabel;
  recordedPackage: Package;
}) {
  const summary =
    label.ingredients_summary ||
    label.preparation_summary ||
    label.description ||
    "No ingredients or preparation summary";
  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">
          Will print on the label
        </p>
        <div className="mt-1 rounded-md border border-slate-200 p-3">
          <p className="text-base font-semibold">{label.display_name}</p>
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
            {new Date(recordedPackage.packaged_at).toLocaleDateString()}
            {" · "}
            {recordedPackage.package_type?.name ?? "Package Type unavailable"}
            {" · Oxygen absorber: "}
            {recordedPackage.oxygen_absorber || "None"}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
            {recordedPackage.package_identifier}
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">
          Not on the label
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Storage:{" "}
          {recordedPackage.storage_location?.name ??
            "Storage Location unavailable"}
        </p>
      </div>
    </div>
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

      {label ? (
        editable ? (
          <PackageLabelEditor
            formatError={formatError}
            label={label}
            onRefresh={onRefreshLabel}
            onSave={onSaveLabel}
            packageIdentifier={recordedPackage.package_identifier}
          />
        ) : (
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
        )
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          No Package Label is recorded for this Package.
        </p>
      )}
    </article>
  );
}

function StageNavigation({
  backLabel,
  hideNext = false,
  nextDisabled = false,
  nextLabel,
  onBack,
  onNext,
}: {
  backLabel: string;
  hideNext?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <nav
      aria-label="Packaging stage navigation"
      className="packaging-stage-navigation"
    >
      <button className="quiet-action" type="button" onClick={onBack}>
        {backLabel}
      </button>
      {!hideNext && nextLabel ? (
        <button
          className="primary-action"
          disabled={nextDisabled}
          type="button"
          onClick={onNext}
        >
          {nextLabel}
        </button>
      ) : null}
    </nav>
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
    <details className="packaging-package-label-details mt-3 rounded-md bg-slate-100 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Package Label · {status}
      </summary>
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
    </details>
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

function PackagingReviewSummary({
  operation,
}: {
  operation: PackagingOperation;
}) {
  const sourceTrayCount = operation.allocations.reduce(
    (total, allocation) => total + allocation.source_trays.length,
    0,
  );
  const recordedPackages = operation.allocations.flatMap(
    (allocation) => allocation.packages,
  );

  return (
    <section aria-label="Packaging review summary" className="mb-5 space-y-3">
      <h5 className="text-sm font-semibold">Packaging review summary</h5>
      <dl className="grid gap-3 sm:grid-cols-3">
        <WorkspaceDetail label="Source Trays" value={String(sourceTrayCount)} />
        <WorkspaceDetail
          label="Product Sources"
          value={String(operation.allocations.length)}
        />
        <WorkspaceDetail
          label="Bags Saved"
          value={String(recordedPackages.length)}
        />
      </dl>
      {recordedPackages.length === 0 ? (
        <p className="text-sm text-slate-600">
          No Packages have been recorded for review yet.
        </p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {recordedPackages.map((recordedPackage) => (
            <li
              className="rounded-md border border-slate-200 p-3"
              key={recordedPackage.id}
            >
              <p className="font-semibold">
                Package {recordedPackage.package_identifier}
              </p>
              <p className="text-sm text-slate-700">
                {recordedPackage.package_type.name} · Finished Product Weight{" "}
                {recordedPackage.finished_product_weight_grams === null
                  ? "Unavailable"
                  : formatGrams(
                      String(recordedPackage.finished_product_weight_grams),
                    )}
                {" · "}Sealed Package Weight{" "}
                {formatGrams(String(recordedPackage.package_weight_grams))}
              </p>
              <p className="text-sm text-slate-600">
                {recordedPackage.storage_location.name} · Oxygen absorber{" "}
                {recordedPackage.oxygen_absorber || "Not recorded"} · Packaged{" "}
                <time dateTime={recordedPackage.packaged_at}>
                  {new Date(recordedPackage.packaged_at).toLocaleString()}
                </time>
              </p>
              {recordedPackage.notes ? (
                <p className="text-sm text-slate-600">
                  {recordedPackage.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
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

function createPackagingWorkflowSteps(
  visibleStage: PackagingStageId,
  authoritativeStage: PackagingStageId,
): WorkflowStep[] {
  const visiblePosition = getPackagingStagePosition(visibleStage);
  const authoritativePosition = getPackagingStagePosition(authoritativeStage);
  const definitions: Array<Pick<WorkflowStep, "id" | "label" | "summary">> = [
    { id: "source", label: "Choose a batch", summary: "Batch and Trays" },
    { id: "product", label: "Choose trays", summary: "Completed Trays" },
    {
      id: "packages",
      label: "Create packages",
      summary: "Weights and Packages",
    },
    { id: "review", label: "Review & labels", summary: "Labels and details" },
    { id: "finish", label: "Finish", summary: "Validate and complete" },
  ];

  return definitions.map((step, index) => ({
    ...step,
    status:
      index < visiblePosition
        ? "complete"
        : index === visiblePosition
          ? "current"
          : index <= authoritativePosition
            ? "available"
            : "upcoming",
  }));
}

function stageStatus(
  currentStage: PackagingStageId,
  stage: PackagingStageId,
): WorkflowStepStatus {
  const currentPosition = getPackagingStagePosition(currentStage);
  const stagePosition = getPackagingStagePosition(stage);
  if (stagePosition < currentPosition) return "complete";
  if (stagePosition === currentPosition) return "current";
  return "upcoming";
}
