import { expect, type Page, test } from "@playwright/test";

import {
  createStorageLocation,
  mockFreezeflowApi,
  type MockApiOptions,
} from "./support/mockApi";
import {
  createPackageLabel,
  createPackagingAllocation,
  createPackagingOperation,
  createRecordedPackage,
  createScenarioProductionBatch,
} from "./support/packagingScenarios";

function inventoryScenario(): MockApiOptions {
  const binA = createStorageLocation({ id: "storage-bin-a", name: "Bin A" });
  const binC = createStorageLocation({ id: "storage-bin-c", name: "Bin C" });
  const oldFreezer = createStorageLocation({
    id: "storage-old-freezer",
    name: "Old Freezer",
    archived: true,
  });
  const unassigned = createStorageLocation();

  const chickenOne = createRecordedPackage({
    id: "package-chicken-1",
    package_identifier: "PKG-2026-000101",
    packaged_at: "2026-05-03T00:00:00.000Z",
    storage_location: binA,
    storage_location_id: binA.id,
    label: createPackageLabel({
      id: "label-chicken-1",
      package_id: "package-chicken-1",
      status: "Ready",
      display_name: "Chicken",
    }),
  });
  const chickenTwo = createRecordedPackage({
    id: "package-chicken-2",
    package_identifier: "PKG-2026-000102",
    packaged_at: "2026-07-18T00:00:00.000Z",
    storage_location: binC,
    storage_location_id: binC.id,
    label: createPackageLabel({
      id: "label-chicken-2",
      package_id: "package-chicken-2",
      status: "Ready",
      display_name: "Chicken",
    }),
  });
  const strawberries = createRecordedPackage({
    id: "package-strawberries-1",
    package_identifier: "PKG-2026-000103",
    packaged_at: "2026-06-01T00:00:00.000Z",
    storage_location: binA,
    storage_location_id: binA.id,
    label: createPackageLabel({
      id: "label-strawberries-1",
      package_id: "package-strawberries-1",
      status: "Ready",
      display_name: "Strawberries",
    }),
  });

  const batch = createScenarioProductionBatch();
  const operation = createPackagingOperation({
    production_batch_id: batch.id,
    allocations: [
      createPackagingAllocation({
        packages: [chickenOne, chickenTwo, strawberries],
      }),
    ],
  });

  return {
    productionBatches: [batch],
    packagingOperations: [operation],
    storageLocations: [unassigned, binA, binC, oldFreezer],
  };
}

