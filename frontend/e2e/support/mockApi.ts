import type { Page } from "@playwright/test";

import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageLabelSelection,
  PackageLabelUpdate,
  PackageLineCreate,
  PackagingAllocation,
  PackagingAllocationCreateRequest,
  PackagingAllocationUpdateRequest,
  PackagingOperation,
  PackagingOperationComplete,
  PackagingOperationStart,
  PackageType,
  PackagingWorksheetItem,
  PhysicalTray,
  PlannedPackageInput,
  PrintablePackageLabel,
  ProductionBatch,
  RecordAllocationPackagesRequest,
  RecordPackagingLossRequest,
  StorageLocation,
  Tray,
  TraySlot,
  WeightCheck,
} from "../../src/api/client";
import {
  createAllocationSourceTray,
  createPackageLabel as createRefinedPackageLabel,
  createPackagingAllocation as createRefinedPackagingAllocation,
  createPackagingLoss,
  createPackagingOperation as createRefinedPackagingOperation,
  createPlannedPackageRow as createRefinedPlannedPackageRow,
  createPrintEvent as createRefinedPrintEvent,
  createRecordedPackage,
} from "./packagingScenarios";

const API_BASE = "http://127.0.0.1:8000/api/v1";

type PackageRequestBody = {
  tray_ids: string[];
  packages: Array<{
    package_type_id: string;
    finished_product_weight_grams: string;
    package_weight_grams: string;
    oxygen_absorber?: string | null;
    storage_location_id?: string | null;
    notes?: string | null;
  }>;
  packaged_at?: string | null;
  notes?: string | null;
};

type LegacyMockPackagingResult = {
  packaging_operation: {
    id: string;
    packaged_at: string;
    notes: string | null;
    trays: Tray[];
    packages: Package[];
  };
  packages: Package[];
  warnings: string[];
  source_weight_grams: string;
  package_weight_grams: string;
  labels: PrintablePackageLabel[];
};

type CreateProductionBatchBody = {
  freeze_dryer_id: string;
  batch_number: string;
  notes?: string | null;
};

type TraySetupBody = {
  tray_slot_id: string;
  physical_tray_id: string;
  product_name?: string | null;
  preparation?: string | null;
  starting_weight_grams?: string;
  notes?: string | null;
};

type WeightCheckBody = {
  drying_run_id: string;
  weight_grams: string;
  observed_at: string;
  notes?: string | null;
};

type WeightCheckCorrectionBody = {
  weight_grams: string;
  reason: string | null;
};

export type MockPackagingFailure = {
  method: string;
  path: string | RegExp;
  times?: number;
  status?: number;
  code?: string;
  message: string;
  errors?: unknown[];
};

export type MockPackagingRequest = {
  method: string;
  path: string;
  body: unknown;
};

export type MockApiState = {
  freezeDryers: FreezeDryer[];
  physicalTrays: PhysicalTray[];
  productionBatches: ProductionBatch[];
  packageTypes: PackageType[];
  storageLocations: StorageLocation[];
  packagingWorksheet: PackagingWorksheetItem[];
  packagingOperations: PackagingOperation[];
  legacyPackages: Package[];
  traysById: Map<string, Tray>;
  packagingReadRequests: Array<{ method: "GET"; path: string }>;
  packagingRequests: MockPackagingRequest[];
  packagingFailures: Array<MockPackagingFailure & { remaining: number }>;
  failNextPackagingRequest: (failure: MockPackagingFailure) => void;
  startPackagingBodies: Array<{
    batchId: string;
    body: PackagingOperationStart;
  }>;
  allocationCreateBodies: Array<{
    operationId: string;
    body: PackagingAllocationCreateRequest;
  }>;
  allocationUpdateBodies: Array<{
    operationId: string;
    allocationId: string;
    body: PackagingAllocationUpdateRequest;
  }>;
  packageRecordBodies: Array<{
    operationId: string;
    allocationId: string;
    body: RecordAllocationPackagesRequest;
  }>;
  packagingLossBodies: Array<{
    operationId: string;
    allocationId: string;
    body: RecordPackagingLossRequest;
  }>;
  packageLabelUpdateBodies: Array<{
    packageId: string;
    body: PackageLabelUpdate;
  }>;
  packageLabelPreviewBodies: PackageLabelSelection[];
  packageLabelPrintBodies: PackageLabelSelection[];
  packagingCompleteBodies: Array<{
    operationId: string;
    body: PackagingOperationComplete;
  }>;
  createdPackagingIds: {
    operationIds: string[];
    allocationIds: string[];
    plannedPackageRowIds: string[];
    packageIds: string[];
    packageLabelIds: string[];
    printEventIds: string[];
    packagingLossIds: string[];
  };
  packagingSequences: {
    operation: number;
    allocation: number;
    plannedPackage: number;
    package: number;
    packageLabel: number;
    printJob: number;
    printEvent: number;
    packagingLoss: number;
    timestamp: number;
  };
  createFreezeDryerBodies: Array<Record<string, unknown>>;
  updateFreezeDryerBodies: Array<{ id: string; body: Record<string, unknown> }>;
  createProductionBatchBodies: CreateProductionBatchBody[];
  addTrayBodies: Array<{ batchId: string; body: TraySetupBody }>;
  updateTrayBodies: Array<{ id: string; body: TraySetupBody }>;
  startProductionBatchIds: string[];
  completeDryingRunIds: string[];
  startDryingRunBodies: Array<{
    batchId: string;
    body?: { started_at?: string; notes?: string | null };
  }>;
  weightCheckBodies: Array<{ trayId: string; body: WeightCheckBody }>;
  weightCheckCorrectionBodies: Array<{
    weightCheckId: string;
    body: WeightCheckCorrectionBody;
  }>;
  completeTrayBodies: Array<{
    trayId: string;
    body: { final_dry_weight_grams: string };
  }>;
  completeProductionBatchIds: string[];
  packageBodies: PackageRequestBody[];
  packageLabels: PrintablePackageLabel[];
};

export type MockApiOptions = Partial<
  Pick<
    MockApiState,
    | "freezeDryers"
    | "physicalTrays"
    | "productionBatches"
    | "packageTypes"
    | "storageLocations"
    | "packagingWorksheet"
    | "packagingOperations"
  >
>;

