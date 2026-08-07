import { describe, expect, it } from "vitest";

import type {
  Package,
  PackagingAllocation,
  PackagingOperation,
  PlannedPackageRow,
} from "../api/client";
import { getCurrentPackagingStage } from "../pages/packagingStages";

describe("Packaging workflow stage derivation", () => {
  it("moves through source, product, package, review, and finish states", () => {
    expect(getCurrentPackagingStage(null)).toBe("source");

    const operation = createOperation();
    expect(getCurrentPackagingStage(operation)).toBe("product");

    operation.allocations = [createAllocation()];
    expect(getCurrentPackagingStage(operation)).toBe("packages");

    const recordedPackage = createPackage("Draft");
    operation.allocations = [
      createAllocation({
        allocated_weight_grams: "100",
        remaining_weight_grams: "0",
        planned_packages: [createPlan(recordedPackage.id)],
        packages: [recordedPackage],
      }),
    ];
    operation.packages = [recordedPackage];
    expect(getCurrentPackagingStage(operation)).toBe("review");

    const readyPackage = createPackage("Ready");
    operation.allocations[0].packages = [readyPackage];
    operation.packages = [readyPackage];
    expect(getCurrentPackagingStage(operation)).toBe("finish");

    operation.status = "Completed";
    expect(getCurrentPackagingStage(operation)).toBe("finish");
  });

  it("keeps incomplete planned work in the package stage", () => {
    const operation = createOperation();
    operation.allocations = [
      createAllocation({
        allocated_weight_grams: "100",
        remaining_weight_grams: "0",
        planned_packages: [createPlan(null)],
        packages: [createPackage("Ready")],
      }),
    ];
    operation.packages = operation.allocations[0].packages;

    expect(getCurrentPackagingStage(operation)).toBe("packages");
  });
});

function createOperation(): PackagingOperation {
  return {
    id: "operation-1",
    production_batch_id: "batch-1",
    status: "Open",
    started_at: "2026-07-08T00:00:00.000Z",
    completed_at: null,
    notes: null,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    allocations: [],
    packages: [],
  };
}

function createAllocation(
  overrides: Partial<PackagingAllocation> = {},
): PackagingAllocation {
  return {
    id: "allocation-1",
    packaging_operation_id: "operation-1",
    notes: null,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    selected_weight_grams: "100",
    allocated_weight_grams: "0",
    remaining_weight_grams: "100",
    source_trays: [],
    planned_packages: [],
    packages: [],
    ...overrides,
  };
}

function createPlan(recordedPackageId: string | null): PlannedPackageRow {
  return {
    id: "plan-1",
    packaging_allocation_id: "allocation-1",
    package_type_id: "package-type-1",
    finished_product_weight_grams: "100",
    finished_product_weight_unit: "g",
    sealed_package_weight_grams: "105",
    sealed_package_weight_unit: "g",
    oxygen_absorber: "500cc",
    storage_location_id: "storage-1",
    notes: null,
    label_status: "Ready",
    label_display_name: "Apples",
    label_description: null,
    label_ingredients_summary: null,
    label_preparation_summary: null,
    label_rehydration_instructions: null,
    label_serving_notes: null,
    label_net_weight_display: null,
    label_fresh_equivalent_display: null,
    recorded_package_id: recordedPackageId,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
  };
}

function createPackage(status: "Draft" | "Ready" | "Needs Reprint"): Package {
  return {
    id: "package-1",
    packaging_allocation_id: "allocation-1",
    packaging_operation_id: "operation-1",
    package_type_id: "package-type-1",
    package_type: {
      id: "package-type-1",
      name: "Quart Mylar",
      default_oxygen_absorber: "500cc",
      default_label_template: "avery-5163",
      notes: null,
      archived: false,
    },
    package_identifier: "PKG-2026-000001",
    packaged_at: "2026-07-08T00:00:00.000Z",
    package_weight_grams: "105",
    finished_product_weight_grams: "100",
    oxygen_absorber: "500cc",
    storage_location_id: "storage-1",
    storage_location: {
      id: "storage-1",
      name: "Pantry",
      notes: null,
      archived: false,
    },
    status: "In Storage",
    notes: null,
    label: {
      id: "label-1",
      package_id: "package-1",
      status,
      display_name: "Apples",
      description: null,
      ingredients_summary: null,
      preparation_summary: null,
      rehydration_instructions: null,
      serving_notes: null,
      net_weight_display: null,
      fresh_equivalent_display: null,
      created_at: "2026-07-08T00:00:00.000Z",
      updated_at: "2026-07-08T00:00:00.000Z",
      print_events: [],
    },
  };
}
