import { expect, type Page, test } from "@playwright/test";

import type {
  PackageLabel,
  PackageLabelPrintResult,
  PackagingAllocation,
  PackagingLoss,
  PackagingOperation,
  PackagingWorksheetItem,
  RecordAllocationPackagesResponse,
} from "../src/api/client";
import {
  createAllocationSourceTray,
  createPackagingAllocation,
  createPackagingOperation,
  createScenarioProductionBatch,
  createScenarioTray,
  noOperationPackagingScenario,
  savedPlanningPackagingScenario,
} from "./support/packagingScenarios";
import { mockFreezeflowApi } from "./support/mockApi";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("starts one Open operation, resumes it, and preserves it through an injected refresh failure", async ({
  page,
}) => {
  const scenario = noOperationPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const batchId = scenario.productionBatches[0].id;
  const path = `/production-batches/${batchId}/packaging-operation`;

  await page.goto("/freeze-dryers");

  const created = await apiRequest<PackagingOperation>(page, "POST", path, {
    notes: "Weekend packaging",
    started_at: "2026-07-18T09:30:00.000Z",
  });
  const resumed = await apiRequest<PackagingOperation>(page, "POST", path, {
    notes: "Ignored during resume",
  });

  expect(created.status).toBe(201);
  expect(resumed.data.id).toBe(created.data.id);
  expect(resumed.data.notes).toBe("Weekend packaging");
  expect(fakeBackend.packagingOperations).toHaveLength(1);
  expect(fakeBackend.startPackagingBodies).toHaveLength(2);

  fakeBackend.failNextPackagingRequest({
    method: "GET",
    path,
    status: 503,
    code: "PACKAGING_REFRESH_UNAVAILABLE",
    message: "Authoritative refresh is temporarily unavailable.",
  });
  const failedRefresh = await apiRequest<PackagingOperation>(page, "GET", path);

  expect(failedRefresh).toMatchObject({
    status: 503,
    body: {
      detail: {
        code: "PACKAGING_REFRESH_UNAVAILABLE",
        message: "Authoritative refresh is temporarily unavailable.",
      },
    },
  });
  expect(fakeBackend.packagingOperations[0].id).toBe(created.data.id);
  expect(
    (await apiRequest<PackagingOperation>(page, "GET", path)).data.id,
  ).toBe(created.data.id);
});

test("creates an Allocation and rejects duplicate, cross-Batch, and Packaged sources", async ({
  page,
}) => {
  const scenario = noOperationPackagingScenario();
  const firstBatch = scenario.productionBatches[0];
  const secondBatch = createScenarioProductionBatch({
    id: "batch-allocation-2",
    batch_number: "Batch Allocation 2",
    trays: [
      createScenarioTray({
        id: "tray-allocation-2",
        production_batch_id: "batch-allocation-2",
      }),
    ],
  });
  const packagedTray = createScenarioTray({
    id: "tray-already-packaged",
    production_batch_id: firstBatch.id,
    status: "Packaged",
  });
  firstBatch.trays.push(packagedTray);
  scenario.productionBatches.push(secondBatch);
  const fakeBackend = await mockFreezeflowApi(page, scenario);

  await page.goto("/freeze-dryers");

  const operation = (
    await apiRequest<PackagingOperation>(
      page,
      "POST",
      `/production-batches/${firstBatch.id}/packaging-operation`,
      {},
    )
  ).data;
  const allocationPath = `/packaging-operations/${operation.id}/allocate-trays`;

  expect(
    (
      await apiRequest(page, "POST", allocationPath, {
        tray_ids: [firstBatch.trays[0].id, firstBatch.trays[0].id],
      })
    ).body.detail.message,
  ).toBe("Select one or more unique source Trays.");
  expect(
    (
      await apiRequest(page, "POST", allocationPath, {
        tray_ids: [secondBatch.trays[0].id],
      })
    ).body.detail.code,
  ).toBe("PACKAGING_CROSS_BATCH");
  expect(
    (
      await apiRequest(page, "POST", allocationPath, {
        tray_ids: [packagedTray.id],
      })
    ).body.detail.message,
  ).toBe("Only Completed Trays may supply an Allocation.");

  const created = await apiRequest<PackagingAllocation>(
    page,
    "POST",
    allocationPath,
    { tray_ids: [firstBatch.trays[0].id], notes: "Chicken source" },
  );
  expect(created.status).toBe(201);
  expect(created.data).toMatchObject({
    selected_weight_grams: "240",
    allocated_weight_grams: "0",
    remaining_weight_grams: "240",
    source_trays: [{ id: firstBatch.trays[0].id }],
    packages: [],
  });

  const conflict = await apiRequest(page, "POST", allocationPath, {
    tray_ids: [firstBatch.trays[0].id],
  });
  expect(conflict.body.detail.code).toBe("PACKAGING_TRAY_CONFLICT");
  const worksheet = await apiRequest<PackagingWorksheetItem[]>(
    page,
    "GET",
    "/packaging/worksheet",
  );
  expect(
    worksheet.data.flatMap((item) =>
      item.eligible_trays.map((tray) => tray.id),
    ),
  ).not.toContain(firstBatch.trays[0].id);
  expect(fakeBackend.allocationCreateBodies).toHaveLength(5);
});