export async function mockFreezeflowApi(
  page: Page,
  options: MockApiOptions = {},
) {
  const packagingWorksheet =
    options.packagingWorksheet ??
    (options.productionBatches ? [] : defaultPackagingWorksheet());
  const productionBatches =
    options.productionBatches ??
    packagingWorksheet.map((item) => item.production_batch);
  const useLegacyPackagingDefaults = options.productionBatches === undefined;
  const legacyPackage = createPackage(
    { finished_product_weight_grams: "232.466" },
    createPackageType(),
    createStorageLocation(),
  );
  const state: MockApiState = {
    freezeDryers: options.freezeDryers ?? [createFreezeDryer()],
    physicalTrays: options.physicalTrays ?? [createPhysicalTray()],
    productionBatches,
    packageTypes: options.packageTypes ?? [
      createPackageType(),
      createPackageType({
        id: "package-type-2",
        name: "Pint Jar",
        default_oxygen_absorber: "300cc",
      }),
    ],
    storageLocations: options.storageLocations ?? [
      createStorageLocation(),
      createStorageLocation({ id: "storage-pantry", name: "Pantry" }),
    ],
    packagingWorksheet,
    packagingOperations: options.packagingOperations ?? [],
    legacyPackages: [legacyPackage],
    traysById: new Map(),
    packagingReadRequests: [],
    packagingRequests: [],
    packagingFailures: [],
    failNextPackagingRequest(failure) {
      this.packagingFailures.push({
        ...failure,
        remaining: failure.times ?? 1,
      });
    },
    startPackagingBodies: [],
    allocationCreateBodies: [],
    allocationUpdateBodies: [],
    packageRecordBodies: [],
    packagingLossBodies: [],
    packageLabelUpdateBodies: [],
    packageLabelPreviewBodies: [],
    packageLabelPrintBodies: [],
    packagingCompleteBodies: [],
    createdPackagingIds: {
      operationIds: [],
      allocationIds: [],
      plannedPackageRowIds: [],
      packageIds: [],
      packageLabelIds: [],
      printEventIds: [],
      packagingLossIds: [],
    },
    packagingSequences: {
      operation: 0,
      allocation: 0,
      plannedPackage: 0,
      package: 0,
      packageLabel: 0,
      printJob: 0,
      printEvent: 0,
      packagingLoss: 0,
      timestamp: 0,
    },
    createFreezeDryerBodies: [],
    updateFreezeDryerBodies: [],
    createProductionBatchBodies: [],
    addTrayBodies: [],
    updateTrayBodies: [],
    startProductionBatchIds: [],
    completeDryingRunIds: [],
    startDryingRunBodies: [],
    weightCheckBodies: [],
    weightCheckCorrectionBodies: [],
    completeTrayBodies: [],
    completeProductionBatchIds: [],
    packageBodies: [],
    packageLabels: [packageLabelForPackage(legacyPackage, [createTray()])],
  };
  seedTrayLookup(state, useLegacyPackagingDefaults);

  // Tiny in-memory API: the browser makes real network calls, and each
  // mutation updates this state so later GETs behave like a small backend.
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace("/api/v1", "");

    let refinedPackagingBody: unknown;
    if (isRefinedPackagingRequest(method, path)) {
      refinedPackagingBody = request.postData()
        ? (request.postDataJSON() as unknown)
        : undefined;
      state.packagingRequests.push({
        method,
        path,
        body: refinedPackagingBody,
      });
      const failure = takePackagingFailure(state, method, path);
      if (failure) {
        return route.fulfill(
          structuredError(
            failure.status ?? 500,
            failure.code ?? "PACKAGING_REQUEST_FAILED",
            failure.message,
            failure.errors,
          ),
        );
      }
      const mutationResponse = handleRefinedPackagingMutation(
        state,
        method,
        path,
        refinedPackagingBody,
      );
      if (mutationResponse) return route.fulfill(mutationResponse);
    }

    if (method === "GET" && path === "/freeze-dryers") {
      return route.fulfill(json(state.freezeDryers));
    }

    if (method === "POST" && path === "/freeze-dryers") {
      const body = request.postDataJSON() as {
        name: string;
        notes: string | null;
        tray_slot_count: number;
      };
      state.createFreezeDryerBodies.push(body);
      const created = createFreezeDryer({
        id: `freeze-dryer-${state.freezeDryers.length + 1}`,
        name: body.name,
        notes: body.notes,
        tray_slot_count: body.tray_slot_count,
      });
      state.freezeDryers = [created, ...state.freezeDryers];
      return route.fulfill(json(created));
    }

    const freezeDryerPatch = path.match(/^\/freeze-dryers\/([^/]+)$/);
    if (method === "PATCH" && freezeDryerPatch) {
      const id = freezeDryerPatch[1];
      const body = request.postDataJSON() as Record<string, unknown>;
      state.updateFreezeDryerBodies.push({ id, body });
      const existing = state.freezeDryers.find(
        (candidate) => candidate.id === id,
      );

      if (!existing) return route.fulfill(notFound("Freeze Dryer not found"));

      Object.assign(existing, body);
      existing.tray_slots = traySlotsFor(
        existing.id,
        Number(existing.tray_slot_count),
      );
      return route.fulfill(json(existing));
    }

    if (method === "GET" && path === "/production-batches") {
      return route.fulfill(json(state.productionBatches));
    }

    if (method === "POST" && path === "/production-batches") {
      const body = request.postDataJSON() as CreateProductionBatchBody;
      state.createProductionBatchBodies.push(body);
      const freezeDryer =
        state.freezeDryers.find(
          (candidate) => candidate.id === body.freeze_dryer_id,
        ) ?? state.freezeDryers[0];
      const created = createProductionBatch({
        id: `batch-${state.productionBatches.length + 1}`,
        freeze_dryer_id: freezeDryer.id,
        freeze_dryer: freezeDryer,
        batch_number: body.batch_number,
        status: "Draft",
        started_at: null,
        completed_at: null,
        notes: body.notes ?? null,
        trays: [],
        drying_runs: [],
        total_drying_seconds: 0,
      });
      state.productionBatches = [created, ...state.productionBatches];
      return route.fulfill(json(created));
    }

    const productionBatchGet = path.match(/^\/production-batches\/([^/]+)$/);
    if (method === "GET" && productionBatchGet) {
      const batch = findBatch(state, productionBatchGet[1]);
      return route.fulfill(
        batch ? json(batch) : notFound("Production Batch not found"),
      );
    }

    if (method === "PATCH" && productionBatchGet) {
      const batch = findBatch(state, productionBatchGet[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));
      const body = request.postDataJSON() as {
        freeze_dryer_id?: string;
        notes?: string | null;
      };
      if (body.freeze_dryer_id) {
        const freezeDryer = state.freezeDryers.find(
          (candidate) => candidate.id === body.freeze_dryer_id,
        );
        if (freezeDryer) {
          batch.freeze_dryer_id = freezeDryer.id;
          batch.freeze_dryer = freezeDryer;
        }
      }
      if ("notes" in body) batch.notes = body.notes ?? null;
      return route.fulfill(json(batch));
    }

    const productionBatchStart = path.match(
      /^\/production-batches\/([^/]+)\/start$/,
    );
    if (method === "POST" && productionBatchStart) {
      const batch = findBatch(state, productionBatchStart[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));

      state.startProductionBatchIds.push(batch.id);
      const startedAt = "2026-07-08T01:00:00.000Z";
      batch.status = "Running";
      batch.started_at = startedAt;
      batch.trays = batch.trays.map((tray) =>
        updateTrayInLookup(state, {
          ...tray,
          status: "Running",
          latest_weight_grams: tray.starting_weight_grams,
          previous_weight_grams: null,
        }),
      );
      batch.drying_runs = [
        createDryingRun({
          id: `${batch.id}-drying-run-1`,
          production_batch_id: batch.id,
          started_at: startedAt,
        }),
      ];
      return route.fulfill(json(batch));
    }

    const productionBatchCancel = path.match(
      /^\/production-batches\/([^/]+)\/cancel$/,
    );
    if (method === "POST" && productionBatchCancel) {
      const batch = findBatch(state, productionBatchCancel[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));
      batch.status = "Cancelled";
      batch.trays = batch.trays.map((tray) =>
        updateTrayInLookup(state, { ...tray, status: "Cancelled" }),
      );
      return route.fulfill(json(batch));
    }

    const productionBatchComplete = path.match(
      /^\/production-batches\/([^/]+)\/complete$/,
    );
    if (method === "POST" && productionBatchComplete) {
      const batch = findBatch(state, productionBatchComplete[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));
      state.completeProductionBatchIds.push(batch.id);
      batch.status = "Completed";
      batch.completed_at = "2026-07-08T06:00:00.000Z";
      state.packagingWorksheet = [
        ...state.packagingWorksheet,
        {
          production_batch: batch,
          eligible_trays: batch.trays.filter(
            (tray) => tray.status === "Completed" && !tray.packaging,
          ),
          source_weight_grams: String(
            batch.trays.reduce(
              (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
              0,
            ),
          ),
        },
      ].filter((item) => item.eligible_trays.length > 0);
      return route.fulfill(json(batch));
    }

    const productionBatchDryingRuns = path.match(
      /^\/production-batches\/([^/]+)\/drying-runs$/,
    );
    if (method === "POST" && productionBatchDryingRuns) {
      const batch = findBatch(state, productionBatchDryingRuns[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));
      const body = request.postDataJSON() as
        | { started_at?: string; notes?: string | null }
        | undefined;
      state.startDryingRunBodies.push({ batchId: batch.id, body });
      const run = createDryingRun({
        id: `${batch.id}-drying-run-${batch.drying_runs.length + 1}`,
        production_batch_id: batch.id,
        started_at: body?.started_at ?? "2026-07-08T03:00:00.000Z",
        notes: body?.notes ?? null,
      });
      batch.drying_runs = [...batch.drying_runs, run];
      return route.fulfill(json(run));
    }

    const productionBatchAddTray = path.match(
      /^\/production-batches\/([^/]+)\/trays$/,
    );
    if (method === "POST" && productionBatchAddTray) {
      const batch = findBatch(state, productionBatchAddTray[1]);
      if (!batch) return route.fulfill(notFound("Production Batch not found"));
      const body = request.postDataJSON() as TraySetupBody;
      state.addTrayBodies.push({ batchId: batch.id, body });
      const tray = createTrayFromSetup(state, batch, body);
      batch.trays = [...batch.trays, tray];
      state.traysById.set(tray.id, tray);
      return route.fulfill(json(tray));
    }

    if (method === "GET" && path === "/physical-trays") {
      return route.fulfill(json(state.physicalTrays));
    }

    if (method === "GET" && path === "/packaging/worksheet") {
      recordPackagingRead(state, path);
      return route.fulfill(json(authoritativePackagingWorksheet(state)));
    }

    if (method === "GET" && path === "/package-types") {
      recordPackagingRead(state, path);
      return route.fulfill(json(state.packageTypes));
    }

    if (method === "GET" && path === "/storage-locations") {
      recordPackagingRead(state, path);
      return route.fulfill(json(state.storageLocations));
    }

    const operationForBatch = path.match(
      /^\/production-batches\/([^/]+)\/packaging-operation$/,
    );
    if (method === "GET" && operationForBatch) {
      recordPackagingRead(state, path);
      const operation = state.packagingOperations
        .filter(
          (candidate) => candidate.production_batch_id === operationForBatch[1],
        )
        .sort((left, right) =>
          right.started_at.localeCompare(left.started_at),
        )[0];
      return route.fulfill(
        operation
          ? json(operation)
          : notFound("Packaging Operation does not exist."),
      );
    }

    const packagingOperationGet = path.match(
      /^\/packaging-operations\/([^/]+)$/,
    );
    if (method === "GET" && packagingOperationGet) {
      recordPackagingRead(state, path);
      const operation = state.packagingOperations.find(
        (candidate) => candidate.id === packagingOperationGet[1],
      );
      return route.fulfill(
        operation
          ? json(operation)
          : notFound("Packaging Operation does not exist."),
      );
    }

    const packageGet = path.match(/^\/packages\/([^/]+)$/);
    if (method === "GET" && packageGet) {
      recordPackagingRead(state, path);
      const recordedPackage = packagesInOperations(state).find(
        (candidate) => candidate.id === packageGet[1],
      );
      return route.fulfill(
        recordedPackage ? json(recordedPackage) : notFound("Package not found"),
      );
    }

    const packageLabelGet = path.match(/^\/packages\/([^/]+)\/label$/);
    if (method === "GET" && packageLabelGet) {
      recordPackagingRead(state, path);
      const recordedPackage = packagesInOperations(state).find(
        (candidate) => candidate.id === packageLabelGet[1],
      );
      return route.fulfill(
        recordedPackage
          ? json(recordedPackage.label)
          : notFound("Package Label not found"),
      );
    }

    if (method === "POST" && path === "/packages") {
      const body = request.postDataJSON() as PackageRequestBody;
      state.packageBodies.push(body);
      const result = createPackagingResult(state, body);
      state.packageLabels = [...state.packageLabels, ...result.labels];
      result.packaging_operation.trays.forEach((tray) =>
        state.traysById.set(tray.id, tray),
      );
      state.packagingWorksheet = state.packagingWorksheet
        .map((item) => ({
          ...item,
          eligible_trays: item.eligible_trays.filter(
            (tray) => !body.tray_ids.includes(tray.id),
          ),
        }))
        .filter((item) => item.eligible_trays.length > 0);
      return route.fulfill(json(result));
    }

    if (method === "POST" && path === "/packages/labels") {
      const body = request.postDataJSON() as { package_ids: string[] };
      return route.fulfill(
        json(
          state.packageLabels.filter((label) =>
            body.package_ids.includes(label.package_id),
          ),
        ),
      );
    }

    const trayGet = path.match(/^\/trays\/([^/]+)$/);
    if (method === "GET" && trayGet) {
      const tray = state.traysById.get(trayGet[1]);
      return route.fulfill(tray ? json(tray) : notFound("Tray not found"));
    }

    if (method === "PATCH" && trayGet) {
      const existing = state.traysById.get(trayGet[1]);
      if (!existing) return route.fulfill(notFound("Tray not found"));
      const body = request.postDataJSON() as TraySetupBody;
      state.updateTrayBodies.push({ id: existing.id, body });
      const batch = findBatch(state, existing.production_batch_id);
      const updated = applyTraySetup(state, existing, body);
      updateTrayInBatchAndLookup(state, batch, updated);
      return route.fulfill(json(updated));
    }

    if (method === "DELETE" && trayGet) {
      const existing = state.traysById.get(trayGet[1]);
      if (!existing) return route.fulfill(notFound("Tray not found"));
      const batch = findBatch(state, existing.production_batch_id);
      if (batch) {
        batch.trays = batch.trays.filter((tray) => tray.id !== existing.id);
      }
      state.traysById.delete(existing.id);
      return route.fulfill(json({}));
    }

    const trayStartingWeight = path.match(
      /^\/trays\/([^/]+)\/starting-weight$/,
    );
    if (method === "POST" && trayStartingWeight) {
      const existing = state.traysById.get(trayStartingWeight[1]);
      if (!existing) return route.fulfill(notFound("Tray not found"));
      const body = request.postDataJSON() as { starting_weight_grams: string };
      const updated = updateTrayInLookup(state, {
        ...existing,
        starting_weight_grams: body.starting_weight_grams,
        latest_weight_grams:
          existing.weight_checks.length === 0
            ? body.starting_weight_grams
            : existing.latest_weight_grams,
      });
      updateTrayInBatchAndLookup(
        state,
        findBatch(state, updated.production_batch_id),
        updated,
      );
      return route.fulfill(json(updated));
    }

    const dryingRunComplete = path.match(/^\/drying-runs\/([^/]+)\/complete$/);
    if (method === "POST" && dryingRunComplete) {
      const match = findDryingRun(state, dryingRunComplete[1]);
      if (!match) return route.fulfill(notFound("Drying Run not found"));
      state.completeDryingRunIds.push(match.run.id);
      const updated = {
        ...match.run,
        status: "Complete" as const,
        ended_at: "2026-07-08T02:30:00.000Z",
        duration_seconds: 5_400,
        updated_at: "2026-07-08T02:30:00.000Z",
      };
      match.batch.drying_runs = match.batch.drying_runs.map((run) =>
        run.id === updated.id ? updated : run,
      );
      match.batch.total_drying_seconds = match.batch.drying_runs
        .filter((run) => run.status === "Complete")
        .reduce((total, run) => total + (run.duration_seconds ?? 0), 0);
      return route.fulfill(json(updated));
    }

    const trayWeightChecks = path.match(/^\/trays\/([^/]+)\/weight-checks$/);
    if (method === "POST" && trayWeightChecks) {
      const existing = state.traysById.get(trayWeightChecks[1]);
      if (!existing) return route.fulfill(notFound("Tray not found"));
      const body = request.postDataJSON() as WeightCheckBody;
      state.weightCheckBodies.push({ trayId: existing.id, body });
      const weightCheck = createWeightCheck({
        id: `${existing.id}-weight-check-${existing.weight_checks.length + 1}`,
        tray_id: existing.id,
        drying_run_id: body.drying_run_id,
        weight_grams: body.weight_grams,
        observed_at: body.observed_at,
        notes: body.notes ?? null,
      });
      const updated = updateTrayInLookup(state, {
        ...existing,
        weight_checks: [...existing.weight_checks, weightCheck],
        previous_weight_grams: existing.latest_weight_grams,
        latest_weight_grams: body.weight_grams,
      });
      updateTrayInBatchAndLookup(
        state,
        findBatch(state, updated.production_batch_id),
        updated,
      );
      return route.fulfill(json(weightCheck));
    }

    const weightCheckCorrection = path.match(
      /^\/weight-checks\/([^/]+)\/correct$/,
    );
    if (method === "POST" && weightCheckCorrection) {
      const body = request.postDataJSON() as WeightCheckCorrectionBody;
      state.weightCheckCorrectionBodies.push({
        weightCheckId: weightCheckCorrection[1],
        body,
      });
      for (const tray of state.traysById.values()) {
        const checkIndex = tray.weight_checks.findIndex(
          (check) => check.id === weightCheckCorrection[1],
        );
        if (checkIndex === -1) continue;
        const corrected = {
          ...tray.weight_checks[checkIndex],
          weight_grams: body.weight_grams,
        };
        const weightChecks = [...tray.weight_checks];
        weightChecks[checkIndex] = corrected;
        const updated = updateTrayInLookup(state, {
          ...tray,
          weight_checks: weightChecks,
          latest_weight_grams:
            checkIndex === weightChecks.length - 1
              ? body.weight_grams
              : tray.latest_weight_grams,
        });
        updateTrayInBatchAndLookup(
          state,
          findBatch(state, updated.production_batch_id),
          updated,
        );
        return route.fulfill(json(corrected));
      }
      return route.fulfill(notFound("Weight Check not found"));
    }

    const trayComplete = path.match(/^\/trays\/([^/]+)\/complete$/);
    if (method === "POST" && trayComplete) {
      const existing = state.traysById.get(trayComplete[1]);
      if (!existing) return route.fulfill(notFound("Tray not found"));
      const body = request.postDataJSON() as { final_dry_weight_grams: string };
      state.completeTrayBodies.push({ trayId: existing.id, body });
      const updated = updateTrayInLookup(state, {
        ...existing,
        status: "Completed",
        final_dry_weight_grams: body.final_dry_weight_grams,
        latest_weight_grams: body.final_dry_weight_grams,
        completed_at: "2026-07-08T05:00:00.000Z",
      });
      updateTrayInBatchAndLookup(
        state,
        findBatch(state, updated.production_batch_id),
        updated,
      );
      return route.fulfill(json(updated));
    }

    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        detail: `Unhandled E2E request: ${method} ${path}`,
      }),
    });
  });

  return state;
}

