import { expect, test } from "@playwright/test";

import {
  createDryingRun,
  createFreezeDryer,
  createProductionBatch,
  createTray,
  mockFreezeflowApi,
} from "./support/mockApi";

test("shows the calm Dashboard and preserves creation navigation", async ({
  page,
}) => {
  const black = createFreezeDryer({ id: "black", name: "Black" });
  const white = createFreezeDryer({ id: "white", name: "White" });
  await mockFreezeflowApi(page, {
    freezeDryers: [black, white],
    physicalTrays: [],
    productionBatches: [],
    packagingWorksheet: [],
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "No production is running" }),
  ).toBeVisible();
  await expect(page.getByText("All clear")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "+ New Production Batch" }),
  ).toHaveCount(1);

  await page.getByRole("link", { name: "+ New Production Batch" }).click();
  await expect(page).toHaveURL(/\/production$/);
});

test("shows a contextual attention hero and stacks Freeze Dryers on mobile", async ({
  page,
}) => {
  const black = createFreezeDryer({ id: "black", name: "Black" });
  const white = createFreezeDryer({ id: "white", name: "White" });
  const runningTray = createTray({
    production_batch_id: "batch-running",
    status: "Running",
    final_dry_weight_grams: null,
    completed_at: null,
    tray_slot: black.tray_slots[0],
  });
  const runningBatch = createProductionBatch({
    id: "batch-running",
    batch_number: "Batch 007",
    status: "Running",
    completed_at: null,
    freeze_dryer: black,
    freeze_dryer_id: black.id,
    trays: [runningTray],
    drying_runs: [
      createDryingRun({
        id: "drying-run-complete",
        production_batch_id: "batch-running",
        status: "Complete",
        ended_at: "2026-07-22T18:00:00.000Z",
        duration_seconds: 36_000,
      }),
    ],
  });
  await mockFreezeflowApi(page, {
    freezeDryers: [black, white],
    physicalTrays: [],
    productionBatches: [runningBatch],
    packagingWorksheet: [],
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Batch 007 is ready for Weight Checks",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Record Weight Checks" }),
  ).toHaveAttribute("href", "/production/batch-running");

  const cards = page.locator(".ds-freeze-dryer-card");
  await expect(cards).toHaveCount(2);
  const firstCard = await cards.nth(0).boundingBox();
  const secondCard = await cards.nth(1).boundingBox();
  expect(firstCard).not.toBeNull();
  expect(secondCard).not.toBeNull();
  expect(secondCard!.y).toBeGreaterThan(firstCard!.y + firstCard!.height);
});