test("persists planned rows with stable identity and derives weights without Sealed Package Weight", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const operation = scenario.packagingOperations[0];
  const allocation = operation.allocations[0];
  const path = `/packaging-operations/${operation.id}/allocations/${allocation.id}`;

  await page.goto("/freeze-dryers");

  const saved = await apiRequest<PackagingAllocation>(page, "PATCH", path, {
    notes: "Two planned Packages",
    planned_packages: [
      {
        id: allocation.planned_packages[0].id,
        package_type_id: "package-type-1",
        finished_product_weight_grams: "100",
        sealed_package_weight_grams: "999",
        label_display_name: "First Taco Package",
      },
      {
        package_type_id: "package-type-1",
        finished_product_weight_grams: "140",
        sealed_package_weight_grams: "1",
        label_display_name: "Second Taco Package",
      },
    ],
  });

  expect(saved.data).toMatchObject({
    allocated_weight_grams: "240",
    remaining_weight_grams: "0",
  });
  expect(saved.data.planned_packages).toHaveLength(2);
  const createdRowId = saved.data.planned_packages[1].id;
  expect(fakeBackend.createdPackagingIds.plannedPackageRowIds).toEqual([
    createdRowId,
  ]);

  const restored = await apiRequest<PackagingOperation>(
    page,
    "GET",
    `/packaging-operations/${operation.id}`,
  );
  expect(restored.data.allocations[0].planned_packages[1].id).toBe(
    createdRowId,
  );
  expect(restored.data.allocations[0].planned_packages[0].created_at).toBe(
    allocation.planned_packages[0].created_at,
  );

  const beforeRejectedSave = JSON.stringify(fakeBackend.packagingOperations);
  const overallocated = await apiRequest(page, "PATCH", path, {
    planned_packages: [
      {
        id: allocation.planned_packages[0].id,
        package_type_id: "package-type-1",
        finished_product_weight_grams: "241",
        sealed_package_weight_grams: "250",
      },
    ],
  });
  expect(overallocated.body.detail.code).toBe("PACKAGING_OVERALLOCATED");
  expect(JSON.stringify(fakeBackend.packagingOperations)).toBe(
    beforeRejectedSave,
  );

  const removed = await apiRequest<PackagingAllocation>(page, "PATCH", path, {
    planned_packages: [saved.data.planned_packages[0]],
  });
  expect(removed.data.planned_packages.map((row) => row.id)).toEqual([
    allocation.planned_packages[0].id,
  ]);
});

