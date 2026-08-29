import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("creates and archives a Preparation Preset", async ({ page }) => {
  let presets = [
    {
      id: "preset-berries",
      name: "Mixed Berries",
      product_name: "Berries",
      ingredients: ["Strawberries", "Blueberries"],
      preparation_methods: ["Sliced"],
      notes: null,
      archived: false,
    },
  ];

  await page.route(`${API_BASE}/preparation-presets**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        json: { success: true, data: presets, meta: {} },
      });
    }
    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        product_name: string;
        ingredients: string[];
        preparation_methods: string[];
        notes?: string | null;
      };
      const created = {
        id: `preset-${presets.length + 1}`,
        name: body.name,
        product_name: body.product_name,
        ingredients: body.ingredients,
        preparation_methods: body.preparation_methods,
        notes: body.notes ?? null,
        archived: false,
      };
      presets = [...presets, created];
      return route.fulfill({
        json: { success: true, data: created, meta: {} },
      });
    }
    return route.continue();
  });

  await page.route(
    `${API_BASE}/preparation-presets/*/archive`,
    async (route) => {
      const id = route.request().url().split("/").at(-2);
      presets = presets.map((preset) =>
        preset.id === id ? { ...preset, archived: true } : preset,
      );
      const archived = presets.find((preset) => preset.id === id);
      return route.fulfill({
        json: { success: true, data: archived, meta: {} },
      });
    },
  );

  await page.route(`${API_BASE}/preparation-presets/suggestions**`, (route) =>
    route.fulfill({ json: { success: true, data: [], meta: {} } }),
  );

  await page.goto("/production/preparation-presets");

  await expect(
    page.getByRole("heading", { name: "Preparation Presets", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Mixed Berries")).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Peach Slices");
  await page.getByLabel("Product Name").fill("Peaches");
  const ingredientsInput = page.getByLabel("Ingredients");
  await ingredientsInput.fill("Peaches");
  await ingredientsInput.press("Enter");
  const methodsInput = page.getByLabel("Preparation Methods");
  await methodsInput.fill("Diced");
  await methodsInput.press("Enter");

  await page.getByRole("button", { name: "Add Preparation Preset" }).click();

  await expect(page.getByText("Peach Slices")).toBeVisible();

  await page
    .locator(".preparation-preset-card", { hasText: "Mixed Berries" })
    .getByRole("button", { name: "Archive" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Archived Preparation Presets" }),
  ).toBeVisible();
});
