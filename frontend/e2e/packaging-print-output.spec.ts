import { expect, test } from "@playwright/test";

import { recordedPackagingScenario } from "./support/packagingScenarios";
import {
  expectOpenedPrintOutput,
  expectPrintPdfText,
  goToPackagingStage,
  printWindowState,
  REVIEW_STAGE_NAME,
  skipBagReviewToSummary,
  stubPrintWindow,
} from "./support/packagingWorkflow";
import { mockFreezeflowApi } from "./support/mockApi";

const PRINT_OUTPUT_URL = "blob:packaging-print-acceptance";

test("reserves output before persistence and navigates it to a valid Avery PDF", async ({
  page,
}) => {
  const scenario = recordedPackagingScenario("Ready");
  const batch = scenario.productionBatches[0];
  const recordedPackage =
    scenario.packagingOperations[0].allocations[0].packages[0];
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  await stubPrintWindow(page, PRINT_OUTPUT_URL);

  let continuePrintRequest: (() => void) | undefined;
  const printRequestMayContinue = new Promise<void>((resolve) => {
    continuePrintRequest = resolve;
  });
  let markPrintRequestReached: (() => void) | undefined;
  const printRequestReached = new Promise<void>((resolve) => {
    markPrintRequestReached = resolve;
  });
  await page.route("**/api/v1/package-labels/print", async (route) => {
    markPrintRequestReached?.();
    await printRequestMayContinue;
    await route.fallback();
  });

  await page.goto(`/packaging?batch=${batch.id}&workspace=1`);
  await goToPackagingStage(page, "Review & labels", REVIEW_STAGE_NAME);
  await skipBagReviewToSummary(page);
  const preview = page.getByLabel("Package Label preview");
  await preview
    .getByLabel(`Select ${recordedPackage.package_identifier} Package Label`)
    .check();
  await preview.getByRole("button", { name: "Print Selected Labels" }).click();
  await printRequestReached;

  await expect
    .poll(async () => (await printWindowState(page))?.openedWith.length)
    .toBe(1);
  expect((await printWindowState(page))?.openedWith).toEqual([""]);
  expect((await printWindowState(page))?.navigatedTo).toHaveLength(0);
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(0);

  continuePrintRequest?.();
  await expect(preview).toContainText("Print recorded for 1 Package Label.");
  await expectOpenedPrintOutput(page, PRINT_OUTPUT_URL);
  await expectPrintPdfText(page, [
    "%PDF-1.4",
    "/MediaBox [0 0 612 792]",
    recordedPackage.package_identifier.toUpperCase(),
  ]);
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(1);
});

test("popup blocking prevents persistence and explains that nothing was recorded", async ({
  page,
}) => {
  const scenario = recordedPackagingScenario("Ready");
  const batch = scenario.productionBatches[0];
  const recordedPackage =
    scenario.packagingOperations[0].allocations[0].packages[0];
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  await stubPrintWindow(page, PRINT_OUTPUT_URL, { blockOpen: true });

  await page.goto(`/packaging?batch=${batch.id}&workspace=1`);
  await goToPackagingStage(page, "Review & labels", REVIEW_STAGE_NAME);
  await skipBagReviewToSummary(page);
  const preview = page.getByLabel("Package Label preview");
  await preview
    .getByLabel(`Select ${recordedPackage.package_identifier} Package Label`)
    .check();
  await preview.getByRole("button", { name: "Print Selected Labels" }).click();

  await expect(
    preview.getByRole("alert").filter({ hasText: "browser blocked" }),
  ).toContainText("No Print Events were recorded");
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(0);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(0);
  expect((await printWindowState(page))?.navigatedTo).toHaveLength(0);
});

test("print persistence failure closes the reservation without success state", async ({
  page,
}) => {
  const scenario = recordedPackagingScenario("Ready");
  const batch = scenario.productionBatches[0];
  const operation = scenario.packagingOperations[0];
  const recordedPackage = operation.allocations[0].packages[0];
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  await stubPrintWindow(page, PRINT_OUTPUT_URL);
  fakeBackend.failNextPackagingRequest({
    method: "POST",
    path: "/package-labels/print",
    status: 409,
    code: "PACKAGE_LABEL_SELECTION_INVALID",
    message: "The selected Package Label changed before printing.",
  });

  await page.goto(`/packaging?batch=${batch.id}&workspace=1`);
  await goToPackagingStage(page, "Review & labels", REVIEW_STAGE_NAME);
  await skipBagReviewToSummary(page);
  const preview = page.getByLabel("Package Label preview");
  await preview
    .getByLabel(`Select ${recordedPackage.package_identifier} Package Label`)
    .check();
  await preview.getByRole("button", { name: "Print Selected Labels" }).click();

  await expect(
    preview.getByRole("alert").filter({ hasText: "Print was not recorded" }),
  ).toContainText("The selected Package Label changed before printing.");
  await expect
    .poll(async () => (await printWindowState(page))?.closeCount)
    .toBe(1);
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(0);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(0);
  await expect(preview.getByText(/Print recorded for/)).toHaveCount(0);
});

test("output delivery recovery does not append a Print Event, while deliberate reprint does", async ({
  page,
}) => {
  const scenario = recordedPackagingScenario("Ready");
  const batch = scenario.productionBatches[0];
  const recordedPackage =
    scenario.packagingOperations[0].allocations[0].packages[0];
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  await stubPrintWindow(page, PRINT_OUTPUT_URL, { failNavigationTimes: 1 });

  await page.goto(`/packaging?batch=${batch.id}&workspace=1`);
  await goToPackagingStage(page, "Review & labels", REVIEW_STAGE_NAME);
  await skipBagReviewToSummary(page);
  const preview = page.getByLabel("Package Label preview");
  await preview
    .getByLabel(`Select ${recordedPackage.package_identifier} Package Label`)
    .check();
  await preview.getByRole("button", { name: "Print Selected Labels" }).click();

  await expect(
    preview.getByRole("alert").filter({ hasText: "could not load" }),
  ).toContainText("Open the recorded output below");
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(1);
  await preview
    .getByRole("button", { name: "Open Recorded Avery 5163 Output" })
    .click();
  await expectOpenedPrintOutput(page, PRINT_OUTPUT_URL);
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(1);

  await preview
    .getByRole("button", { name: "Print Selected Labels" })
    .dblclick();
  await expect(preview).toContainText("Print recorded for 1 Package Label.");
  expect(fakeBackend.packageLabelPrintBodies).toHaveLength(2);
  expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(2);
  await expect(
    preview
      .getByLabel(`${recordedPackage.package_identifier} Print Event history`)
      .getByText("Reprint"),
  ).toBeVisible();
});
