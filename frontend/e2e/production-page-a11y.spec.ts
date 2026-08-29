import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { createFreezeDryer, mockFreezeflowApi } from "./support/mockApi";

test("Production has no serious or critical accessibility violations", async ({
  page,
}) => {
  const black = createFreezeDryer({ id: "black", name: "Black" });
  await mockFreezeflowApi(page, {
    freezeDryers: [black],
    physicalTrays: [],
    productionBatches: [],
    packagingWorksheet: [],
  });

  await page.goto("/production");
  await expect(
    page.getByRole("heading", { name: "Production", exact: true }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  expect(seriousOrCritical).toEqual([]);
});