export function defaultPackagingWorksheet(): PackagingWorksheetItem[] {
  const black = createFreezeDryer({ notes: null });
  const white = createFreezeDryer({
    id: "freeze-dryer-2",
    name: "white",
    notes: null,
  });
  const tacoTray = createTray({
    id: "tray-1",
    product_name: "Taco Chicken",
    preparation: "cubed, seasoned",
    final_dry_weight_grams: "238.1",
    tray_slot: black.tray_slots[0],
  });
  const applesTray = createTray({
    id: "tray-2",
    physical_tray_id: "physical-tray-2",
    product_name: "Apples",
    preparation: "sliced",
    final_dry_weight_grams: "185.0",
    tray_slot: black.tray_slots[1],
  });
  const skittlesTray = createTray({
    id: "tray-3",
    production_batch_id: "batch-2",
    physical_tray_id: "physical-tray-3",
    product_name: "Skittles",
    preparation: "whole",
    final_dry_weight_grams: "300.0",
    tray_slot: white.tray_slots[0],
  });

  return [
    {
      production_batch: createProductionBatch({
        freeze_dryer: black,
        trays: [
          tacoTray,
          applesTray,
          createTray({
            id: "tray-packaged",
            product_name: "Previously Packaged Pears",
            status: "Packaged",
            tray_slot: black.tray_slots[2],
          }),
        ],
      }),
      eligible_trays: [tacoTray, applesTray],
      source_weight_grams: "423.1",
    },
    {
      production_batch: createProductionBatch({
        id: "batch-2",
        freeze_dryer_id: white.id,
        freeze_dryer: white,
        batch_number: "Batch 006",
        trays: [skittlesTray],
      }),
      eligible_trays: [skittlesTray],
      source_weight_grams: "300.0",
    },
  ];
}

export function createFreezeDryer(
  overrides: Partial<FreezeDryer> = {},
): FreezeDryer {
  const traySlotCount = overrides.tray_slot_count ?? 4;
  const id = overrides.id ?? "freeze-dryer-1";
  return {
    id,
    name: "black",
    notes: "works well",
    archived: false,
    tray_slot_count: traySlotCount,
    tray_slots: traySlotsFor(id, traySlotCount),
    ...overrides,
  };
}

export function createPhysicalTray(
  overrides: Partial<PhysicalTray> = {},
): PhysicalTray {
  return {
    id: "physical-tray-1",
    label: "Tray 1",
    tare_weight_grams: "68.039",
    notes: "standard tray",
    archived: false,
    ...overrides,
  };
}

export function createProductionBatch(
  overrides: Partial<ProductionBatch> = {},
): ProductionBatch {
  const freezeDryer = overrides.freeze_dryer ?? createFreezeDryer();
  return {
    id: "batch-1",
    freeze_dryer_id: freezeDryer.id,
    freeze_dryer: freezeDryer,
    batch_number: "Batch 005",
    status: "Completed",
    started_at: "2026-07-07T18:00:00.000Z",
    completed_at: "2026-07-08T00:45:00.000Z",
    notes: "testing packaging flow",
    trays: [],
    drying_runs: [],
    total_drying_seconds: 24_300,
    ...overrides,
  };
}

