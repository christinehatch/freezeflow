import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  createDryingRun,
  createFreezeDryer,
  createPhysicalTray,
  createProductionBatch,
  createTray,
  mockFreezeflowApi,
} from "./support/mockApi";

test("creates a draft batch, assigns trays into slots, and starts production", async ({
  page,
}) => {
  const fakeBackend = await mockFreezeflowApi(page, {
    freezeDryers: [createFreezeDryer()],
    physicalTrays: physicalTraySet(),
    productionBatches: [],
    packagingWorksheet: [],
  });

  await page.goto("/production");

  await page.getByLabel("Freeze Dryer").selectOption("freeze-dryer-1");
  await page.getByLabel("Batch Number").fill("Batch E2E 001");
  await page.getByLabel("Batch Notes").fill("browser setup smoke test");
  await page.getByRole("button", { name: "Create Draft" }).click();

  await expect(
    page.getByRole("heading", { name: "Batch E2E 001" }),
  ).toBeVisible();

  await fillSlotRow(page, "Slot 1", {
    physicalTrayId: "physical-tray-1",
    product: "Taco Chicken",
    preparation: "cubed, seasoned",
    startingWeight: "2.05",
    startingWeightUnit: "lb",
    notes: "fresh load",
  });

  await expect(
    slotRow(page, "Slot 2")
      .locator("select")
      .first()
      .locator('option[value="physical-tray-1"]'),
  ).toHaveCount(0);

  await fillSlotRow(page, "Slot 2", {
    physicalTrayId: "physical-tray-2",
    product: "Apples",
    preparation: "sliced",
    startingWeight: "1.74",
    startingWeightUnit: "lb",
    notes: "thin slices",
  });

  await expect(
    page.getByRole("button", { name: "Start Production Batch" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Start Production Batch" }).click();

  await expect(
    page.getByText("Production Batch setup is locked"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current Drying Run" }),
  ).toBeVisible();
  await expect(
    page.locator(".workspace-header").getByText("Running"),
  ).toBeVisible();

  expect(fakeBackend.createProductionBatchBodies).toEqual([
    {
      freeze_dryer_id: "freeze-dryer-1",
      batch_number: "Batch E2E 001",
      notes: "browser setup smoke test",
    },
  ]);
  expect(fakeBackend.addTrayBodies).toMatchObject([
    {
      batchId: "batch-1",
      body: {
        tray_slot_id: "freeze-dryer-1-slot-1",
        physical_tray_id: "physical-tray-1",
        product_name: "Taco Chicken",
        preparation: "cubed, seasoned",
        starting_weight_grams: "929.864",
        notes: "fresh load",
      },
    },
    {
      batchId: "batch-1",
      body: {
        tray_slot_id: "freeze-dryer-1-slot-2",
        physical_tray_id: "physical-tray-2",
        product_name: "Apples",
        preparation: "sliced",
        starting_weight_grams: "789.251",
        notes: "thin slices",
      },
    },
  ]);
  expect(fakeBackend.startProductionBatchIds).toEqual(["batch-1"]);
});

test("records drying progress, completes trays, and explicitly completes the batch", async ({
  page,
}) => {
  const runningBatch = createRunningBatch();
  const fakeBackend = await mockFreezeflowApi(page, {
    freezeDryers: [runningBatch.freeze_dryer],
    physicalTrays: physicalTraySet(),
    productionBatches: [runningBatch],
    packagingWorksheet: [],
  });

  await page.goto("/production/batch-1");

  await page.getByRole("button", { name: "Current Run Complete" }).click();
  await expect(
    page.getByRole("heading", { name: "Record Weight Checks" }),
  ).toBeVisible();
  await expect(
    page.getByText("Every Running Tray needs a Weight Check"),
  ).toBeVisible();

  await slotRow(page, "Slot 1")
    .getByRole("link", { name: "View Weight Check for Taco Chicken" })
    .click();
  await expect(page).toHaveURL(/#weight-check-tray-1$/);
  await expect(weightRow(page, "Taco Chicken")).toBeInViewport();

  await saveWeightCheck(page, "Taco Chicken", "8.4", "oz");
  const firstCompletionAction = weightRow(page, "Taco Chicken").getByRole(
    "button",
    { name: "Mark Complete" },
  );
  const completionActionBox = await firstCompletionAction.boundingBox();
  const viewport = page.viewportSize();
  expect(completionActionBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(
    completionActionBox!.x + completionActionBox!.width,
  ).toBeLessThanOrEqual(viewport!.width);
  await expect
    .poll(() =>
      page
        .locator("section", { hasText: "Record Weight Checks" })
        .evaluate((section) => section.scrollWidth <= section.clientWidth),
    )
    .toBe(true);
  await saveWeightCheck(page, "Apples", "8.8", "oz");

  const tacoWeightRow = weightRow(page, "Taco Chicken");
  await tacoWeightRow.getByRole("button", { name: "Correct" }).click();
  await tacoWeightRow.getByRole("spinbutton").first().fill("240");
  await selectWeightUnit(tacoWeightRow, "g");
  await tacoWeightRow
    .getByRole("textbox", { name: /^Correction reason/ })
    .fill("Wrong unit selected");
  await tacoWeightRow.getByRole("button", { name: "Save Correction" }).click();

  await expect(slotRow(page, "Slot 1").getByText("929.9 g")).toBeVisible();
  await expect(slotRow(page, "Slot 1").getByText("240 g")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Another Drying Run" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Start Another Drying Run" }).click();
  await expect(
    page.getByRole("heading", { name: "Current Drying Run" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Current Run Complete" }).click();
  await saveWeightCheck(page, "Taco Chicken", "8.2", "oz");
  await saveWeightCheck(page, "Apples", "8.7", "oz");

  await markTrayComplete(page, "Taco Chicken");
  await expect(
    weightRow(page, "Taco Chicken").getByText("Completed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start Another Drying Run" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "Start Another Drying Run" }).click();
  await page.getByRole("button", { name: "Current Run Complete" }).click();
  await expect(
    weightRow(page, "Taco Chicken").getByText("Completed", { exact: true }),
  ).toBeVisible();
  await saveWeightCheck(page, "Apples", "8.6", "oz");
  await markTrayComplete(page, "Apples");

  await expect(
    page.getByRole("heading", { name: "All Trays Complete" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete Batch" }).click();

  await expect(
    page.getByRole("heading", { name: "Drying Complete" }),
  ).toBeVisible();
  await expect(
    page.locator(".workspace-header").getByText("Completed"),
  ).toBeVisible();

  expect(fakeBackend.completeDryingRunIds).toHaveLength(3);
  expect(fakeBackend.weightCheckBodies).toHaveLength(5);
  expect(fakeBackend.weightCheckCorrectionBodies).toEqual([
    {
      weightCheckId: "tray-1-weight-check-1",
      body: {
        weight_grams: "240.000",
        reason: "Wrong unit selected",
      },
    },
  ]);
  expect(fakeBackend.completeTrayBodies).toEqual([
    {
      trayId: "tray-1",
      body: { final_dry_weight_grams: "232.466" },
    },
    {
      trayId: "tray-2",
      body: { final_dry_weight_grams: "243.806" },
    },
  ]);
  expect(fakeBackend.completeProductionBatchIds).toEqual(["batch-1"]);
});

test("completed production batches hand off eligible trays to Packaging", async ({
  page,
}) => {
  const runningBatch = createRunningBatch();
  await mockFreezeflowApi(page, {
    freezeDryers: [runningBatch.freeze_dryer],
    physicalTrays: physicalTraySet(),
    productionBatches: [runningBatch],
    packagingWorksheet: [],
  });

  await page.goto("/production/batch-1");

  await page.getByRole("button", { name: "Current Run Complete" }).click();
  await saveWeightCheck(page, "Taco Chicken", "8.2", "oz");
  await saveWeightCheck(page, "Apples", "8.6", "oz");
  await markTrayComplete(page, "Taco Chicken");
  await markTrayComplete(page, "Apples");
  await page.getByRole("button", { name: "Complete Batch" }).click();
  await expect(
    page.getByRole("heading", { name: "Drying Complete" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Start Packaging" }).click();

  await expect(
    page.getByRole("heading", { name: "Choose a batch" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/packaging\?batch=batch-1$/);
  await expect(
    page.getByRole("heading", { name: "Batch E2E 001" }),
  ).toBeVisible();
  await expect(page.getByLabel("Production Batch")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next — Choose trays" }),
  ).toBeVisible();
  await expect(page.getByText("Taco Chicken")).toHaveCount(0);
  await expect(page.getByText("Apples")).toHaveCount(0);
});

function physicalTraySet() {
  return [
    createPhysicalTray({
      id: "physical-tray-1",
      label: "Imported Tray 1",
    }),
    createPhysicalTray({
      id: "physical-tray-2",
      label: "Imported Tray 2",
    }),
    createPhysicalTray({
      id: "physical-tray-3",
      label: "Imported Tray 3",
    }),
  ];
}

function createRunningBatch() {
  const freezeDryer = createFreezeDryer();
  const trays = [
    createTray({
      id: "tray-1",
      production_batch_id: "batch-1",
      tray_slot: freezeDryer.tray_slots[0],
      tray_slot_id: freezeDryer.tray_slots[0].id,
      physical_tray_id: "physical-tray-1",
      physical_tray: createPhysicalTray({
        id: "physical-tray-1",
        label: "Imported Tray 1",
      }),
      product_name: "Taco Chicken",
      preparation: "cubed, seasoned",
      starting_weight_grams: "929.864",
      latest_weight_grams: "929.864",
      previous_weight_grams: null,
      final_dry_weight_grams: null,
      completed_at: null,
      status: "Running",
      weight_checks: [],
    }),
    createTray({
      id: "tray-2",
      production_batch_id: "batch-1",
      tray_slot: freezeDryer.tray_slots[1],
      tray_slot_id: freezeDryer.tray_slots[1].id,
      physical_tray_id: "physical-tray-2",
      physical_tray: createPhysicalTray({
        id: "physical-tray-2",
        label: "Imported Tray 2",
      }),
      product_name: "Apples",
      preparation: "sliced",
      starting_weight_grams: "789.254",
      latest_weight_grams: "789.254",
      previous_weight_grams: null,
      final_dry_weight_grams: null,
      completed_at: null,
      status: "Running",
      weight_checks: [],
    }),
  ];

  return createProductionBatch({
    id: "batch-1",
    freeze_dryer_id: freezeDryer.id,
    freeze_dryer: freezeDryer,
    batch_number: "Batch E2E 001",
    status: "Running",
    started_at: "2026-07-08T01:00:00.000Z",
    completed_at: null,
    notes: "drying workflow test",
    trays,
    drying_runs: [
      createDryingRun({
        id: "batch-1-drying-run-1",
        production_batch_id: "batch-1",
      }),
    ],
    total_drying_seconds: 0,
  });
}

async function fillSlotRow(
  page: Page,
  slot: string,
  values: {
    physicalTrayId: string;
    product: string;
    preparation: string;
    startingWeight: string;
    startingWeightUnit: string;
    notes: string;
  },
) {
  const row = slotRow(page, slot);
  await row.locator("select").first().selectOption(values.physicalTrayId);
  await row.locator("input").nth(0).fill(values.product);
  await row.locator("input").nth(1).fill(values.preparation);
  await row.locator("input").nth(2).fill(values.startingWeight);
  await row.locator("select").nth(1).selectOption(values.startingWeightUnit);
  await row.locator("input").nth(3).fill(values.notes);
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(row.getByText(values.product)).toBeVisible();
}

async function saveWeightCheck(
  page: Page,
  product: string,
  weight: string,
  unit: string,
) {
  const row = weightRow(page, product);
  await row.locator("input").first().fill(weight);
  await selectWeightUnit(row, unit);
  await row.getByRole("button", { name: "Save Weight" }).click();
  await expect(row.getByText("Mark Complete")).toBeVisible();
}

async function selectWeightUnit(row: Locator, unit: string) {
  await row.getByRole("combobox").click();
  await row.getByRole("option", { name: unit, exact: true }).click();
}

async function markTrayComplete(page: Page, product: string) {
  const row = weightRow(page, product);
  await row.getByRole("button", { name: "Mark Complete" }).click();
}

function slotRow(page: Page, slot: string) {
  return page.locator("tbody tr").filter({ hasText: slot }).first();
}

function weightRow(page: Page, product: string) {
  return page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Record Weight Checks" }),
    })
    .locator("article")
    .filter({ hasText: product });
}
