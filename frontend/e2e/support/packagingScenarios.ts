import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageLabelStatus,
  PackagingAllocation,
  PackagingAllocationSourceTray,
  PackagingOperation,
  PlannedPackageRow,
  PrintEvent,
  ProductionBatch,
  StorageLocation,
  Tray,
} from "../../src/api/client";

const STARTED_AT = "2026-07-18T09:00:00.000Z";
const UPDATED_AT = "2026-07-18T10:00:00.000Z";

export type PackagingScenario = {
  productionBatches: ProductionBatch[];
  packagingOperations: PackagingOperation[];
};

export function createScenarioFreezeDryer(
  overrides: Partial<FreezeDryer> = {},
): FreezeDryer {
  const id = overrides.id ?? "freeze-dryer-scenario-1";
  return {
    id,
    name: "Scenario Freeze Dryer",
    notes: null,
    archived: false,
    tray_slot_count: 4,
    tray_slots: Array.from({ length: 4 }, (_, index) => ({
      id: `${id}-slot-${index + 1}`,
      freeze_dryer_id: id,
      slot_number: index + 1,
      label: null,
      archived: false,
    })),
    ...overrides,
  };
}

export function createScenarioTray(overrides: Partial<Tray> = {}): Tray {
  const freezeDryer = createScenarioFreezeDryer();
  const slotNumber = overrides.tray_slot?.slot_number ?? 1;
  const traySlot =
    overrides.tray_slot ?? freezeDryer.tray_slots[slotNumber - 1];
  const id = overrides.id ?? "tray-scenario-1";
  const physicalTrayId =
    overrides.physical_tray_id ?? `physical-${id.replace("tray-", "")}`;
  return {
    id,
    production_batch_id: "batch-scenario-1",
    tray_slot_id: traySlot.id,
    tray_slot: traySlot,
    physical_tray_id: physicalTrayId,
    physical_tray: {
      id: physicalTrayId,
      label: `Physical ${id}`,
      tare_weight_grams: null,
      notes: null,
      archived: false,
    },
    recipe_id: null,
    recipe_name: null,
    product_name: "Taco Chicken",
    preparation: "Cubed and seasoned",
    starting_weight_grams: "900",
    final_dry_weight_grams: "240",
    completed_at: "2026-07-18T08:45:00.000Z",
    notes: null,
    status: "Completed",
    weight_checks: [],
    latest_weight_grams: "240",
    previous_weight_grams: "245",
    packaging: null,
    ...overrides,
  };
}

export function createScenarioProductionBatch(
  overrides: Partial<ProductionBatch> = {},
): ProductionBatch {
  const freezeDryer = overrides.freeze_dryer ?? createScenarioFreezeDryer();
  const id = overrides.id ?? "batch-scenario-1";
  const trays = (
    overrides.trays ?? [createScenarioTray({ production_batch_id: id })]
  ).map((tray) => ({ ...tray, production_batch_id: id }));
  return {
    batch_number: "Batch Scenario 001",
    status: "Completed",
    started_at: "2026-07-17T18:00:00.000Z",
    completed_at: "2026-07-18T08:45:00.000Z",
    notes: "Scenario Production Batch",
    drying_runs: [],
    total_drying_seconds: 24_300,
    ...overrides,
    id,
    freeze_dryer_id: freezeDryer.id,
    freeze_dryer: freezeDryer,
    trays,
  };
}

export function createAllocationSourceTray(
  overrides: Partial<PackagingAllocationSourceTray> = {},
): PackagingAllocationSourceTray {
  return {
    id: "tray-scenario-1",
    production_batch_id: "batch-scenario-1",
    tray_slot_id: "freeze-dryer-scenario-1-slot-1",
    slot_number: 1,
    physical_tray_id: "physical-scenario-1",
    physical_tray_label: "Physical Tray 1",
    product_name: "Taco Chicken",
    preparation: "Cubed and seasoned",
    final_dry_weight_grams: "240",
    notes: null,
    status: "Completed",
    ...overrides,
  };
}