export function createDryingRun(
  overrides: Partial<ProductionBatch["drying_runs"][number]> = {},
): ProductionBatch["drying_runs"][number] {
  return {
    id: "drying-run-1",
    production_batch_id: "batch-1",
    status: "Active",
    started_at: "2026-07-08T01:00:00.000Z",
    ended_at: null,
    notes: null,
    created_at: "2026-07-08T01:00:00.000Z",
    updated_at: "2026-07-08T01:00:00.000Z",
    duration_seconds: null,
    ...overrides,
  };
}

export function createTray(overrides: Partial<Tray> = {}): Tray {
  const freezeDryer = createFreezeDryer({ notes: null });
  const traySlot = overrides.tray_slot ?? freezeDryer.tray_slots[0];
  const physicalTrayId = overrides.physical_tray_id ?? "physical-tray-1";
  return {
    id: "tray-1",
    production_batch_id: "batch-1",
    tray_slot_id: traySlot.id,
    tray_slot: traySlot,
    physical_tray_id: physicalTrayId,
    physical_tray: createPhysicalTray({
      id: physicalTrayId,
      label: physicalTrayId.replace("physical-", "Imported "),
      tare_weight_grams: null,
      notes: null,
    }),
    recipe_id: null,
    recipe_name: null,
    product_name: "Taco Chicken",
    preparation: "cubed, seasoned",
    starting_weight_grams: "929.9",
    final_dry_weight_grams: "238.1",
    completed_at: "2026-07-08T00:45:00.000Z",
    notes: null,
    status: "Completed",
    weight_checks: [],
    latest_weight_grams: "238.1",
    previous_weight_grams: "246.6",
    packaging: null,
    ...overrides,
  };
}

export function createWeightCheck(
  overrides: Partial<WeightCheck> = {},
): WeightCheck {
  return {
    id: "weight-check-1",
    tray_id: "tray-1",
    drying_run_id: "drying-run-1",
    weight_grams: "238.1",
    observed_at: "2026-07-08T02:35:00.000Z",
    recorded_at: "2026-07-08T02:35:00.000Z",
    notes: null,
    ...overrides,
  };
}

export function createPackagedTray(overrides: Partial<Tray> = {}): Tray {
  return createTray({
    packaging: {
      packaging_operation_id: "packaging-operation-1",
      packaging_allocation_id: "packaging-allocation-1",
      packaging_operation_status: "Completed",
      started_at: "2026-07-08T00:55:00.000Z",
      completed_at: "2026-07-08T01:00:00.000Z",
      batch_number: "Batch 005",
      freeze_dryer: "black",
      packages: [
        {
          id: "package-1",
          package_identifier: "PKG-2026-000001",
          package_type: "Quart Mylar",
          finished_product_weight_grams: "232.466",
          package_weight_grams: "246.641",
          oxygen_absorber: "500cc",
          storage_location: "Unassigned",
          status: "In Storage",
          notes: null,
        },
      ],
    },
    ...overrides,
    status: "Packaged",
  });
}

export function createPackageType(
  overrides: Partial<PackageType> = {},
): PackageType {
  return {
    id: "package-type-1",
    name: "Quart Mylar",
    default_oxygen_absorber: "500cc",
    default_label_template: "avery-5163",
    notes: null,
    archived: false,
    ...overrides,
  };
}

export function createStorageLocation(
  overrides: Partial<StorageLocation> = {},
): StorageLocation {
  return {
    id: "storage-unassigned",
    name: "Unassigned",
    notes: null,
    archived: false,
    ...overrides,
  };
}

function createPackage(
  overrides: Partial<Package>,
  packageType: PackageType,
  storageLocation: StorageLocation,
): Package {
  return {
    id: "package-1",
    packaging_allocation_id: "packaging-allocation-1",
    packaging_operation_id: "packaging-operation-1",
    package_type_id: packageType.id,
    package_type: packageType,
    package_identifier: "PKG-2026-000001",
    packaged_at: "2026-07-08T01:00:00.000Z",
    finished_product_weight_grams: "232.466",
    package_weight_grams: "246.641",
    oxygen_absorber: "500cc",
    storage_location_id: storageLocation.id,
    storage_location: storageLocation,
    status: "In Storage",
    notes: null,
    label: createRefinedPackageLabel({
      id: "package-label-1",
      package_id: "package-1",
      status: "Ready",
    }),
    ...overrides,
  };
}

function createPackagingResult(
  state: MockApiState,
  body: PackageRequestBody,
): LegacyMockPackagingResult {
  const selectedTrays = state.packagingWorksheet.flatMap((item) =>
    item.eligible_trays.filter((tray) => body.tray_ids.includes(tray.id)),
  );
  const packages = body.packages.map((line, index) => {
    const packageType =
      state.packageTypes.find((type) => type.id === line.package_type_id) ??
      state.packageTypes[0];
    const storageLocation =
      state.storageLocations.find(
        (location) => location.id === line.storage_location_id,
      ) ?? state.storageLocations[0];

    return createPackage(
      {
        id: `package-${index + 1}`,
        package_type_id: packageType.id,
        package_type: packageType,
        package_identifier: `PKG-2026-${String(index + 1).padStart(6, "0")}`,
        finished_product_weight_grams: line.finished_product_weight_grams,
        package_weight_grams: line.package_weight_grams,
        oxygen_absorber:
          line.oxygen_absorber ?? packageType.default_oxygen_absorber,
        storage_location_id: storageLocation.id,
        storage_location: storageLocation,
        notes: line.notes ?? null,
      },
      packageType,
      storageLocation,
    );
  });
  const sourceWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const packageWeight = packages.reduce(
    (total, packageItem) => total + Number(packageItem.package_weight_grams),
    0,
  );

  return {
    packaging_operation: {
      id: "packaging-operation-1",
      packaged_at: body.packaged_at ?? "2026-07-08T01:00:00.000Z",
      notes: body.notes ?? null,
      trays: selectedTrays.map((tray) =>
        createPackagedTray({
          ...tray,
          packaging: {
            packaging_operation_id: "packaging-operation-1",
            packaging_allocation_id: "packaging-allocation-1",
            packaging_operation_status: "Completed",
            started_at: "2026-07-08T00:55:00.000Z",
            completed_at: body.packaged_at ?? "2026-07-08T01:00:00.000Z",
            batch_number: "Batch 005",
            freeze_dryer:
              tray.production_batch_id === "batch-2" ? "white" : "black",
            packages: packages.map((packageItem) => ({
              id: packageItem.id,
              package_identifier: packageItem.package_identifier,
              package_type: packageItem.package_type.name,
              finished_product_weight_grams:
                packageItem.finished_product_weight_grams === null
                  ? null
                  : String(packageItem.finished_product_weight_grams),
              package_weight_grams: String(packageItem.package_weight_grams),
              oxygen_absorber: packageItem.oxygen_absorber,
              storage_location: packageItem.storage_location.name,
              status: packageItem.status,
              notes: packageItem.notes,
            })),
          },
        }),
      ),
      packages,
    },
    packages,
    warnings:
      sourceWeight === packageWeight
        ? []
        : [
            `Package weights differ from the selected Tray Final Dry Weight total by ${(
              packageWeight - sourceWeight
            ).toFixed(3)} g.`,
          ],
    source_weight_grams: String(sourceWeight),
    package_weight_grams: String(packageWeight),
    labels: packages.map((packageItem) =>
      packageLabelForPackage(packageItem, selectedTrays),
    ),
  };
}

