import type { Page } from "@playwright/test";

import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageType,
  PackagingResult,
  PackagingWorksheetItem,
  PhysicalTray,
  ProductionBatch,
  StorageLocation,
  Tray,
  TraySlot,
  WeightCheck,
} from "../../src/api/client";

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

export type MockApiState = {
  freezeDryers: FreezeDryer[];
  physicalTrays: PhysicalTray[];
  productionBatches: ProductionBatch[];
  packageTypes: PackageType[];
  storageLocations: StorageLocation[];
  packagingWorksheet: PackagingWorksheetItem[];
  traysById: Map<string, Tray>;
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
  packageLabels: PackageLabel[];
};

type MockApiOptions = Partial<
  Pick<
    MockApiState,
    | "freezeDryers"
    | "physicalTrays"
    | "productionBatches"
    | "packageTypes"
    | "storageLocations"
    | "packagingWorksheet"
  >
>;

export async function mockFreezeflowApi(
  page: Page,
  options: MockApiOptions = {},
) {
  const state: MockApiState = {
    freezeDryers: options.freezeDryers ?? [createFreezeDryer()],
    physicalTrays: options.physicalTrays ?? [createPhysicalTray()],
    productionBatches: options.productionBatches ?? [],
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
    packagingWorksheet: options.packagingWorksheet ?? defaultPackagingWorksheet(),
    traysById: new Map(),
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
    packageLabels: [
      packageLabelForPackage(
        createPackage(
          { finished_product_weight_grams: "232.466" },
          createPackageType(),
          createStorageLocation(),
        ),
        [createTray()],
      ),
    ],
  };
  seedTrayLookup(state);

  // Tiny in-memory API: the browser makes real network calls, and each
  // mutation updates this state so later GETs behave like a small backend.
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace("/api/v1", "");

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
        state.freezeDryers.find((candidate) => candidate.id === body.freeze_dryer_id) ??
        state.freezeDryers[0];
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
      return route.fulfill(json(state.packagingWorksheet));
    }

    if (method === "GET" && path === "/package-types") {
      return route.fulfill(json(state.packageTypes));
    }

    if (method === "GET" && path === "/storage-locations") {
      return route.fulfill(json(state.storageLocations));
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

    const trayStartingWeight = path.match(/^\/trays\/([^/]+)\/starting-weight$/);
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
      body: JSON.stringify({ detail: `Unhandled E2E request: ${method} ${path}` }),
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
      packaged_at: "2026-07-08T01:00:00.000Z",
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
    packaging_operation_id: "packaging-operation-1",
    package_type_id: packageType.id,
    package_type: packageType,
    package_identifier: "PKG-2026-000001",
    finished_product_weight_grams: "232.466",
    package_weight_grams: "246.641",
    oxygen_absorber: "500cc",
    storage_location_id: storageLocation.id,
    storage_location: storageLocation,
    status: "In Storage",
    notes: null,
    ...overrides,
  };
}

function createPackagingResult(
  state: MockApiState,
  body: PackageRequestBody,
): PackagingResult {
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
            packaged_at: body.packaged_at ?? "2026-07-08T01:00:00.000Z",
            batch_number: "Batch 005",
            freeze_dryer: tray.production_batch_id === "batch-2" ? "white" : "black",
            packages: packages.map((packageItem) => ({
              id: packageItem.id,
              package_identifier: packageItem.package_identifier,
              package_type: packageItem.package_type.name,
              finished_product_weight_grams:
                packageItem.finished_product_weight_grams,
              package_weight_grams: packageItem.package_weight_grams,
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
): PackageLabel {
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
    freeze_dryer: firstTray?.production_batch_id === "batch-2" ? "white" : "black",
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
      packageItem.finished_product_weight_grams,
    fresh_equivalent_grams:
      freshEquivalent === null ? null : String(freshEquivalent),
    package_weight_grams: packageItem.package_weight_grams,
    oxygen_absorber: packageItem.oxygen_absorber,
    packaged_at: "2026-07-08T01:00:00.000Z",
    label_template: packageItem.package_type.default_label_template,
  };
}

function seedTrayLookup(state: MockApiState) {
  state.productionBatches.forEach((batch) => {
    batch.trays.forEach((tray) => state.traysById.set(tray.id, tray));
  });
  state.packagingWorksheet.forEach((item) => {
    item.production_batch.trays.forEach((tray) => state.traysById.set(tray.id, tray));
    item.eligible_trays.forEach((tray) => state.traysById.set(tray.id, tray));
  });
  if (state.productionBatches.length === 0) {
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

function applyTraySetup(
  state: MockApiState,
  tray: Tray,
  body: TraySetupBody,
) {
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
        ? body.starting_weight_grams ?? tray.latest_weight_grams
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

function json(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data, meta: {} }),
  };
}

function notFound(detail: string) {
  return {
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ detail }),
  };
}