test("records a planned Package, manages label readiness, and appends initial and reprint events", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const operation = scenario.packagingOperations[0];
  const allocation = operation.allocations[0];
  const plannedRow = allocation.planned_packages[0];
  const recordPath = `/packaging-operations/${operation.id}/allocations/${allocation.id}/packages`;

  await page.goto("/freeze-dryers");

  const recorded = await apiRequest<RecordAllocationPackagesResponse>(
    page,
    "POST",
    recordPath,
    { packages: [{ planned_package_row_id: plannedRow.id }] },
  );
  expect(recorded.status).toBe(201);
  const recordedPackage = recorded.data.packages[0];
  expect(recordedPackage).toMatchObject({
    packaging_allocation_id: allocation.id,
    packaging_operation_id: operation.id,
    status: "In Storage",
    storage_location: { name: "Unassigned" },
    label: { status: "Draft", display_name: "Taco Chicken" },
  });
  expect(
    recorded.data.packaging_operation.allocations[0].planned_packages[0]
      .recorded_package_id,
  ).toBe(recordedPackage.id);
  expect(
    recorded.data.packaging_operation.allocations[0].allocated_weight_grams,
  ).toBe("120");

  const duplicate = await apiRequest(page, "POST", recordPath, {
    packages: [{ planned_package_row_id: plannedRow.id }],
  });
  expect(duplicate.body.detail.code).toBe("PACKAGE_RECORDING_CONFLICT");
  expect(fakeBackend.createdPackagingIds.packageIds).toHaveLength(1);

  const recordedPlanEdit = await apiRequest(
    page,
    "PATCH",
    `/packaging-operations/${operation.id}/allocations/${allocation.id}`,
    {
      planned_packages: [
        { ...plannedRow, finished_product_weight_grams: "10" },
      ],
    },
  );
  expect(recordedPlanEdit.body.detail.message).toBe(
    "Recorded package plans cannot be edited.",
  );
  const recordedPlanRemoval = await apiRequest(
    page,
    "PATCH",
    `/packaging-operations/${operation.id}/allocations/${allocation.id}`,
    { planned_packages: [] },
  );
  expect(recordedPlanRemoval.body.detail.message).toBe(
    "Recorded package plans cannot be removed.",
  );

  const previewPath = "/package-labels/preview";
  const printPath = "/package-labels/print";
  const labelPath = `/packages/${recordedPackage.id}/label`;
  expect(
    (
      await apiRequest(page, "POST", previewPath, {
        package_label_ids: [recordedPackage.label.id],
      })
    ).body.detail.message,
  ).toContain("Draft Package Labels");
  expect(
    (
      await apiRequest(page, "POST", printPath, {
        package_label_ids: [recordedPackage.label.id],
      })
    ).body.detail.message,
  ).toContain("Draft Package Labels");
  expect(
    (
      await apiRequest(page, "PATCH", labelPath, {
        display_name: "   ",
      })
    ).body.detail.code,
  ).toBe("PACKAGE_LABEL_INVALID");

  const ready = await apiRequest<PackageLabel>(page, "PATCH", labelPath, {
    display_name: "Taco Dinner",
  });
  expect(ready.data.status).toBe("Ready");
  const beforePreview = JSON.stringify(fakeBackend.packagingOperations);
  const preview = await apiRequest<PackageLabel[]>(page, "POST", previewPath, {
    package_label_ids: [recordedPackage.label.id],
  });
  expect(preview.data[0].display_name).toBe("Taco Dinner");
  expect(JSON.stringify(fakeBackend.packagingOperations)).toBe(beforePreview);
  expect(
    (
      await apiRequest(page, "POST", previewPath, {
        package_label_ids: [recordedPackage.label.id, recordedPackage.label.id],
      })
    ).body.detail.message,
  ).toBe("Select each Package Label only once.");

  const initialPrint = await apiRequest<PackageLabelPrintResult>(
    page,
    "POST",
    printPath,
    { package_label_ids: [recordedPackage.label.id], template: "Avery 5163" },
  );
  expect(initialPrint.data.labels[0].print_events).toHaveLength(1);
  const edited = await apiRequest<PackageLabel>(page, "PATCH", labelPath, {
    display_name: "Updated Taco Dinner",
  });
  expect(edited.data.status).toBe("Needs Reprint");
  const reprint = await apiRequest<PackageLabelPrintResult>(
    page,
    "POST",
    printPath,
    { package_label_ids: [recordedPackage.label.id], template: "Avery 5163" },
  );
  expect(reprint.data.labels[0].status).toBe("Ready");
  expect(reprint.data.labels[0].print_events).toHaveLength(2);
  expect(
    new Set(reprint.data.labels[0].print_events.map((event) => event.id)).size,
  ).toBe(2);
});

