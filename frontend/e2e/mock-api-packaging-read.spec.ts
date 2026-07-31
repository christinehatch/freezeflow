import { expect, type Page, test } from "@playwright/test";

import type {
  FreezeDryer,
  Package,
  PackageLabel,
  PackageType,
  PackagingOperation,
  PackagingWorksheetItem,
  ProductionBatch,
  StorageLocation,
} from "../src/api/client";

import {
  completedPackagingScenario,
  createScenarioTray,
  multiBatchPackagingScenario,
  noOperationPackagingScenario,
  savedPlanningPackagingScenario,
} from "./support/packagingScenarios";
import { mockFreezeflowApi } from "./support/mockApi";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("returns seeded Open Packaging work unchanged across authoritative reads", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const persistedBeforeReads = JSON.stringify(fakeBackend.packagingOperations);

  await page.goto("/freeze-dryers");

  const batchId = scenario.productionBatches[0].id;
  const operationId = scenario.packagingOperations[0].id;
  const firstByBatch = await apiGet<PackagingOperation>(
    page,
    `/production-batches/${batchId}/packaging-operation`,
  );
  const secondByBatch = await apiGet<PackagingOperation>(
    page,
    `/production-batches/${batchId}/packaging-operation`,
  );
  const byId = await apiGet<PackagingOperation>(
    page,
    `/packaging-operations/${operationId}`,
  );

  expect(firstByBatch.status).toBe(200);
  expect(secondByBatch.data).toEqual(firstByBatch.data);
  expect(byId.data).toEqual(firstByBatch.data);
  expect(firstByBatch.data).toMatchObject({
    id: operationId,
    production_batch_id: batchId,
    status: "Open",
    allocations: [
      {
        selected_weight_grams: "240",
        allocated_weight_grams: "120",
        remaining_weight_grams: "120",
        source_trays: [{ id: "tray-scenario-1" }],
        planned_packages: [
          {
            id: "planned-package-scenario-1",
            recorded_package_id: null,
            label_status: "Draft",
          },
        ],
        packages: [],
      },
    ],
    packages: [],
  });
  expect(JSON.stringify(fakeBackend.packagingOperations)).toBe(
    persistedBeforeReads,
  );
});

test("preserves Completed Package, label, and Print Event history after reload-style reads", async ({
  page,
}) => {
  const scenario = completedPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const operation = scenario.packagingOperations[0];
  const recordedPackage = operation.packages[0];

  await page.goto("/freeze-dryers");

  const firstOperation = await apiGet<PackagingOperation>(
    page,
    `/packaging-operations/${operation.id}`,
  );
  const packageDetail = await apiGet<Package>(
    page,
    `/packages/${recordedPackage.id}`,
  );
  const labelDetail = await apiGet<PackageLabel>(
    page,
    `/packages/${recordedPackage.id}/label`,
  );

  await page.reload();
  const resumedOperation = await apiGet<PackagingOperation>(
    page,
    `/production-batches/${operation.production_batch_id}/packaging-operation`,
  );

  expect(firstOperation.data).toEqual(resumedOperation.data);
  expect(resumedOperation.data).toMatchObject({
    status: "Completed",
    completed_at: "2026-07-18T10:30:00.000Z",
    allocations: [
      {
        remaining_weight_grams: "0",
        source_trays: [{ status: "Packaged" }],
      },
    ],
  });
  expect(packageDetail.data).toEqual(recordedPackage);
  expect(labelDetail.data).toMatchObject({
    id: recordedPackage.label.id,
    status: "Needs Reprint",
    print_events: [
      {
        id: "print-event-scenario-1",
        print_job_id: "print-job-scenario-1",
      },
    ],
  });
  expect(fakeBackend.packagingOperations[0].status).toBe("Completed");
});