test("locates food by Product, opens a group, and finds an individual Package", async ({
  page,
}) => {
  await mockFreezeflowApi(page, inventoryScenario());

  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();

  const chickenGroup = page
    .getByRole("button")
    .filter({ has: page.getByText("Chicken", { exact: true }) });
  await expect(chickenGroup).toContainText("2 Packages");
  await expect(chickenGroup).toContainText("Bin A, Bin C");
  await expect(chickenGroup).toContainText("Oldest May 3, 2026");
  await expect(
    page.getByRole("button").filter({ hasText: "Strawberries" }),
  ).toContainText("1 Package");

  await chickenGroup.click();
  await expect(page.getByText("Chicken · 2 Packages")).toBeVisible();
  await expect(
    page.getByText("PKG-2026-000101", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("PKG-2026-000102", { exact: false }),
  ).toBeVisible();
});

test("moves a Package and sees its updated location and history", async ({
  page,
}) => {
  const fakeBackend = await mockFreezeflowApi(page, inventoryScenario());

  await page.goto("/inventory");
  await page
    .getByPlaceholder("Product, Package, Storage Location…")
    .fill("PKG-2026-000101");
  await page.getByText("PKG-2026-000101", { exact: false }).click();

  await expect(
    page.getByRole("heading", { name: "Chicken", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "Bin A" }).first(),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Move to" }).click();
  await page.getByRole("option", { name: "Bin C" }).click();
  await page.getByRole("button", { name: "Move Package" }).click();

  await expect(page.getByText("Current Storage Location")).toBeVisible();
  await expect(
    page.locator("dd").filter({ hasText: "Bin C" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Moved to Bin C", { exact: false }),
  ).toBeVisible();

  expect(fakeBackend.movePackageBodies).toEqual([
    {
      packageId: "package-chicken-1",
      body: { storage_location_id: "storage-bin-c" },
    },
  ]);
});

test("marks Packages Given Away and Depleted, excluding both from the default view but finding them historically", async ({
  page,
}) => {
  await mockFreezeflowApi(page, inventoryScenario());

  await page.goto("/inventory");
  await page
    .getByPlaceholder("Product, Package, Storage Location…")
    .fill("PKG-2026-000101");
  await page.getByText("PKG-2026-000101", { exact: false }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark Given Away" }).click();
  await expect(page.getByText("Given Away", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mark Given Away" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark Depleted" })).toHaveCount(
    0,
  );

  await page.goto("/inventory");
  await page
    .getByPlaceholder("Product, Package, Storage Location…")
    .fill("PKG-2026-000102");
  await page.getByText("PKG-2026-000102", { exact: false }).click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Mark Depleted" }).click();
  await expect(page.getByText("Depleted", { exact: true })).toBeVisible();

  await page.goto("/inventory");
  await expect(
    page
      .getByRole("button")
      .filter({ has: page.getByText("Chicken", { exact: true }) }),
  ).toHaveCount(0);

  await page
    .getByPlaceholder("Product, Package, Storage Location…")
    .fill("Chicken");
  const statusSelect = page.getByRole("combobox", { name: "Status" });
  await statusSelect.click();
  await page.getByRole("option", { name: "Given Away" }).click();
  await expect(
    page.getByText("PKG-2026-000101", { exact: false }),
  ).toBeVisible();

  await statusSelect.click();
  await page.getByRole("option", { name: "Depleted" }).click();
  await expect(
    page.getByText("PKG-2026-000102", { exact: false }),
  ).toBeVisible();
});

test("opens Package Details and preserves Packaging-to-Production traceability", async ({
  page,
}) => {
  await mockFreezeflowApi(page, inventoryScenario());

  await page.goto("/inventory");
  await page
    .getByPlaceholder("Product, Package, Storage Location…")
    .fill("PKG-2026-000103");
  await page.getByText("PKG-2026-000103", { exact: false }).click();

  await expect(
    page.getByRole("heading", { name: "Strawberries" }),
  ).toBeVisible();
  await expect(page.getByText("Quart Mylar").first()).toBeVisible();
  await expect(
    page.getByText("Taco Chicken", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Batch Scenario 001", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Scenario Freeze Dryer", { exact: false }).first(),
  ).toBeVisible();
});

test("creates, archives, and restores a Storage Location from Inventory", async ({
  page,
}) => {
  await mockFreezeflowApi(page, inventoryScenario());

  await page.goto("/inventory");
  await page.getByRole("link", { name: "Storage Locations" }).click();
  await expect(
    page.getByRole("heading", { name: "Storage Locations", exact: true }),
  ).toBeVisible();

  await page.getByLabel("Name").fill("Garage Freezer");
  await page.getByLabel("Notes").fill("New chest freezer");
  await page.getByRole("button", { name: "Add Storage Location" }).click();

  const card = cardFor(page, "Garage Freezer");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Archive" }).click();

  await expect(
    page.getByRole("heading", { name: "Archived Storage Locations" }),
  ).toBeVisible();
  const archivedCard = cardFor(page, "Garage Freezer");
  await expect(archivedCard).toBeVisible();
  await archivedCard.getByRole("button", { name: "Restore" }).click();

  await expect(card).toBeVisible();
  await expect(
    page
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Archived Storage Locations" }),
      })
      .getByText("Garage Freezer"),
  ).toHaveCount(0);
});

function cardFor(page: Page, name: string) {
  return page
    .locator(".storage-location-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}
