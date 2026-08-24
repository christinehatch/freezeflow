import { expect, test, type Page } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:8001";

async function selectBatch(page: Page, batchNumber: string) {
  const batchSelect = page.getByLabel("Production Batch");
  const optionValue = await batchSelect
    .locator("option")
    .filter({ hasText: batchNumber })
    .getAttribute("value");

  expect(optionValue).not.toBeNull();
  await batchSelect.selectOption(optionValue!);
}

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
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "black has active Production Batch Batch 021.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Batch 020" })).toBeVisible();

  await page.getByRole("link", { name: "Packaging" }).click();
  await expect(
    page.getByRole("heading", { name: "Packaging Worksheet" }),
  ).toBeVisible();
  await selectBatch(page, "Batch 020");
  await expect(page.getByLabel("Production Batch")).toContainText(
    "875 g ready",
  );

  const firstPorkTray = page
    .locator("tr")
    .filter({ hasText: "Pork Shoulder" })
    .first();
  await firstPorkTray.getByRole("checkbox").check();

  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Create Packages" }),
  });
  await form.getByLabel("Finished Product Weight", { exact: true }).fill("328");
  await form.getByLabel("Sealed Package Weight", { exact: true }).fill("335");
  await form.getByRole("button", { name: "Finish Packaging" }).click();

  await expect(
    page.getByRole("heading", { name: "Packaging Complete" }),
  ).toBeVisible();
  await expect(page.getByText(/^PKG-/)).toBeVisible();

  await page.reload();
  await selectBatch(page, "Batch 020");
  await expect(page.getByLabel("Production Batch")).toContainText(
    "547 g ready",
  );
  await expect(
    page.locator("tr").filter({ hasText: "Pork Shoulder" }),
  ).toHaveCount(1);
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
  await expect(page.getByText("Basement Bin A")).toBeVisible();
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
