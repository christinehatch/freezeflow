import { afterEach, describe, expect, it, vi } from "vitest";

import {
  Package,
  PackageLabel,
  PackagingAllocation,
  PackagingOperation,
  PlannedPackageRow,
  PrintEvent,
  packagingApi,
} from "../api/client";

const printEvent: PrintEvent = {
  id: "print-event-1",
  package_label_id: "label-1",
  printed_at: "2026-07-18T10:05:00Z",
  recorded_at: "2026-07-18T10:05:01Z",
  template: "avery-5163",
  print_job_id: "print-job-1",
  notes: null,
};

const packageLabel: PackageLabel = {
  id: "label-1",
  package_id: "package-1",
  status: "Ready",
  display_name: "Taco Chicken",
  description: null,
  ingredients_summary: "Chicken, salt, pepper",
  preparation_summary: "Cubed and seasoned",
  rehydration_instructions: null,
  serving_notes: null,
  net_weight_display: "8.2 oz",
  fresh_equivalent_display: "2.05 lb fresh",
  created_at: "2026-07-18T10:00:00Z",
  updated_at: "2026-07-18T10:00:00Z",
  print_events: [printEvent],
};

const plannedPackage: PlannedPackageRow = {
  id: "planned-package-1",
  packaging_allocation_id: "allocation-1",
  package_type_id: "package-type-1",
  finished_product_weight_grams: "232.5",
  finished_product_weight_unit: "g",
  sealed_package_weight_grams: "246.6",
  sealed_package_weight_unit: "g",
  oxygen_absorber: "500cc",
  storage_location_id: "location-1",
  notes: "Planned before sealing",
  label_status: "Ready",
  label_display_name: "Taco Chicken",
  label_description: null,
  label_ingredients_summary: "Chicken, salt, pepper",
  label_preparation_summary: "Cubed and seasoned",
  label_rehydration_instructions: null,
  label_serving_notes: null,
  label_net_weight_display: "8.2 oz",
  label_fresh_equivalent_display: "2.05 lb fresh",
  recorded_package_id: "package-1",
  created_at: "2026-07-18T09:30:00Z",
  updated_at: "2026-07-18T10:00:00Z",
};

const packageItem: Package = {
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
  packaged_at: "2026-07-18T10:00:00Z",
  package_weight_grams: "246.6",
  finished_product_weight_grams: "232.5",
  oxygen_absorber: "500cc",
  storage_location_id: "location-1",
  storage_location: {
    id: "location-1",
    name: "Unassigned",
    notes: null,
    archived: false,
  },
  status: "In Storage",
  notes: null,
  label: packageLabel,
};

const allocation: PackagingAllocation = {
  id: "allocation-1",
  packaging_operation_id: "operation-1",
  notes: "Chicken trays",
  created_at: "2026-07-18T09:00:00Z",
  updated_at: "2026-07-18T10:00:00Z",
  selected_weight_grams: "232.5",
  allocated_weight_grams: "232.5",
  total_recorded_loss_weight_grams: "0",
  remaining_weight_grams: "0",
  bagged_weight_grams: "232.5",
  remaining_to_bag_grams: "0",
  packaging_losses: [],
  source_trays: [
    {
      id: "tray-1",
      production_batch_id: "batch-1",
      tray_slot_id: "slot-1",
      slot_number: 1,
      physical_tray_id: "physical-tray-1",
      physical_tray_label: "Tray 1",
      product_name: "Taco Chicken",
      preparation: "Cubed and seasoned",
      final_dry_weight_grams: "232.5",
      notes: null,
      status: "Completed",
    },
  ],
  planned_packages: [plannedPackage],
  packages: [packageItem],
};

const operation: PackagingOperation = {
  id: "operation-1",
  production_batch_id: "batch-1",
  status: "Open",
  started_at: "2026-07-18T09:00:00Z",
  completed_at: null,
  notes: null,
  created_at: "2026-07-18T09:00:00Z",
  updated_at: "2026-07-18T10:00:00Z",
  allocations: [allocation],
  packages: [packageItem],
};