function packageLabelForPackage(
  packageItem: Package,
  selectedTrays: Tray[],
): PrintablePackageLabel {
  const firstTray = selectedTrays[0];
  const totalStartingWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.starting_weight_grams ?? 0),
    0,
  );
  const totalFinalDryWeight = selectedTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
    0,
  );
  const finishedProductWeight = Number(
    packageItem.finished_product_weight_grams,
  );
  const freshEquivalent =
    totalStartingWeight > 0 &&
    totalFinalDryWeight > 0 &&
    finishedProductWeight > 0
      ? (totalStartingWeight * finishedProductWeight) / totalFinalDryWeight
      : null;
  return {
    package_id: packageItem.id,
    package_identifier: packageItem.package_identifier,
    batch_number: "Batch 005",
    freeze_dryer:
      firstTray?.production_batch_id === "batch-2" ? "white" : "black",
    product_summary: selectedTrays
      .map((tray) => tray.product_name)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + "),
    preparation_summary: selectedTrays
      .map((tray) => tray.preparation)
      .filter((value): value is string => Boolean(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(" + "),
    package_type: packageItem.package_type.name,
    finished_product_weight_grams:
      packageItem.finished_product_weight_grams === null
        ? null
        : String(packageItem.finished_product_weight_grams),
    fresh_equivalent_grams:
      freshEquivalent === null ? null : String(freshEquivalent),
    package_weight_grams: String(packageItem.package_weight_grams),
    oxygen_absorber: packageItem.oxygen_absorber,
    packaged_at: "2026-07-08T01:00:00.000Z",
    label_template: packageItem.package_type.default_label_template,
    storage_location: packageItem.storage_location.name,
    notes: packageItem.notes,
  };
}

function recordPackagingRead(state: MockApiState, path: string) {
  state.packagingReadRequests.push({ method: "GET", path });
}

function packagesInOperations(state: MockApiState) {
  const packages = [
    ...state.legacyPackages,
    ...state.packagingOperations.flatMap((operation) => [
      ...operation.packages,
      ...operation.allocations.flatMap((allocation) => allocation.packages),
    ]),
  ];
  return Array.from(
    new Map(
      packages.map((recordedPackage) => [recordedPackage.id, recordedPackage]),
    ).values(),
  );
}

function authoritativePackagingWorksheet(
  state: MockApiState,
): PackagingWorksheetItem[] {
  const allocatedTrayIds = new Set(
    state.packagingOperations.flatMap((operation) =>
      operation.allocations.flatMap((allocation) =>
        allocation.source_trays.map((tray) => tray.id),
      ),
    ),
  );
  return state.productionBatches.flatMap((batch) => {
    const eligibleTrays = batch.trays.filter(
      (tray) =>
        tray.status === "Completed" &&
        tray.packaging === null &&
        !allocatedTrayIds.has(tray.id),
    );
    if (eligibleTrays.length === 0) return [];
    return [
      {
        production_batch: batch,
        eligible_trays: eligibleTrays,
        source_weight_grams: String(
          eligibleTrays.reduce(
            (total, tray) => total + Number(tray.final_dry_weight_grams ?? 0),
            0,
          ),
        ),
      },
    ];
  });
}

function isRefinedPackagingRequest(method: string, path: string) {
  if (path === "/packaging/worksheet") return true;
  if (/^\/production-batches\/[^/]+\/packaging-operation$/.test(path)) {
    return true;
  }
  if (path.startsWith("/packaging-operations/")) return true;
  if (/^\/packages\/[^/]+(?:\/label)?$/.test(path)) return true;
  if (path === "/package-labels/preview" || path === "/package-labels/print") {
    return true;
  }
  return (
    method === "GET" &&
    (path === "/package-types" || path === "/storage-locations")
  );
}

function takePackagingFailure(
  state: MockApiState,
  method: string,
  path: string,
) {
  const failure = state.packagingFailures.find((candidate) => {
    if (candidate.remaining <= 0 || candidate.method !== method) return false;
    if (typeof candidate.path === "string") return candidate.path === path;
    candidate.path.lastIndex = 0;
    return candidate.path.test(path);
  });
  if (!failure) return null;
  failure.remaining -= 1;
  return failure;
}

function handleRefinedPackagingMutation(
  state: MockApiState,
  method: string,
  path: string,
  requestBody: unknown,
) {
  if (method === "GET") return null;

  const startMatch = path.match(
    /^\/production-batches\/([^/]+)\/packaging-operation$/,
  );
  if (method === "POST" && startMatch) {
    const body = (requestBody ?? {}) as PackagingOperationStart;
    state.startPackagingBodies.push({ batchId: startMatch[1], body });
    const batch = state.productionBatches.find(
      (candidate) => candidate.id === startMatch[1],
    );
    if (!batch) {
      return structuredError(
        404,
        "PRODUCTION_BATCH_NOT_FOUND",
        "Production Batch does not exist.",
      );
    }
    if (batch.status !== "Completed") {
      return businessRuleError(
        "Only a Completed Production Batch may be packaged.",
      );
    }
    const existing = state.packagingOperations.find(
      (candidate) =>
        candidate.production_batch_id === batch.id &&
        candidate.status === "Open",
    );
    if (existing) return json(existing, 201);

    const id = nextPackagingId(state, "operation");
    const timestamp = body.started_at ?? nextPackagingTimestamp(state);
    const operation = createRefinedPackagingOperation({
      id,
      production_batch_id: batch.id,
      status: "Open",
      started_at: timestamp,
      completed_at: null,
      notes: cleanOptionalText(body.notes),
      created_at: timestamp,
      updated_at: timestamp,
      allocations: [],
      packages: [],
    });
    state.packagingOperations.push(operation);
    state.createdPackagingIds.operationIds.push(id);
    return json(operation, 201);
  }

  const allocateMatch = path.match(
    /^\/packaging-operations\/([^/]+)\/allocate-trays$/,
  );
  if (method === "POST" && allocateMatch) {
    const body = (requestBody ?? {}) as PackagingAllocationCreateRequest;
    state.allocationCreateBodies.push({
      operationId: allocateMatch[1],
      body,
    });
    const operation = state.packagingOperations.find(
      (candidate) => candidate.id === allocateMatch[1],
    );
    const openError = requireOpenOperation(operation);
    if (openError) return openError;
    const selected = selectAllocationTrays(state, operation!, body.tray_ids);
    if ("error" in selected) return selected.error;

    const id = nextPackagingId(state, "allocation");
    const timestamp = nextPackagingTimestamp(state);
    const allocation = createRefinedPackagingAllocation({
      id,
      packaging_operation_id: operation!.id,
      notes: cleanOptionalText(body.notes),
      created_at: timestamp,
      updated_at: timestamp,
      source_trays: selected.trays.map(toAllocationSourceTray),
      planned_packages: [],
      packages: [],
    });
    operation!.allocations.push(allocation);
    operation!.updated_at = timestamp;
    state.createdPackagingIds.allocationIds.push(id);
    return json(allocation, 201);
  }

  const allocationMatch = path.match(
    /^\/packaging-operations\/([^/]+)\/allocations\/([^/]+)$/,
  );
  if (method === "PATCH" && allocationMatch) {
    const body = (requestBody ?? {}) as PackagingAllocationUpdateRequest;
    state.allocationUpdateBodies.push({
      operationId: allocationMatch[1],
      allocationId: allocationMatch[2],
      body,
    });
    const result = findOpenAllocation(
      state,
      allocationMatch[1],
      allocationMatch[2],
    );
    if ("error" in result) return result.error;
    const { operation, allocation } = result;

    let sourceTrays = allocation.source_trays;
    if (body.tray_ids !== undefined) {
      if (
        allocation.packages.length > 0 ||
        allocation.planned_packages.length > 0
      ) {
        return businessRuleError(
          "Source Trays cannot change after package planning begins.",
        );
      }
      const selected = selectAllocationTrays(
        state,
        operation,
        body.tray_ids,
        allocation.id,
      );
      if ("error" in selected) return selected.error;
      sourceTrays = selected.trays.map(toAllocationSourceTray);
    }

    const identityCheckpoint = packagingIdentityCheckpoint(state);
    const plannedResult = reconcilePlannedPackages(
      state,
      allocation,
      body.planned_packages,
    );
    if ("error" in plannedResult) {
      restorePackagingIdentityCheckpoint(state, identityCheckpoint);
      return plannedResult.error;
    }
    const timestamp = nextPackagingTimestamp(state);
    const candidate: PackagingAllocation = {
      ...allocation,
      notes:
        body.notes === undefined
          ? allocation.notes
          : cleanOptionalText(body.notes),
      source_trays: sourceTrays,
      planned_packages: plannedResult.rows,
      updated_at: timestamp,
    };
    recalculateAllocation(candidate);
    if (Number(candidate.remaining_weight_grams) < -0.001) {
      restorePackagingIdentityCheckpoint(state, identityCheckpoint);
      return businessRuleError(
        "Planned Packages cannot exceed the selected product weight.",
        "PACKAGING_OVERALLOCATED",
      );
    }
    replaceAllocation(operation, candidate);
    operation.updated_at = timestamp;
    return json(candidate);
  }

  const recordMatch = path.match(
    /^\/packaging-operations\/([^/]+)\/allocations\/([^/]+)\/packages$/,
  );
  if (method === "POST" && recordMatch) {
    const body = (requestBody ?? {}) as RecordAllocationPackagesRequest;
    state.packageRecordBodies.push({
      operationId: recordMatch[1],
      allocationId: recordMatch[2],
      body,
    });
    const result = findOpenAllocation(state, recordMatch[1], recordMatch[2]);
    if ("error" in result) return result.error;
    const { operation, allocation } = result;
    const resolved = resolvePackageLines(state, allocation, body.packages);
    if ("error" in resolved) return resolved.error;

    const projectedWeight =
      recordedFinishedProductWeight(allocation) +
      unrecordedPlannedWeight(
        allocation.planned_packages.filter(
          (row) => !resolved.plannedRowIds.has(row.id),
        ),
      ) +
      resolved.lines.reduce(
        (total, line) => total + Number(line.finishedProductWeight),
        0,
      );
    if (projectedWeight - Number(allocation.selected_weight_grams) > 0.001) {
      return businessRuleError(
        "Packages cannot exceed the selected product weight.",
        "PACKAGING_OVERALLOCATED",
      );
    }

    const createdPackages = resolved.lines.map((line) => {
      const packageId = nextPackagingId(state, "package");
      const labelId = nextPackagingId(state, "packageLabel");
      const timestamp = line.packagedAt ?? nextPackagingTimestamp(state);
      const label = createRefinedPackageLabel({
        id: labelId,
        package_id: packageId,
        status: "Draft",
        display_name: line.label.display_name,
        description: line.label.description,
        ingredients_summary: line.label.ingredients_summary,
        preparation_summary: line.label.preparation_summary,
        rehydration_instructions: line.label.rehydration_instructions,
        serving_notes: line.label.serving_notes,
        net_weight_display: line.label.net_weight_display,
        fresh_equivalent_display: line.label.fresh_equivalent_display,
        created_at: timestamp,
        updated_at: timestamp,
        print_events: [],
      });
      const recordedPackage = createRecordedPackage({
        id: packageId,
        packaging_allocation_id: allocation.id,
        packaging_operation_id: operation.id,
        package_type_id: line.packageType.id,
        package_type: line.packageType,
        package_identifier: `PKG-2026-${String(
          state.packagingSequences.package,
        ).padStart(6, "0")}`,
        packaged_at: timestamp,
        package_weight_grams: line.sealedPackageWeight,
        finished_product_weight_grams: line.finishedProductWeight,
        oxygen_absorber: line.oxygenAbsorber,
        storage_location_id: line.storageLocation.id,
        storage_location: line.storageLocation,
        status: "In Storage",
        notes: line.notes,
        label,
      });
      state.createdPackagingIds.packageIds.push(packageId);
      state.createdPackagingIds.packageLabelIds.push(labelId);
      return recordedPackage;
    });

    const packageByPlanId = new Map(
      resolved.lines.flatMap((line, index) =>
        line.plannedRow
          ? [[line.plannedRow.id, createdPackages[index].id] as const]
          : [],
      ),
    );
    allocation.planned_packages = allocation.planned_packages.map((row) =>
      packageByPlanId.has(row.id)
        ? { ...row, recorded_package_id: packageByPlanId.get(row.id)! }
        : row,
    );
    allocation.packages.push(...createdPackages);
    recalculateAllocation(allocation);
    const updatedAt = nextPackagingTimestamp(state);
    allocation.updated_at = updatedAt;
    operation.updated_at = updatedAt;
    syncOperationPackages(operation);
    return json(
      { packages: createdPackages, packaging_operation: operation },
      201,
    );
  }

  const lossMatch = path.match(
    /^\/packaging-operations\/([^/]+)\/allocations\/([^/]+)\/losses$/,
  );
  if (method === "POST" && lossMatch) {
    const body = (requestBody ?? {}) as RecordPackagingLossRequest;
    state.packagingLossBodies.push({
      operationId: lossMatch[1],
      allocationId: lossMatch[2],
      body,
    });
    const result = findOpenAllocation(state, lossMatch[1], lossMatch[2]);
    if ("error" in result) return result.error;
    const { operation, allocation } = result;

    const weight = Number(body.weight_grams);
    if (!Number.isFinite(weight) || weight <= 0) {
      return structuredError(
        422,
        "VALIDATION_ERROR",
        "Weight must be positive.",
      );
    }
    const reasonDetail = cleanOptionalText(body.reason_detail);
    if (body.reason !== "Other" && reasonDetail !== null) {
      return businessRuleError(
        "Reason detail is only accepted when reason is Other.",
      );
    }
    if (weight - Number(allocation.remaining_weight_grams) > 0.001) {
      return businessRuleError(
        "Packaging Loss cannot exceed the Allocation's Remaining Weight.",
      );
    }

    const lossId = nextPackagingId(state, "packagingLoss");
    const loss = createPackagingLoss({
      id: lossId,
      packaging_allocation_id: allocation.id,
      weight_grams: String(weight),
      reason: body.reason,
      reason_detail: reasonDetail,
      recorded_at: nextPackagingTimestamp(state),
    });
    allocation.packaging_losses.push(loss);
    recalculateAllocation(allocation);
    const updatedAt = nextPackagingTimestamp(state);
    allocation.updated_at = updatedAt;
    operation.updated_at = updatedAt;
    state.createdPackagingIds.packagingLossIds.push(lossId);
    return json({ packaging_loss: loss, packaging_operation: operation }, 201);
  }

  const labelMatch = path.match(/^\/packages\/([^/]+)\/label$/);
  if (method === "PATCH" && labelMatch) {
    const body = (requestBody ?? {}) as PackageLabelUpdate;
    state.packageLabelUpdateBodies.push({
      packageId: labelMatch[1],
      body,
    });
    const found = findPackageInOperation(state, labelMatch[1]);
    if (!found) {
      return structuredError(
        404,
        "PACKAGE_NOT_FOUND",
        "Package does not exist.",
      );
    }
    if (found.operation.status !== "Open") {
      return businessRuleError(
        "Completed Packaging Operations cannot be changed.",
      );
    }
    const displayName =
      body.display_name === undefined
        ? found.recordedPackage.label.display_name
        : body.display_name?.trim();
    if (!displayName) {
      return businessRuleError(
        "Package Label display name is required.",
        "PACKAGE_LABEL_INVALID",
      );
    }
    const updatedAt = nextPackagingTimestamp(state);
    found.recordedPackage.label = updateLabelValues(
      found.recordedPackage.label,
      body,
      displayName,
      updatedAt,
    );
    syncOperationPackages(found.operation);
    found.operation.updated_at = updatedAt;
    return json(found.recordedPackage.label);
  }

  if (method === "POST" && path === "/package-labels/preview") {
    const body = (requestBody ?? {}) as PackageLabelSelection;
    state.packageLabelPreviewBodies.push(body);
    const selected = selectPackageLabels(state, body.package_label_ids);
    if ("error" in selected) return selected.error;
    return json(selected.labels);
  }

  if (method === "POST" && path === "/package-labels/print") {
    const body = (requestBody ?? {}) as PackageLabelSelection;
    state.packageLabelPrintBodies.push(body);
    const selected = selectPackageLabels(state, body.package_label_ids);
    if ("error" in selected) return selected.error;
    const printJobId = nextPackagingId(state, "printJob");
    const printedAt = body.printed_at ?? nextPackagingTimestamp(state);
    const updatedLabels = selected.labels.map((label) => {
      const eventId = nextPackagingId(state, "printEvent");
      const printEvent = createRefinedPrintEvent({
        id: eventId,
        package_label_id: label.id,
        printed_at: printedAt,
        recorded_at: nextPackagingTimestamp(state),
        template: body.template ?? "Avery 5163",
        print_job_id: printJobId,
        notes: cleanOptionalText(body.notes),
      });
      label.print_events = [...label.print_events, printEvent];
      label.status = "Ready";
      label.updated_at = printEvent.recorded_at;
      state.createdPackagingIds.printEventIds.push(eventId);
      return label;
    });
    return json({ print_job_id: printJobId, labels: updatedLabels });
  }

  const completionMatch = path.match(
    /^\/packaging-operations\/([^/]+)\/complete$/,
  );
  if (method === "POST" && completionMatch) {
    const body = (requestBody ?? {}) as PackagingOperationComplete;
    state.packagingCompleteBodies.push({
      operationId: completionMatch[1],
      body,
    });
    const operation = state.packagingOperations.find(
      (candidate) => candidate.id === completionMatch[1],
    );
    const openError = requireOpenOperation(operation);
    if (openError) return openError;
    const blocker = packagingCompletionBlocker(operation!);
    if (blocker) return businessRuleError(blocker, "PACKAGING_INCOMPLETE");

    const completedAt = body.completed_at ?? nextPackagingTimestamp(state);
    const sourceTrayIds = new Set(
      operation!.allocations.flatMap((allocation) =>
        allocation.source_trays.map((tray) => tray.id),
      ),
    );
    operation!.status = "Completed";
    operation!.completed_at = completedAt;
    operation!.updated_at = completedAt;
    operation!.allocations = operation!.allocations.map((allocation) => ({
      ...allocation,
      source_trays: allocation.source_trays.map((tray) => ({
        ...tray,
        status: "Packaged",
      })),
    }));
    for (const batch of state.productionBatches) {
      batch.trays = batch.trays.map((tray) =>
        sourceTrayIds.has(tray.id) ? { ...tray, status: "Packaged" } : tray,
      );
      batch.trays.forEach((tray) => state.traysById.set(tray.id, tray));
    }
    syncOperationPackages(operation!);
    return json(operation!);
  }

  return null;
}

function requireOpenOperation(operation: PackagingOperation | undefined) {
  if (!operation) {
    return structuredError(
      404,
      "PACKAGING_OPERATION_NOT_FOUND",
      "Packaging Operation does not exist.",
    );
  }
  if (operation.status !== "Open") {
    return businessRuleError(
      "Completed Packaging Operations cannot be changed.",
    );
  }
  return null;
}

function findOpenAllocation(
  state: MockApiState,
  operationId: string,
  allocationId: string,
) {
  const operation = state.packagingOperations.find(
    (candidate) => candidate.id === operationId,
  );
  const openError = requireOpenOperation(operation);
  if (openError) return { error: openError };
  const allocation = operation!.allocations.find(
    (candidate) => candidate.id === allocationId,
  );
  if (!allocation) {
    const existsElsewhere = state.packagingOperations.some((candidate) =>
      candidate.allocations.some((item) => item.id === allocationId),
    );
    return {
      error: existsElsewhere
        ? businessRuleError(
            "Allocation does not belong to this Packaging Operation.",
          )
        : structuredError(
            404,
            "PACKAGING_ALLOCATION_NOT_FOUND",
            "Packaging Allocation does not exist.",
          ),
    };
  }
  return { operation: operation!, allocation };
}

function selectAllocationTrays(
  state: MockApiState,
  operation: PackagingOperation,
  trayIds: string[] | undefined,
  currentAllocationId?: string,
) {
  if (
    !Array.isArray(trayIds) ||
    trayIds.length === 0 ||
    new Set(trayIds).size !== trayIds.length
  ) {
    return {
      error: businessRuleError("Select one or more unique source Trays."),
    };
  }
  const allTrays = state.productionBatches.flatMap((batch) => batch.trays);
  const trays = trayIds.map((id) => allTrays.find((tray) => tray.id === id));
  if (trays.some((tray) => !tray)) {
    return { error: businessRuleError("Every source Tray must exist.") };
  }
  const allocatedIds = new Set(
    state.packagingOperations.flatMap((candidate) =>
      candidate.allocations.flatMap((allocation) =>
        allocation.id === currentAllocationId
          ? []
          : allocation.source_trays.map((tray) => tray.id),
      ),
    ),
  );
  for (const tray of trays as Tray[]) {
    if (allocatedIds.has(tray.id)) {
      return {
        error: businessRuleError(
          "A completed Tray may only belong to one Packaging Allocation.",
          "PACKAGING_TRAY_CONFLICT",
        ),
      };
    }
    if (tray.status !== "Completed" || tray.packaging !== null) {
      return {
        error: businessRuleError(
          "Only Completed Trays may supply an Allocation.",
        ),
      };
    }
    if (tray.production_batch_id !== operation.production_batch_id) {
      return {
        error: businessRuleError(
          "Source Trays must belong to the operation's Production Batch.",
          "PACKAGING_CROSS_BATCH",
        ),
      };
    }
  }
  return { trays: trays as Tray[] };
}

function toAllocationSourceTray(tray: Tray) {
  return createAllocationSourceTray({
    id: tray.id,
    production_batch_id: tray.production_batch_id,
    tray_slot_id: tray.tray_slot_id,
    slot_number: tray.tray_slot.slot_number,
    physical_tray_id: tray.physical_tray_id,
    physical_tray_label: tray.physical_tray.label,
    product_name: tray.product_name,
    preparation: tray.preparation,
    final_dry_weight_grams: tray.final_dry_weight_grams ?? "0",
    notes: tray.notes,
    status: tray.status,
  });
}

function reconcilePlannedPackages(
  state: MockApiState,
  allocation: PackagingAllocation,
  inputs: PlannedPackageInput[] | undefined,
) {
  if (inputs === undefined) return { rows: allocation.planned_packages };
  if (!Array.isArray(inputs)) {
    return { error: businessRuleError("Planned Packages must be an array.") };
  }
  const existing = new Map(
    allocation.planned_packages.map((row) => [row.id, row]),
  );
  const requestedIds = new Set(
    inputs.flatMap((input) => (input.id ? [input.id] : [])),
  );
  for (const row of existing.values()) {
    if (row.recorded_package_id && !requestedIds.has(row.id)) {
      return {
        error: businessRuleError("Recorded package plans cannot be removed."),
      };
    }
  }

  const rows = [];
  for (const input of inputs) {
    const current = input.id ? existing.get(input.id) : undefined;
    if (input.id && !current) {
      return {
        error: businessRuleError(
          "Planned Package does not belong to this Allocation.",
        ),
      };
    }
    if (current?.recorded_package_id) {
      return {
        error: businessRuleError("Recorded package plans cannot be edited."),
      };
    }
    const referenceError = validatePlanReferences(state, input);
    if (referenceError) return { error: referenceError };
    const weightError = validateOptionalPositiveWeight(
      input.finished_product_weight_grams,
      "Finished Product Weight",
    );
    if (weightError) return { error: weightError };
    const sealedError = validateOptionalPositiveWeight(
      input.sealed_package_weight_grams,
      "Sealed Package Weight",
    );
    if (sealedError) return { error: sealedError };

    const id = current?.id ?? nextPackagingId(state, "plannedPackage");
    const timestamp = nextPackagingTimestamp(state);
    const row = createRefinedPlannedPackageRow({
      ...current,
      ...input,
      id,
      packaging_allocation_id: allocation.id,
      created_at: current?.created_at ?? timestamp,
      updated_at: timestamp,
      recorded_package_id: null,
    });
    if (!current) state.createdPackagingIds.plannedPackageRowIds.push(id);
    rows.push(row);
  }
  return { rows };
}

function validatePlanReferences(
  state: MockApiState,
  input: PlannedPackageInput,
) {
  if (input.package_type_id) {
    const packageType = state.packageTypes.find(
      (candidate) => candidate.id === input.package_type_id,
    );
    if (!packageType || packageType.archived) {
      return businessRuleError("Package Type is not available.");
    }
  }
  if (input.storage_location_id) {
    const location = state.storageLocations.find(
      (candidate) => candidate.id === input.storage_location_id,
    );
    if (!location || location.archived) {
      return businessRuleError("Storage Location is not available.");
    }
  }
  return null;
}

function validateOptionalPositiveWeight(
  value: string | number | null | undefined,
  label: string,
) {
  if (value === null || value === undefined) return null;
  const weight = Number(value);
  if (!Number.isFinite(weight) || weight <= 0) {
    return businessRuleError(`${label} must be greater than zero.`);
  }
  return null;
}

type ResolvedPackageLine = {
  plannedRow: PackagingAllocation["planned_packages"][number] | null;
  packageType: PackageType;
  storageLocation: StorageLocation;
  finishedProductWeight: string;
  sealedPackageWeight: string;
  oxygenAbsorber: string | null;
  packagedAt: string | null;
  notes: string | null;
  label: {
    display_name: string;
    description: string | null;
    ingredients_summary: string | null;
    preparation_summary: string | null;
    rehydration_instructions: string | null;
    serving_notes: string | null;
    net_weight_display: string | null;
    fresh_equivalent_display: string | null;
  };
};

function resolvePackageLines(
  state: MockApiState,
  allocation: PackagingAllocation,
  lines: PackageLineCreate[] | undefined,
) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { error: businessRuleError("Record at least one Package.") };
  }
  const resolved: ResolvedPackageLine[] = [];
  const plannedRowIds = new Set<string>();
  for (const line of lines) {
    const plannedRow = line.planned_package_row_id
      ? allocation.planned_packages.find(
          (candidate) => candidate.id === line.planned_package_row_id,
        )
      : null;
    if (line.planned_package_row_id && !plannedRow) {
      return {
        error: businessRuleError(
          "Planned Package does not belong to this Allocation.",
        ),
      };
    }
    if (
      plannedRow?.recorded_package_id ||
      (plannedRow && plannedRowIds.has(plannedRow.id))
    ) {
      return {
        error: businessRuleError(
          "Planned Package has already been recorded.",
          "PACKAGE_RECORDING_CONFLICT",
        ),
      };
    }
    if (plannedRow) plannedRowIds.add(plannedRow.id);
    const packageTypeId = line.package_type_id ?? plannedRow?.package_type_id;
    const packageType = state.packageTypes.find(
      (candidate) => candidate.id === packageTypeId && !candidate.archived,
    );
    if (!packageType) {
      return { error: businessRuleError("Package Type does not exist.") };
    }
    const finishedProductWeight =
      line.finished_product_weight_grams ??
      plannedRow?.finished_product_weight_grams;
    const sealedPackageWeight =
      line.sealed_package_weight_grams ??
      plannedRow?.sealed_package_weight_grams;
    const finishedError = validateOptionalPositiveWeight(
      finishedProductWeight,
      "Finished Product Weight",
    );
    const sealedError = validateOptionalPositiveWeight(
      sealedPackageWeight,
      "Sealed Package Weight",
    );
    if (!finishedProductWeight || !sealedPackageWeight) {
      return {
        error: businessRuleError(
          "Package Type and both Package weights are required.",
        ),
      };
    }
    if (finishedError) return { error: finishedError };
    if (sealedError) return { error: sealedError };
    const storageLocationId =
      line.storage_location_id ?? plannedRow?.storage_location_id;
    const storageLocation = storageLocationId
      ? state.storageLocations.find(
          (candidate) =>
            candidate.id === storageLocationId && !candidate.archived,
        )
      : state.storageLocations.find(
          (candidate) => candidate.name === "Unassigned" && !candidate.archived,
        );
    if (!storageLocation) {
      return { error: businessRuleError("Storage Location is not available.") };
    }
    const sourceProducts = Array.from(
      new Set(allocation.source_trays.map((tray) => tray.product_name)),
    );
    const preparation = Array.from(
      new Set(
        allocation.source_trays.map((tray) => tray.preparation).filter(Boolean),
      ),
    ).join("; ");
    const labelValues = line.label ?? {};
    resolved.push({
      plannedRow,
      packageType,
      storageLocation,
      finishedProductWeight: String(finishedProductWeight),
      sealedPackageWeight: String(sealedPackageWeight),
      oxygenAbsorber:
        line.oxygen_absorber ??
        plannedRow?.oxygen_absorber ??
        packageType.default_oxygen_absorber,
      packagedAt: line.packaged_at ?? null,
      notes: cleanOptionalText(line.notes ?? plannedRow?.notes),
      label: {
        display_name:
          cleanOptionalText(
            labelValues.display_name ?? plannedRow?.label_display_name,
          ) ??
          (sourceProducts.length === 1 ? sourceProducts[0] : "Mixed Product"),
        description: cleanOptionalText(
          labelValues.description ?? plannedRow?.label_description,
        ),
        ingredients_summary: cleanOptionalText(
          labelValues.ingredients_summary ??
            plannedRow?.label_ingredients_summary,
        ),
        preparation_summary:
          cleanOptionalText(
            labelValues.preparation_summary ??
              plannedRow?.label_preparation_summary,
          ) ?? cleanOptionalText(preparation),
        rehydration_instructions: cleanOptionalText(
          labelValues.rehydration_instructions ??
            plannedRow?.label_rehydration_instructions,
        ),
        serving_notes: cleanOptionalText(
          labelValues.serving_notes ?? plannedRow?.label_serving_notes,
        ),
        net_weight_display:
          cleanOptionalText(
            labelValues.net_weight_display ??
              plannedRow?.label_net_weight_display,
          ) ?? `${Number(finishedProductWeight).toFixed(1)} g`,
        fresh_equivalent_display: cleanOptionalText(
          labelValues.fresh_equivalent_display ??
            plannedRow?.label_fresh_equivalent_display,
        ),
      },
    });
  }
  return { lines: resolved, plannedRowIds };
}