test("keeps rejected mutations atomic and allows a persisted save followed by a failed refresh", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const operation = scenario.packagingOperations[0];
  const allocation = operation.allocations[0];
  const path = `/packaging-operations/${operation.id}/allocations/${allocation.id}`;

  await page.goto("/freeze-dryers");

  const beforeFailure = JSON.stringify(fakeBackend.packagingOperations);
  fakeBackend.failNextPackagingRequest({
    method: "PATCH",
    path,
    status: 409,
    code: "PACKAGING_SAVE_CONFLICT",
    message: "The Allocation changed before it was saved.",
    errors: [{ allocation_id: allocation.id }],
  });
  const rejected = await apiRequest(page, "PATCH", path, {
    notes: "Must not persist",
  });
  expect(rejected).toMatchObject({
    status: 409,
    body: {
      detail: {
        code: "PACKAGING_SAVE_CONFLICT",
        errors: [{ allocation_id: allocation.id }],
      },
    },
  });
  expect(JSON.stringify(fakeBackend.packagingOperations)).toBe(beforeFailure);

  const saved = await apiRequest<PackagingAllocation>(page, "PATCH", path, {
    notes: "Persisted before refresh",
  });
  expect(saved.status).toBe(200);
  fakeBackend.failNextPackagingRequest({
    method: "GET",
    path: `/packaging-operations/${operation.id}`,
    status: 503,
    message: "Refresh unavailable",
  });
  expect(
    (await apiRequest(page, "GET", `/packaging-operations/${operation.id}`))
      .status,
  ).toBe(503);
  expect(fakeBackend.packagingOperations[0].allocations[0].notes).toBe(
    "Persisted before refresh",
  );
});

test("enforces completion blockers and preserves successful completion as read-only history", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const operation = scenario.packagingOperations[0];
  const allocation = operation.allocations[0];
  const allocationPath = `/packaging-operations/${operation.id}/allocations/${allocation.id}`;
  const completionPath = `/packaging-operations/${operation.id}/complete`;

  await page.goto("/freeze-dryers");

  const blocked = await apiRequest(page, "POST", completionPath, {});
  expect(blocked.body.detail.message).toBe(
    "Every Allocation requires at least one Package or Packaging Loss.",
  );

  const planned = await apiRequest<PackagingAllocation>(
    page,
    "PATCH",
    allocationPath,
    {
      planned_packages: [
        {
          id: allocation.planned_packages[0].id,
          package_type_id: "package-type-1",
          finished_product_weight_grams: "240",
          sealed_package_weight_grams: "248",
          label_display_name: "Completion Taco Dinner",
        },
      ],
    },
  );
  const recorded = await apiRequest<RecordAllocationPackagesResponse>(
    page,
    "POST",
    `${allocationPath}/packages`,
    {
      packages: [
        { planned_package_row_id: planned.data.planned_packages[0].id },
      ],
    },
  );
  const recordedPackage = recorded.data.packages[0];
  expect(
    (await apiRequest(page, "POST", completionPath, {})).body.detail.message,
  ).toBe("Every Package Label must be Ready before completion.");
  await apiRequest(page, "PATCH", `/packages/${recordedPackage.id}/label`, {
    display_name: "Completion Taco Dinner",
  });

  const completed = await apiRequest<PackagingOperation>(
    page,
    "POST",
    completionPath,
    { completed_at: "2026-07-18T12:00:00.000Z" },
  );
  expect(completed.data).toMatchObject({
    status: "Completed",
    completed_at: "2026-07-18T12:00:00.000Z",
    allocations: [
      {
        remaining_weight_grams: "0",
        source_trays: [{ status: "Packaged" }],
        packages: [{ status: "In Storage" }],
      },
    ],
  });
  const restored = await apiRequest<PackagingOperation>(
    page,
    "GET",
    `/packaging-operations/${operation.id}`,
  );
  expect(restored.data).toEqual(completed.data);
  expect((await apiRequest(page, "POST", completionPath, {})).status).toBe(400);
  expect(
    (
      await apiRequest(page, "PATCH", `/packages/${recordedPackage.id}/label`, {
        display_name: "Forbidden edit",
      })
    ).status,
  ).toBe(400);
  expect(
    (await apiRequest(page, "PATCH", allocationPath, { notes: "Forbidden" }))
      .status,
  ).toBe(400);
  expect(fakeBackend.packagingCompleteBodies).toHaveLength(4);
});

