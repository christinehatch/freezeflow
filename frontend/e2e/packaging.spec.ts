import { expect, test } from "@playwright/test";

import { mockFreezeflowApi } from "./support/mockApi";
import {
  expectOpenedPrintOutput,
  expectPrintPdfText,
  stubPrintWindow,
} from "./support/packagingWorkflow";

const PRINT_OUTPUT_URL = "blob:e2e-label-pdf";

test("reprints Avery labels from packaged Tray details", async ({ page }) => {
  await mockFreezeflowApi(page);
  await stubPrintWindow(page, PRINT_OUTPUT_URL);

  await page.goto("/trays/tray-1");

  await expect(page.getByRole("heading", { name: "Packaging" })).toBeVisible();
  await expect(page.getByText("PKG-2026-000001")).toBeVisible();
  await expect(page.getByText("Status: In Storage")).toBeVisible();

  await page.getByRole("button", { name: "Reprint Avery 5163 Labels" }).click();
  await expectOpenedPrintOutput(page, PRINT_OUTPUT_URL);
  await expectPrintPdfText(page, [
    "2.05 lb fresh = 8.2 oz freeze-dried",
    "Cubed and seasoned",
    "Jul 8, 2026",
  ]);
});