function findPackageInOperation(state: MockApiState, packageId: string) {
  for (const operation of state.packagingOperations) {
    for (const allocation of operation.allocations) {
      const recordedPackage = allocation.packages.find(
        (candidate) => candidate.id === packageId,
      );
      if (recordedPackage) return { operation, allocation, recordedPackage };
    }
  }
  return null;
}

function updateLabelValues(
  label: PackageLabel,
  body: PackageLabelUpdate,
  displayName: string,
  updatedAt: string,
) {
  const optional = <T extends keyof PackageLabelUpdate>(field: T) =>
    body[field] === undefined
      ? label[field as keyof PackageLabel]
      : cleanOptionalText(body[field] as string | null | undefined);
  return {
    ...label,
    display_name: displayName,
    description: optional("description") as string | null,
    ingredients_summary: optional("ingredients_summary") as string | null,
    preparation_summary: optional("preparation_summary") as string | null,
    rehydration_instructions: optional("rehydration_instructions") as
      | string
      | null,
    serving_notes: optional("serving_notes") as string | null,
    net_weight_display: optional("net_weight_display") as string | null,
    fresh_equivalent_display: optional("fresh_equivalent_display") as
      | string
      | null,
    status: label.print_events.length > 0 ? "Needs Reprint" : "Ready",
    updated_at: updatedAt,
  } satisfies PackageLabel;
}

