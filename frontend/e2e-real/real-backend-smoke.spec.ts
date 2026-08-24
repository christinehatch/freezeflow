import { expect, test } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8001";

test("persists a seeded production-to-packaging smoke path", async ({
  page,
  request,
}) => {
  const healthResponse = await request.get(`${API_BASE_URL}/api/v1/health`);
  expect(healthResponse.ok()).toBeTruthy();
  expect(await healthResponse.json()).toEqual({ status: "ok" });

  const seedResponse = await request.post(`${API_BASE_URL}/dev/demo/basic`);
  expect(seedResponse.ok()).toBeTruthy();
  const seedResult = await seedResponse.json();
  expect(seedResult.data.action).toBe("basic");
  expect(seedResult.data.counts.production_batches).toBe(4);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Batch 021 is currently drying" }),
  ).toBeVisible();
  await expect(page.getByText("Batch 021 · Black Freeze Dryer")).toBeVisible();
  await expect(page.getByRole("link", { name: "Batch 020" })).toBeVisible();

  await page.getByRole("link", { name: "Packaging" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a batch" }),
  ).toBeVisible();
  const batchCard = page.locator("article.packaging-batch-card");
  await expect(batchCard).toContainText("Batch 020");
  await expect(batchCard).toContainText(
    "Packaging is in progress. 1 additional Tray is ready (236 g).",
  );

  await page.getByRole("button", { name: "Next — Choose trays" }).click();

  // The seed pre-plans this Batch's allocation as two draft bags (Pork
  // Shoulder trays: 328 g + 311 g = 639 g). Drafts default their weight
  // unit to oz on load regardless of the persisted unit, so switch each
  // field to grams before filling to avoid a lossy oz round-trip.
  await expect(page.getByRole("heading", { name: "Bag 1" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Finished Product Weight unit" })
    .click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Finished Product Weight", exact: true })
    .fill("339");
  await page
    .getByRole("combobox", { name: "Sealed Package Weight unit" })
    .click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Sealed Package Weight", exact: true })
    .fill("345");
  await page.getByRole("button", { name: "Save Bag 1" }).click();

  await expect(
    page.getByRole("button", { name: "Add another bag" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add another bag" }).click();

  await expect(page.getByRole("heading", { name: "Bag 2" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Finished Product Weight unit" })
    .click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Finished Product Weight", exact: true })
    .fill("300");
  await page
    .getByRole("combobox", { name: "Sealed Package Weight unit" })
    .click();
  await page.getByRole("option", { name: "g", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Sealed Package Weight", exact: true })
    .fill("312");
  await page.getByRole("button", { name: "Save Bag 2" }).click();

  await expect(
    page.getByRole("heading", { name: "Do you have another bag to package?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "No more bags — Review" }).click();

  await expect(
    page.getByRole("heading", { name: "Let's approve the bags" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next — Finish" }).click();

  await expect(
    page.getByRole("button", { name: "Complete Packaging" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete Packaging" }).click();

  await expect(
    page.getByRole("heading", { name: "Packaging complete" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Review & labels/ }).click();
  await expect(
    page.locator("summary").filter({ hasText: /^PKG-/ }).first(),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose a batch" }),
  ).toBeVisible();
  await expect(batchCard).toContainText(
    "Packaging is complete. Open it to view the saved history.",
  );
});

test("persists a seeded Inventory move across a reload", async ({
  page,
  request,
}) => {
  const seedResponse = await request.post(`${API_BASE_URL}/dev/demo/basic`);
  expect(seedResponse.ok()).toBeTruthy();

  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: "Inventory", exact: true }),
  ).toBeVisible();

  const tacoChickenGroup = page
    .getByRole("button")
    .filter({ has: page.getByText("Taco Chicken", { exact: true }) });
  await expect(tacoChickenGroup).toContainText("Basement Bin A");
  await tacoChickenGroup.click();

  await page.getByText("PKG-2026-000001", { exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Taco Chicken", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Basement Bin A", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Batch 019", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Black", { exact: false }).first()).toBeVisible();

  await page.getByRole("combobox", { name: "Move to" }).click();
  await page.getByRole("option", { name: "Pantry Shelf" }).click();
  await page.getByRole("button", { name: "Move Package" }).click();

  await expect(
    page.getByText("Moved to Pantry Shelf", { exact: false }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.locator("dd").filter({ hasText: "Pantry Shelf" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("Moved to Pantry Shelf", { exact: false }),
  ).toBeVisible();

  await page
    .getByLabel("Primary navigation")
    .getByRole("link", { name: "Inventory", exact: true })
    .click();
  await expect(
    page
      .getByRole("button")
      .filter({ has: page.getByText("Taco Chicken", { exact: true }) }),
  ).toContainText("Pantry Shelf");
});
