import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("switches between report types and renders their data", async ({
  page,
}) => {
  await page.route(`${API_BASE}/freeze-dryers**`, (route) =>
    route.fulfill({ json: { success: true, data: [], meta: {} } }),
  );
  await page.route(`${API_BASE}/preparation-presets**`, (route) =>
    route.fulfill({ json: { success: true, data: [], meta: {} } }),
  );
  await page.route(`${API_BASE}/production-batches**`, (route) =>
    route.fulfill({ json: { success: true, data: [], meta: {} } }),
  );
  await page.route(`${API_BASE}/reports/product-names**`, (route) =>
    route.fulfill({ json: { success: true, data: [], meta: {} } }),
  );
  await page.route(`${API_BASE}/reports/freeze-dryer-performance**`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            freeze_dryer_id: "fd-1",
            freeze_dryer_name: "Harvest Right #1",
            completed_production_batch_count: 12,
            average_dry_time_seconds: 3600 * 20,
            average_weight_loss_percent: "62.5",
            average_time_to_completion_seconds: 3600 * 22,
          },
        ],
        meta: {},
      },
    }),
  );
  await page.route(`${API_BASE}/reports/inventory-summary**`, (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          packages_in_storage: 40,
          packages_given_away: 5,
          packages_depleted: 3,
          total_packaged_weight_grams: "12000",
          total_dried_weight_grams: "12500",
          most_common_products: [
            { product_name: "Strawberries", package_count: 10 },
          ],
        },
        meta: {},
      },
    }),
  );

  await page.goto("/reports");

  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Harvest Right #1")).toBeVisible();
  await expect(page.getByText("12", { exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Report" }).click();
  await page.getByRole("option", { name: "Inventory Summary" }).click();

  await expect(
    page.getByRole("heading", { name: "Inventory Summary" }),
  ).toBeVisible();
  await expect(page.getByText("Strawberries")).toBeVisible();
});