function selectPackageLabels(state: MockApiState, ids: string[] | undefined) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: businessRuleError("Select at least one Package Label.") };
  }
  if (new Set(ids).size !== ids.length) {
    return {
      error: businessRuleError("Select each Package Label only once."),
    };
  }
  const labelsById = new Map(
    packagesInOperations(state).map((recordedPackage) => [
      recordedPackage.label.id,
      recordedPackage.label,
    ]),
  );
  const labels = ids.map((id) => labelsById.get(id));
  if (labels.some((label) => !label)) {
    return {
      error: businessRuleError("Every selected Package Label must exist."),
    };
  }
  if (labels.some((label) => label!.status === "Draft")) {
    return {
      error: businessRuleError(
        "Draft Package Labels must be made Ready before previewing or printing.",
      ),
    };
  }
  return { labels: labels as PackageLabel[] };
}

function packagingCompletionBlocker(operation: PackagingOperation) {
  if (operation.allocations.length === 0) {
    return "A Packaging Operation requires at least one Allocation.";
  }
  for (const allocation of operation.allocations) {
    if (
      allocation.packages.length === 0 &&
      allocation.packaging_losses.length === 0
    ) {
      return "Every Allocation requires at least one Package or Packaging Loss.";
    }
    if (allocation.planned_packages.some((row) => !row.recorded_package_id)) {
      return "Every planned Package must be recorded before completion.";
    }
    if (Math.abs(Number(allocation.remaining_weight_grams)) > 0.001) {
      return "All selected product must be allocated before completion.";
    }
    if (allocation.packages.some((item) => item.label.status !== "Ready")) {
      return "Every Package Label must be Ready before completion.";
    }
    if (
      allocation.source_trays.length === 0 ||
      allocation.packages.some(
        (item) => item.packaging_allocation_id !== allocation.id,
      )
    ) {
      return "Every Package must preserve its source Tray traceability.";
    }
  }
  return null;
}