export function createPlannedPackageRow(
  overrides: Partial<PlannedPackageRow> = {},
): PlannedPackageRow {
  return {
    id: "planned-package-scenario-1",
    packaging_allocation_id: "allocation-scenario-1",
    package_type_id: "package-type-1",
    finished_product_weight_grams: "120",
    finished_product_weight_unit: "g",
    sealed_package_weight_grams: "128",
    sealed_package_weight_unit: "g",
    oxygen_absorber: "500cc",
    storage_location_id: "storage-unassigned",
    notes: "Saved package plan",
    label_status: "Draft",
    label_display_name: "Taco Chicken",
    label_description: null,
    label_ingredients_summary: "Chicken and seasoning",
    label_preparation_summary: "Cubed and seasoned",
    label_rehydration_instructions: null,
    label_serving_notes: null,
    label_net_weight_display: "120 g",
    label_fresh_equivalent_display: "450 g fresh",
    recorded_package_id: null,
    created_at: STARTED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

export function createPrintEvent(
  overrides: Partial<PrintEvent> = {},
): PrintEvent {
  return {
    id: "print-event-scenario-1",
    package_label_id: "package-label-scenario-1",
    printed_at: "2026-07-18T10:05:00.000Z",
    recorded_at: "2026-07-18T10:05:05.000Z",
    template: "Avery 5163",
    print_job_id: "print-job-scenario-1",
    notes: null,
    ...overrides,
  };
}

export function createPackageLabel(
  overrides: Partial<PackageLabel> = {},
): PackageLabel {
  const id = overrides.id ?? "package-label-scenario-1";
  const printEvents = (overrides.print_events ?? []).map((event) => ({
    ...event,
    package_label_id: id,
  }));
  return {
    id,
    package_id: "package-scenario-1",
    status: "Draft",
    display_name: "Taco Chicken",
    description: null,
    ingredients_summary: "Chicken and seasoning",
    preparation_summary: "Cubed and seasoned",
    rehydration_instructions: null,
    serving_notes: null,
    net_weight_display: "120 g",
    fresh_equivalent_display: "450 g fresh",
    created_at: STARTED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
    print_events: printEvents,
  };
}

export function createRecordedPackage(
  overrides: Partial<Package> = {},
): Package {
  const id = overrides.id ?? "package-scenario-1";
  const packageType = overrides.package_type ?? {
    id: "package-type-1",
    name: "Quart Mylar",
    default_oxygen_absorber: "500cc",
    default_label_template: "avery-5163",
    notes: null,
    archived: false,
  };
  const storageLocation: StorageLocation = overrides.storage_location ?? {
    id: "storage-unassigned",
    name: "Unassigned",
    notes: null,
    archived: false,
  };
  return {
    id,
    packaging_allocation_id: "allocation-scenario-1",
    packaging_operation_id: "packaging-operation-scenario-1",
    package_type_id: packageType.id,
    package_type: packageType,
    package_identifier: "PKG-2026-900001",
    packaged_at: "2026-07-18T10:00:00.000Z",
    package_weight_grams: "128",
    finished_product_weight_grams: "120",
    oxygen_absorber: "500cc",
    storage_location_id: storageLocation.id,
    storage_location: storageLocation,
    status: "In Storage",
    notes: null,
    label: createPackageLabel({ package_id: id }),
    ...overrides,
  };
}

export function createPackagingAllocation(
  overrides: Partial<PackagingAllocation> = {},
): PackagingAllocation {
  const id = overrides.id ?? "allocation-scenario-1";
  const operationId =
    overrides.packaging_operation_id ?? "packaging-operation-scenario-1";
  const sourceTrays = overrides.source_trays ?? [createAllocationSourceTray()];
  const plannedPackages = (overrides.planned_packages ?? []).map((row) => ({
    ...row,
    packaging_allocation_id: id,
  }));
  const packages = (overrides.packages ?? []).map((recordedPackage) => ({
    ...recordedPackage,
    packaging_allocation_id: id,
    packaging_operation_id: operationId,
  }));
  const selectedWeight = sourceTrays.reduce(
    (total, tray) => total + Number(tray.final_dry_weight_grams),
    0,
  );
  const allocatedWeight =
    packages.reduce(
      (total, item) => total + Number(item.finished_product_weight_grams ?? 0),
      0,
    ) +
    plannedPackages.reduce(
      (total, row) =>
        row.recorded_package_id
          ? total
          : total + Number(row.finished_product_weight_grams ?? 0),
      0,
    );
  return {
    notes: null,
    created_at: STARTED_AT,
    updated_at: UPDATED_AT,
    selected_weight_grams: String(selectedWeight),
    allocated_weight_grams: String(allocatedWeight),
    remaining_weight_grams: String(selectedWeight - allocatedWeight),
    ...overrides,
    id,
    packaging_operation_id: operationId,
    source_trays: sourceTrays,
    planned_packages: plannedPackages,
    packages,
  };
}

export function createPackagingOperation(
  overrides: Partial<PackagingOperation> = {},
): PackagingOperation {
  const id = overrides.id ?? "packaging-operation-scenario-1";
  const allocations = (overrides.allocations ?? []).map((allocation) =>
    createPackagingAllocation({
      ...allocation,
      packaging_operation_id: id,
    }),
  );
  return {
    production_batch_id: "batch-scenario-1",
    status: "Open",
    started_at: STARTED_AT,
    completed_at: null,
    notes: "Saved Packaging work",
    created_at: STARTED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
    id,
    allocations,
    packages:
      overrides.packages ??
      allocations.flatMap((allocation) => allocation.packages),
  };
}

export function noOperationPackagingScenario(): PackagingScenario {
  return {
    productionBatches: [createScenarioProductionBatch()],
    packagingOperations: [],
  };
}

export function openEmptyPackagingScenario(): PackagingScenario {
  const batch = createScenarioProductionBatch();
  return {
    productionBatches: [batch],
    packagingOperations: [
      createPackagingOperation({ production_batch_id: batch.id }),
    ],
  };
}

export function savedPlanningPackagingScenario(): PackagingScenario {
  const batch = createScenarioProductionBatch({
    trays: [
      createScenarioTray(),
      createScenarioTray({
        id: "tray-scenario-2",
        physical_tray_id: "physical-scenario-2",
        tray_slot: createScenarioFreezeDryer().tray_slots[1],
        product_name: "Apples",
        preparation: "Sliced",
        final_dry_weight_grams: "180",
      }),
    ],
  });
  const sourceTray = createAllocationSourceTray({
    id: batch.trays[0].id,
    production_batch_id: batch.id,
  });
  const allocation = createPackagingAllocation({
    source_trays: [sourceTray],
    planned_packages: [createPlannedPackageRow()],
  });
  return {
    productionBatches: [batch],
    packagingOperations: [
      createPackagingOperation({
        production_batch_id: batch.id,
        allocations: [allocation],
      }),
    ],
  };
}

export function recordedPackagingScenario(
  labelStatus: PackageLabelStatus = "Ready",
): PackagingScenario {
  const batch = createScenarioProductionBatch();
  const recordedPackage = createRecordedPackage({
    label: createPackageLabel({ status: labelStatus }),
  });
  const allocation = createPackagingAllocation({
    source_trays: [
      createAllocationSourceTray({
        id: batch.trays[0].id,
        production_batch_id: batch.id,
      }),
    ],
    planned_packages: [
      createPlannedPackageRow({
        recorded_package_id: recordedPackage.id,
        label_status: labelStatus,
      }),
    ],
    packages: [recordedPackage],
  });
  return {
    productionBatches: [batch],
    packagingOperations: [
      createPackagingOperation({
        production_batch_id: batch.id,
        allocations: [allocation],
      }),
    ],
  };
}

export function completedPackagingScenario(): PackagingScenario {
  const scenario = recordedPackagingScenario("Needs Reprint");
  const operation = scenario.packagingOperations[0];
  const allocation = operation.allocations[0];
  const recordedPackage = operation.allocations[0].packages[0];
  const printEvent = createPrintEvent({
    package_label_id: recordedPackage.label.id,
  });
  recordedPackage.label = createPackageLabel({
    ...recordedPackage.label,
    status: "Needs Reprint",
    print_events: [printEvent],
  });
  recordedPackage.finished_product_weight_grams = "240";
  recordedPackage.package_weight_grams = "248";
  allocation.planned_packages = allocation.planned_packages.map((row) => ({
    ...row,
    finished_product_weight_grams: "240",
  }));
  allocation.allocated_weight_grams = "240";
  allocation.remaining_weight_grams = "0";
  operation.status = "Completed";
  operation.completed_at = "2026-07-18T10:30:00.000Z";
  operation.updated_at = operation.completed_at;
  operation.allocations[0].source_trays =
    operation.allocations[0].source_trays.map((tray) => ({
      ...tray,
      status: "Packaged",
    }));
  operation.packages = operation.allocations.flatMap(
    (allocation) => allocation.packages,
  );
  scenario.productionBatches[0].trays = scenario.productionBatches[0].trays.map(
    (tray) => ({ ...tray, status: "Packaged" }),
  );
  return scenario;
}

export function multiBatchPackagingScenario(): PackagingScenario {
  const planning = savedPlanningPackagingScenario();
  const secondFreezeDryer = createScenarioFreezeDryer({
    id: "freeze-dryer-scenario-2",
    name: "Second Scenario Freeze Dryer",
  });
  const secondBatch = createScenarioProductionBatch({
    id: "batch-scenario-2",
    batch_number: "Batch Scenario 002",
    freeze_dryer_id: secondFreezeDryer.id,
    freeze_dryer: secondFreezeDryer,
    trays: [
      createScenarioTray({
        id: "tray-scenario-3",
        production_batch_id: "batch-scenario-2",
        tray_slot: secondFreezeDryer.tray_slots[0],
        physical_tray_id: "physical-scenario-3",
        product_name: "Strawberries",
        preparation: "Sliced",
        final_dry_weight_grams: "150",
      }),
    ],
  });
  return {
    productionBatches: [...planning.productionBatches, secondBatch],
    packagingOperations: planning.packagingOperations,
  };
}
