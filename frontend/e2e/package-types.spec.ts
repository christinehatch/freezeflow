import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";

test("creates and archives a Package Type", async ({ page }) => {
  let packageTypes = [
    {
      id: "pt-quart-mylar",
      name: "Quart Mylar",
      default_oxygen_absorber: "300cc",
      default_label_template: "Standard",
      notes: null,
      archived: false,
    },
  ];
  let lastArchivePatchBody: { archived?: boolean } | null = null;

  await page.route(`${API_BASE}/package-types**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return route.fulfill({
        json: { success: true, data: packageTypes, meta: {} },
      });
    }
    if (request.method() === "POST") {
      const body = request.postDataJSON() as {
        name: string;
        default_oxygen_absorber?: string | null;
        default_label_template?: string | null;
        notes?: string | null;
      };
      const created = {
        id: `pt-${packageTypes.length + 1}`,
        name: body.name,
        default_oxygen_absorber: body.default_oxygen_absorber ?? null,
        default_label_template: body.default_label_template ?? null,
        notes: body.notes ?? null,
        archived: false,
      };
      packageTypes = [...packageTypes, created];
      return route.fulfill({
        json: { success: true, data: created, meta: {} },
      });
    }
    return route.continue();
  });

  await page.route(`${API_BASE}/package-types/*`, async (route) => {
    const request = route.request();
    if (request.method() !== "PATCH") {
      return route.continue();
    }
    const id = request.url().split("/").at(-1);
    const body = request.postDataJSON() as { archived?: boolean };
    lastArchivePatchBody = body;
    packageTypes = packageTypes.map((packageType) =>
      packageType.id === id
        ? { ...packageType, archived: body.archived ?? packageType.archived }
        : packageType,
    );
    const updated = packageTypes.find((packageType) => packageType.id === id);
    return route.fulfill({
      json: { success: true, data: updated, meta: {} },
    });
  });

  await page.goto("/packaging/package-types");

  await expect(
    page.getByRole("heading", { name: "Package Types", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Quart Mylar")).toBeVisible();

  await page.getByLabel("Name").fill("Half-Gallon Mylar");
  await page.getByLabel("Default Oxygen Absorber").fill("2000cc");
  await page.getByRole("button", { name: "Add Package Type" }).click();

  await expect(page.getByText("Half-Gallon Mylar")).toBeVisible();
  await expect(page.getByText("2000cc")).toBeVisible();

  await page
    .locator(".package-type-card", { hasText: "Quart Mylar" })
    .getByRole("button", { name: "Archive" })
    .click();

  await expect.poll(() => lastArchivePatchBody).toEqual({ archived: true });
});