function replaceAllocation(
  operation: PackagingOperation,
  allocation: PackagingAllocation,
) {
  operation.allocations = operation.allocations.map((candidate) =>
    candidate.id === allocation.id ? allocation : candidate,
  );
  syncOperationPackages(operation);
}

function recalculateAllocation(allocation: PackagingAllocation) {
  const selected = allocation.source_trays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams),
    0,
  );
  const allocated =
    recordedFinishedProductWeight(allocation) +
    unrecordedPlannedWeight(allocation.planned_packages);
  const totalLoss = allocation.packaging_losses.reduce(
    (total, loss) => total + Number(loss.weight_grams),
    0,
  );
  allocation.selected_weight_grams = String(selected);
  allocation.allocated_weight_grams = String(allocated);
  allocation.total_recorded_loss_weight_grams = String(totalLoss);
  allocation.remaining_weight_grams = String(selected - allocated - totalLoss);
}

function recordedFinishedProductWeight(allocation: PackagingAllocation) {
  return allocation.packages.reduce(
    (total, item) => total + Number(item.finished_product_weight_grams ?? 0),
    0,
  );
}

function unrecordedPlannedWeight(
  rows: PackagingAllocation["planned_packages"],
) {
  return rows.reduce(
    (total, row) =>
      row.recorded_package_id
        ? total
        : total + Number(row.finished_product_weight_grams ?? 0),
    0,
  );
}

function syncOperationPackages(operation: PackagingOperation) {
  operation.packages = operation.allocations.flatMap(
    (allocation) => allocation.packages,
  );
}

function nextPackagingId(
  state: MockApiState,
  kind: keyof Omit<MockApiState["packagingSequences"], "timestamp">,
) {
  state.packagingSequences[kind] += 1;
  const prefix = {
    operation: "packaging-operation",
    allocation: "packaging-allocation",
    plannedPackage: "planned-package",
    package: "package",
    packageLabel: "package-label",
    printJob: "print-job",
    printEvent: "print-event",
  }[kind];
  return `${prefix}-e2e-${state.packagingSequences[kind]}`;
}

function nextPackagingTimestamp(state: MockApiState) {
  state.packagingSequences.timestamp += 1;
  return new Date(
    Date.parse("2026-07-18T11:00:00.000Z") +
      state.packagingSequences.timestamp * 60_000,
  ).toISOString();
}

function packagingIdentityCheckpoint(state: MockApiState) {
  return {
    sequences: { ...state.packagingSequences },
    createdIds: Object.fromEntries(
      Object.entries(state.createdPackagingIds).map(([key, values]) => [
        key,
        [...values],
      ]),
    ) as MockApiState["createdPackagingIds"],
  };
}

function restorePackagingIdentityCheckpoint(
  state: MockApiState,
  checkpoint: ReturnType<typeof packagingIdentityCheckpoint>,
) {
  state.packagingSequences = checkpoint.sequences;
  state.createdPackagingIds = checkpoint.createdIds;
}

function cleanOptionalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const cleaned = value.trim();
  return cleaned === "" ? null : cleaned;
}

function businessRuleError(
  message: string,
  code = "BUSINESS_RULE_VIOLATION",
  errors?: unknown[],
) {
  return structuredError(400, code, message, errors);
}

function seedTrayLookup(
  state: MockApiState,
  useLegacyPackagingDefaults = false,
) {
  state.productionBatches.forEach((batch) => {
    batch.trays.forEach((tray) => state.traysById.set(tray.id, tray));
  });
  state.packagingWorksheet.forEach((item) => {
    item.production_batch.trays.forEach((tray) =>
      state.traysById.set(tray.id, tray),
    );
    item.eligible_trays.forEach((tray) => state.traysById.set(tray.id, tray));
  });
  if (useLegacyPackagingDefaults) {
    state.traysById.set("tray-1", createPackagedTray());
  }
}

function findBatch(state: MockApiState, id: string) {
  return state.productionBatches.find((batch) => batch.id === id);
}

function findDryingRun(state: MockApiState, id: string) {
  for (const batch of state.productionBatches) {
    const run = batch.drying_runs.find((dryingRun) => dryingRun.id === id);
    if (run) return { batch, run };
  }
  return null;
}

function createTrayFromSetup(
  state: MockApiState,
  batch: ProductionBatch,
  body: TraySetupBody,
) {
  const traySlot =
    batch.freeze_dryer.tray_slots.find(
      (candidate) => candidate.id === body.tray_slot_id,
    ) ?? batch.freeze_dryer.tray_slots[0];
  const physicalTray =
    state.physicalTrays.find(
      (candidate) => candidate.id === body.physical_tray_id,
    ) ?? state.physicalTrays[0];

  return createTray({
    id: `${batch.id}-tray-${batch.trays.length + 1}`,
    production_batch_id: batch.id,
    tray_slot_id: traySlot.id,
    tray_slot: traySlot,
    physical_tray_id: physicalTray.id,
    physical_tray: physicalTray,
    product_name: body.product_name ?? "",
    preparation: body.preparation ?? "",
    starting_weight_grams: body.starting_weight_grams ?? null,
    latest_weight_grams: body.starting_weight_grams ?? null,
    previous_weight_grams: null,
    final_dry_weight_grams: null,
    completed_at: null,
    notes: body.notes ?? null,
    status: "Draft",
    weight_checks: [],
    packaging: null,
  });
}

function applyTraySetup(state: MockApiState, tray: Tray, body: TraySetupBody) {
  const batch = findBatch(state, tray.production_batch_id);
  const traySlot =
    batch?.freeze_dryer.tray_slots.find(
      (candidate) => candidate.id === body.tray_slot_id,
    ) ?? tray.tray_slot;
  const physicalTray =
    state.physicalTrays.find(
      (candidate) => candidate.id === body.physical_tray_id,
    ) ?? tray.physical_tray;

  return {
    ...tray,
    tray_slot_id: body.tray_slot_id ?? tray.tray_slot_id,
    tray_slot: traySlot,
    physical_tray_id: body.physical_tray_id ?? tray.physical_tray_id,
    physical_tray: physicalTray,
    product_name: body.product_name ?? tray.product_name,
    preparation: body.preparation ?? tray.preparation,
    starting_weight_grams:
      body.starting_weight_grams ?? tray.starting_weight_grams,
    latest_weight_grams:
      tray.weight_checks.length === 0
        ? (body.starting_weight_grams ?? tray.latest_weight_grams)
        : tray.latest_weight_grams,
    notes: body.notes ?? tray.notes,
  };
}

function updateTrayInLookup(state: MockApiState, tray: Tray) {
  state.traysById.set(tray.id, tray);
  return tray;
}

function updateTrayInBatchAndLookup(
  state: MockApiState,
  batch: ProductionBatch | undefined,
  tray: Tray,
) {
  state.traysById.set(tray.id, tray);
  if (batch) {
    batch.trays = batch.trays.map((candidate) =>
      candidate.id === tray.id ? tray : candidate,
    );
  }
  return tray;
}

function traySlotsFor(freezeDryerId: string, count: number): TraySlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${freezeDryerId}-slot-${index + 1}`,
    freeze_dryer_id: freezeDryerId,
    slot_number: index + 1,
    label: null,
    archived: false,
  }));
}

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data, meta: {} }),
  };
}

function structuredError(
  status: number,
  code: string,
  message: string,
  errors?: unknown[],
) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({
      detail: {
        code,
        message,
        ...(errors ? { errors } : {}),
      },
    }),
  };
}

function notFound(detail: string) {
  return {
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ detail }),
  };
}
