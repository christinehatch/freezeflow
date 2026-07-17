import { expect, type Page, test } from "@playwright/test";

import { mockFreezeflowApi } from "./support/mockApi";

test("packages eligible same-batch trays and opens Avery labels", async ({
  page,
}) => {
  const fakeBackend = await mockFreezeflowApi(page);
  await stubLabelWindow(page);

  await page.goto("/packaging");

  await expect(
    page.getByRole("heading", { name: "Packaging Worksheet" }),
  ).toBeVisible();
  await expect(page.getByText("Taco Chicken")).toBeVisible();
  await expect(page.getByText("Apples")).toBeVisible();
  await expect(page.getByText("Skittles")).toHaveCount(0);
  await expect(page.getByText("Previously Packaged Pears")).toHaveCount(0);

  await rowFor(page, "Taco Chicken").getByRole("checkbox").check();
  await page.getByLabel("Production Batch").selectOption("batch-2");
  await expect(page.getByText("Skittles")).toBeVisible();
  await expect(page.getByText("Taco Chicken")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish Packaging" }),
  ).toBeDisabled();

  await page.getByLabel("Production Batch").selectOption("batch-1");
  await rowFor(page, "Taco Chicken").getByRole("checkbox").check();

  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Create Packages" }),
  });
  await form.getByLabel("Finished Product Weight", { exact: true }).fill("238.1");
  await form.getByLabel("Sealed Package Weight", { exact: true }).fill("246.6");
  await form.locator('input[placeholder="default"]').fill("750cc");

  await expect(
    page.getByText(/warning will not block Packaging/i),
  ).toBeVisible();

  await page.getByRole("button", { name: "Finish Packaging" }).click();

  await expect(
    page.getByRole("heading", { name: "Packaging Complete" }),
  ).toBeVisible();
  await expect(page.getByText("PKG-2026-000001")).toBeVisible();

  expect(fakeBackend.packageBodies).toHaveLength(1);
  expect(fakeBackend.packageBodies[0]).toMatchObject({
    tray_ids: ["tray-1"],
    packages: [
      {
        package_type_id: "package-type-1",
        finished_product_weight_grams: "238.100",
        package_weight_grams: "246.600",
        oxygen_absorber: "750cc",
        storage_location_id: null,
      },
    ],
  });
  expect(fakeBackend.packageBodies[0].packages[0]).not.toHaveProperty(
    "package_identifier",
  );

  await page.getByRole("button", { name: "Print Avery 5163 Labels" }).click();
  await expectOpenedLabelBlob(page);
  await expectLabelPdfText(page, [
    "2.05 lb fresh = 8.4 oz freeze-dried",
    "cubed, seasoned",
    "Jul 8, 2026",
  ]);
});

test("creates multiple packages from multiple trays in one browser flow", async ({
  page,
}) => {
  const fakeBackend = await mockFreezeflowApi(page);

  await page.goto("/packaging");

  await rowFor(page, "Taco Chicken").getByRole("checkbox").check();
  await rowFor(page, "Apples").getByRole("checkbox").check();
  await page.getByLabel("Package Count").fill("2");

  await expect(page.getByText("2 Trays mixed")).toBeVisible();
  const remainingCard = page.locator("div").filter({
    has: page.getByText("Remaining To Package", { exact: true }),
  }).last();
  await expect(remainingCard).toContainText("423.1 g");

  const form = page.locator("form").filter({
    has: page.getByRole("heading", { name: "Create Packages" }),
  });
  const packageRows = form.locator("tbody tr");
  await packageRows.nth(0).getByLabel("Finished Product Weight", { exact: true }).fill("200");
  await packageRows.nth(0).getByLabel("Sealed Package Weight", { exact: true }).fill("205");
  await packageRows.nth(1).getByLabel("Finished Product Weight", { exact: true }).fill("223.1");
  await packageRows.nth(1).getByLabel("Sealed Package Weight", { exact: true }).fill("228.1");
  await packageRows.nth(1).getByRole("combobox").nth(0).selectOption("package-type-2");
  await packageRows.nth(1).getByRole("combobox").nth(3).selectOption("storage-pantry");

  await expect(remainingCard).toContainText("0 g");

  await page.getByRole("button", { name: "Finish Packaging" }).click();

  await expect(page.getByText("Created 2 Packages.")).toBeVisible();
  await expect(page.getByText("PKG-2026-000001")).toBeVisible();
  await expect(page.getByText("PKG-2026-000002")).toBeVisible();

  expect(fakeBackend.packageBodies[0].tray_ids).toEqual(["tray-1", "tray-2"]);
  expect(fakeBackend.packageBodies[0].packages).toHaveLength(2);
  expect(fakeBackend.packageBodies[0].packages).toMatchObject([
    {
      finished_product_weight_grams: "200.000",
      package_weight_grams: "205.000",
    },
    {
      finished_product_weight_grams: "223.100",
      package_weight_grams: "228.100",
    },
  ]);
});

test("reprints Avery labels from packaged tray details", async ({ page }) => {
  await mockFreezeflowApi(page);
  await stubLabelWindow(page);

  await page.goto("/trays/tray-1");

  await expect(page.getByRole("heading", { name: "Packaging" })).toBeVisible();
  await expect(page.getByText("PKG-2026-000001")).toBeVisible();
  await expect(page.getByText("Status: In Storage")).toBeVisible();

  await page
    .getByRole("button", { name: "Reprint Avery 5163 Labels" })
    .click();
  await expectOpenedLabelBlob(page);
  await expectLabelPdfText(page, [
    "2 lb fresh = 8.2 oz freeze-dried",
    "cubed, seasoned",
    "Jul 8, 2026",
  ]);
});

async function stubLabelWindow(page: Page) {
  await page.addInitScript(() => {
    const openedUrls: string[] = [];
    Object.defineProperty(window, "__freezeflowOpenedUrls", {
      configurable: true,
      value: openedUrls,
    });
    URL.createObjectURL = (blob: Blob) => {
      void blob.text().then((value) => {
        Object.defineProperty(window, "__freezeflowLabelPdfText", {
          configurable: true,
          value,
        });
      });
      return "blob:e2e-label-pdf";
    };
    URL.revokeObjectURL = () => undefined;
    window.open = (url?: string | URL) => {
      openedUrls.push(String(url ?? ""));
      return { closed: false } as Window;
    };
  });
}

async function expectLabelPdfText(page: Page, expectedLines: string[]) {
  await expect
    .poll(async () =>
      page.evaluate(() =>
        String(
          (window as Window & { __freezeflowLabelPdfText?: string })
            .__freezeflowLabelPdfText ?? "",
        ),
      ),
    )
    .toContain(expectedLines[0]);

  const pdfText = await page.evaluate(() =>
    String(
      (window as Window & { __freezeflowLabelPdfText?: string })
        .__freezeflowLabelPdfText ?? "",
    ),
  );
  for (const line of expectedLines) {
    expect(pdfText).toContain(line);
  }
  expect(pdfText).not.toContain("Storage:");
}

async function expectOpenedLabelBlob(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() =>
        ((window as Window & { __freezeflowOpenedUrls?: string[] })
          .__freezeflowOpenedUrls ?? []).join("\n"),
      ),
    )
    .toContain("blob:e2e-label-pdf");
}

function rowFor(page: Page, text: string) {
  return page.locator("tr").filter({ hasText: text });
}