test("records a Packaging Loss that fully accounts for an Allocation and unblocks completion", async ({
  page,
}) => {
  const batch = createScenarioProductionBatch();
  const sourceTray = createAllocationSourceTray({
    id: batch.trays[0].id,
    production_batch_id: batch.id,
  });
  const allocation = createPackagingAllocation({ source_trays: [sourceTray] });
  const operation = createPackagingOperation({
    production_batch_id: batch.id,
    allocations: [allocation],
  });
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [batch],
    packagingOperations: [operation],
  });
  const lossPath = `/packaging-operations/${operation.id}/allocations/${allocation.id}/losses`;
  const completionPath = `/packaging-operations/${operation.id}/complete`;

  await page.goto("/freeze-dryers");

  const blocked = await apiRequest(page, "POST", completionPath, {});
  expect(blocked.body.detail.message).toBe(
    "Every Allocation requires at least one Package or Packaging Loss.",
  );

  const rejectedDetail = await apiRequest(page, "POST", lossPath, {
    weight_grams: "10",
    reason: "Sampled",
    reason_detail: "Should be rejected.",
  });
  expect(rejectedDetail.status).toBe(400);
  expect(rejectedDetail.body.detail.message).toBe(
    "Reason detail is only accepted when reason is Other.",
  );

  const exceedsRemaining = await apiRequest(page, "POST", lossPath, {
    weight_grams: "999",
    reason: "Spilled",
  });
  expect(exceedsRemaining.status).toBe(400);

  const recorded = await apiRequest<{
    packaging_loss: PackagingLoss;
    packaging_operation: PackagingOperation;
  }>(page, "POST", lossPath, {
    weight_grams: "240",
    reason: "Crumbs",
  });
  expect(recorded.status).toBe(201);
  expect(recorded.data.packaging_loss).toMatchObject({
    weight_grams: "240",
    reason: "Crumbs",
    reason_detail: null,
  });
  const updatedAllocation = recorded.data.packaging_operation.allocations[0];
  expect(updatedAllocation.remaining_weight_grams).toBe("0");
  expect(updatedAllocation.packaging_losses).toHaveLength(1);

  const completed = await apiRequest<PackagingOperation>(
    page,
    "POST",
    completionPath,
    {},
  );
  expect(completed.status).toBe(200);
  expect(completed.data.status).toBe("Completed");
  expect(completed.data.allocations[0].packages).toHaveLength(0);
  expect(completed.data.allocations[0].packaging_losses).toHaveLength(1);
  expect(fakeBackend.packagingLossBodies).toHaveLength(3);
});

async function apiRequest<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
) {
  return page.evaluate(
    async ({ url, requestMethod, requestBody }) => {
      const response = await fetch(url, {
        method: requestMethod,
        headers:
          requestBody === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body:
          requestBody === undefined ? undefined : JSON.stringify(requestBody),
      });
      const responseBody = (await response.json()) as {
        data?: unknown;
        detail?: {
          code?: string;
          message?: string;
          errors?: unknown[];
        };
      };
      return {
        status: response.status,
        data: responseBody.data as T,
        body: responseBody,
      };
    },
    {
      url: `${API_BASE}${path}`,
      requestMethod: method,
      requestBody: body,
    },
  );
}