const completedOperation: PackagingOperation = {
  ...operation,
  status: "Completed",
  completed_at: "2026-07-18T10:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("packagingApi refined workflow", () => {
  it("preserves nested Open and Completed operation detail responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(operation))
      .mockResolvedValueOnce(response(completedOperation));
    vi.stubGlobal("fetch", fetchMock);

    const openDetail = await packagingApi.getPackagingOperation("operation-1");
    const completedDetail =
      await packagingApi.getPackagingOperation("operation-1");

    expect(openDetail.status).toBe("Open");
    expect(openDetail.completed_at).toBeNull();
    expect(openDetail.allocations[0].source_trays[0]).toMatchObject({
      id: "tray-1",
      production_batch_id: "batch-1",
      physical_tray_id: "physical-tray-1",
    });
    expect(openDetail.allocations[0].planned_packages[0]).toMatchObject({
      id: "planned-package-1",
      recorded_package_id: "package-1",
      label_status: "Ready",
    });
    expect(openDetail.allocations[0].planned_packages[0].id).not.toBe(
      openDetail.allocations[0].packages[0].id,
    );
    expect(openDetail.packages[0].label.print_events[0]).toEqual(printEvent);

    expect(completedDetail.status).toBe("Completed");
    expect(completedDetail.completed_at).toBe("2026-07-18T10:00:00Z");
    expect(completedDetail.allocations[0].source_trays).toHaveLength(1);
    expect(completedDetail.allocations[0].planned_packages).toHaveLength(1);
    expect(completedDetail.packages[0].label.status).toBe("Ready");
  });

  it("uses the documented operation, allocation, package, and label routes", async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ url, method, body });

        if (url.endsWith("/allocate-trays")) {
          return response(allocation);
        }
        if (url.endsWith("/allocations/allocation-1/packages")) {
          return response({
            packages: [packageItem],
            packaging_operation: operation,
          });
        }
        if (url.endsWith("/packages/package-1/label")) {
          return response(packageLabel);
        }
        if (url.endsWith("/package-labels/preview")) {
          return response([packageLabel]);
        }
        if (url.endsWith("/package-labels/print")) {
          return response({
            print_job_id: "print-job-1",
            labels: [packageLabel],
          });
        }
        return response(operation);
      }),
    );

    await packagingApi.startOrResumePackagingOperation({
      batchId: "batch-1",
      body: { notes: "Packaging today" },
    });
    await packagingApi.getBatchPackagingOperation("batch-1");
    await packagingApi.getPackagingOperation("operation-1");
    await packagingApi.createPackagingAllocation({
      operationId: "operation-1",
      body: { tray_ids: ["tray-1"], notes: "Chicken trays" },
    });
    await packagingApi.updatePackagingAllocation({
      operationId: "operation-1",
      allocationId: "allocation-1",
      body: { planned_packages: [{ label_display_name: "Taco Chicken" }] },
    });
    await packagingApi.recordAllocationPackages({
      operationId: "operation-1",
      allocationId: "allocation-1",
      body: {
        packages: [
          {
            package_type_id: "package-type-1",
            finished_product_weight_grams: "232.5",
            sealed_package_weight_grams: "246.6",
          },
        ],
      },
    });
    await packagingApi.completePackagingOperation({
      operationId: "operation-1",
      body: { completed_at: "2026-07-18T10:00:00Z" },
    });
    await packagingApi.getPackage("package-1");
    await packagingApi.getPackageLabel("package-1");
    await packagingApi.updatePackageLabel({
      packageId: "package-1",
      body: { status: "Needs Reprint", display_name: "Martin's Taco Meal" },
    });
    await packagingApi.previewPackageLabels({ package_label_ids: ["label-1"] });
    await packagingApi.printPackageLabels({
      package_label_ids: ["label-1"],
      template: "avery-5163",
    });

    expect(requests).toEqual([
      request("/production-batches/batch-1/packaging-operation", "POST", {
        notes: "Packaging today",
      }),
      request("/production-batches/batch-1/packaging-operation", "GET"),
      request("/packaging-operations/operation-1", "GET"),
      request("/packaging-operations/operation-1/allocate-trays", "POST", {
        tray_ids: ["tray-1"],
        notes: "Chicken trays",
      }),
      request(
        "/packaging-operations/operation-1/allocations/allocation-1",
        "PATCH",
        { planned_packages: [{ label_display_name: "Taco Chicken" }] },
      ),
      request(
        "/packaging-operations/operation-1/allocations/allocation-1/packages",
        "POST",
        {
          packages: [
            {
              package_type_id: "package-type-1",
              finished_product_weight_grams: "232.5",
              sealed_package_weight_grams: "246.6",
            },
          ],
        },
      ),
      request("/packaging-operations/operation-1/complete", "POST", {
        completed_at: "2026-07-18T10:00:00Z",
      }),
      request("/packages/package-1", "GET"),
      request("/packages/package-1/label", "GET"),
      request("/packages/package-1/label", "PATCH", {
        status: "Needs Reprint",
        display_name: "Martin's Taco Meal",
      }),
      request("/package-labels/preview", "POST", {
        package_label_ids: ["label-1"],
      }),
      request("/package-labels/print", "POST", {
        package_label_ids: ["label-1"],
        template: "avery-5163",
      }),
    ]);
  });

  it("preserves structured backend validation errors", async () => {
    const detail = {
      code: "packaging_operation_incomplete",
      message: "Every allocation must have zero remaining weight.",
      errors: [
        { allocation_id: "allocation-1", remaining_weight_grams: "12.5" },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const result = packagingApi.completePackagingOperation({
      operationId: "operation-1",
      body: {},
    });

    await expect(result).rejects.toMatchObject({
      status: 422,
      code: "packaging_operation_incomplete",
      detail,
      body: { detail },
      message: "Every allocation must have zero remaining weight.",
    });
  });
});

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function request(path: string, method: string, body?: unknown) {
  return {
    url: `http://127.0.0.1:8000/api/v1${path}`,
    method,
    body,
  };
}