test("isolates Production Batches and excludes allocated and Packaged Trays from discovery", async ({
  page,
}) => {
  const scenario = multiBatchPackagingScenario();
  scenario.productionBatches[0].trays.push(
    createScenarioTray({
      id: "tray-scenario-packaged",
      production_batch_id: scenario.productionBatches[0].id,
      status: "Packaged",
      product_name: "Historical Pears",
    }),
  );
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  const persistedBeforeReads = JSON.stringify({
    productionBatches: fakeBackend.productionBatches,
    packagingOperations: fakeBackend.packagingOperations,
  });

  await page.goto("/freeze-dryers");

  const worksheet = await apiGet<PackagingWorksheetItem[]>(
    page,
    "/packaging/worksheet",
  );
  const firstBatchOperation = await apiGet<PackagingOperation>(
    page,
    `/production-batches/${scenario.productionBatches[0].id}/packaging-operation`,
  );
  const secondBatchOperation = await apiGet<PackagingOperation>(
    page,
    `/production-batches/${scenario.productionBatches[1].id}/packaging-operation`,
  );

  expect(worksheet.data).toHaveLength(2);
  expect(worksheet.data[0].production_batch.id).toBe("batch-scenario-1");
  expect(worksheet.data[0].eligible_trays.map((tray) => tray.id)).toEqual([
    "tray-scenario-2",
  ]);
  expect(worksheet.data[0].source_weight_grams).toBe("180");
  expect(worksheet.data[1].production_batch.id).toBe("batch-scenario-2");
  expect(worksheet.data[1].eligible_trays.map((tray) => tray.id)).toEqual([
    "tray-scenario-3",
  ]);
  expect(firstBatchOperation.status).toBe(200);
  expect(firstBatchOperation.data.production_batch_id).toBe("batch-scenario-1");
  expect(secondBatchOperation.status).toBe(404);
  expect(
    JSON.stringify({
      productionBatches: fakeBackend.productionBatches,
      packagingOperations: fakeBackend.packagingOperations,
    }),
  ).toBe(persistedBeforeReads);
});

test("returns 404 only for missing Packaging Operations and preserves unrelated reads", async ({
  page,
}) => {
  const scenario = noOperationPackagingScenario();
  const fakeBackend = await mockFreezeflowApi(page, scenario);

  await page.goto("/freeze-dryers");

  const freezeDryers = await apiGet<FreezeDryer[]>(page, "/freeze-dryers");
  const productionBatches = await apiGet<ProductionBatch[]>(
    page,
    "/production-batches",
  );
  const packageTypes = await apiGet<PackageType[]>(page, "/package-types");
  const storageLocations = await apiGet<StorageLocation[]>(
    page,
    "/storage-locations",
  );
  const missingOperation = await apiGet<never>(
    page,
    `/production-batches/${scenario.productionBatches[0].id}/packaging-operation`,
  );

  expect(freezeDryers.status).toBe(200);
  expect(freezeDryers.data[0].name).toBe("black");
  expect(productionBatches.data).toEqual(scenario.productionBatches);
  expect(packageTypes.data).toHaveLength(2);
  expect(storageLocations.data).toHaveLength(2);
  expect(missingOperation).toMatchObject({
    status: 404,
    body: { detail: "Packaging Operation does not exist." },
  });
  expect(fakeBackend.packagingOperations).toEqual([]);
  expect(fakeBackend.packagingReadRequests).toEqual(
    expect.arrayContaining([
      { method: "GET", path: "/package-types" },
      { method: "GET", path: "/storage-locations" },
      {
        method: "GET",
        path: `/production-batches/${scenario.productionBatches[0].id}/packaging-operation`,
      },
    ]),
  );
});

async function apiGet<T>(page: Page, path: string) {
  return page.evaluate(async (url) => {
    const response = await fetch(url);
    const body = (await response.json()) as {
      data?: unknown;
      detail?: unknown;
    };
    return {
      status: response.status,
      data: body.data as T,
      body,
    };
  }, `${API_BASE}${path}`);
}
