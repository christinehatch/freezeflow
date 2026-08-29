import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("creates and archives a Storage Location", async ({ page }) => {
  let locations = [
    {
      id: "loc-basement",
      name: "Basement Bin A",
      notes: null,
      archived: false,
    },
  ];

  await page.route(`${API_BASE}/storage-locations**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        json: { success: true, data: locations, meta: {} },
      });
    }
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { name: string; notes?: string };
      const created = {
        id: `loc-${locations.length + 1}`,
        name: body.name,
        notes: body.notes ?? null,
        archived: false,
      };
      locations = [...locations, created];
      return route.fulfill({
        json: { success: true, data: created, meta: {} },
      });
    }
    return route.continue();
  });

  await page.route(`${API_BASE}/storage-locations/*/archive`, async (route) => {
    const id = route.request().url().split("/").at(-2);
    locations = locations.map((location) =>
      location.id === id ? { ...location, archived: true } : location,
    );
    const archived = locations.find((location) => location.id === id);
    return route.fulfill({
      json: { success: true, data: archived, meta: {} },
    });
  });

  await page.goto("/inventory/storage-locations");

  await expect(
    page.getByRole("heading", { name: "Storage Locations", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Basement Bin A")).toBeVisible();

  await page.getByLabel("Name").fill("Garage Shelf");
  await page.getByRole("button", { name: "Add Storage Location" }).click();

  await expect(page.getByText("Garage Shelf")).toBeVisible();

  await page
    .locator(".storage-location-card", { hasText: "Basement Bin A" })
    .getByRole("button", { name: "Archive" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Archived Storage Locations" }),
  ).toBeVisible();
});
