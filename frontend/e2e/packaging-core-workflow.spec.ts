import { expect, type Locator, test } from "@playwright/test";

import {
  createScenarioProductionBatch,
  createScenarioTray,
} from "./support/packagingScenarios";
import {
  expectOpenedPrintOutput,
  fillPlannedPackage,
  goToPackagingStage,
  plannedPackageSummary,
  revealRecordedPackages,
  stubPrintWindow,
} from "./support/packagingWorkflow";
import { mockFreezeflowApi } from "./support/mockApi";

const PRINT_OUTPUT_URL = "blob:core-workflow-labels";

test.skip("completes and resumes the core Packaging workflow as read-only history", async ({
  page,
}) => {
  const batch = createScenarioProductionBatch({
    id: "batch-core-workflow",
    batch_number: "Batch Core Workflow",
    notes: "Core Packaging E2E",
    trays: [
      createScenarioTray({
        id: "tray-core-chicken",
        production_batch_id: "batch-core-workflow",
        product_name: "Taco Chicken",
        final_dry_weight_grams: "240",
      }),
      createScenarioTray({
        id: "tray-core-apples",
        production_batch_id: "batch-core-workflow",
        physical_tray_id: "physical-core-apples",
        tray_slot: createScenarioProductionBatch().freeze_dryer.tray_slots[1],
        product_name: "Apples",
        preparation: "Peeled and sliced",
        starting_weight_grams: "675",
        final_dry_weight_grams: "180",
      }),
    ],
  });
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [batch],
  });
  await stubPrintWindow(page, PRINT_OUTPUT_URL);

  await test.step("start an Open Packaging Operation from its Production Batch", async () => {
    await page.goto(`/production/${batch.id}`);

    await expect(
      page.getByRole("heading", { name: batch.batch_number }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Start Packaging" }).click();
    await expect(page).toHaveURL(new RegExp(`/packaging\\?batch=${batch.id}$`));
    await expect(
      page.getByText("2 Trays are ready to package (420 g).", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Next — Choose trays" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/packaging\\?batch=${batch.id}&workspace=1$`),
    );
    await expect(
      page.getByRole("heading", { name: "Choose trays" }),
    ).toBeVisible();
    expect(fakeBackend.startPackagingBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.operationIds).toHaveLength(1);
  });

  const operationId = fakeBackend.createdPackagingIds.operationIds[0];

  await test.step("select completed Trays and persist their Allocation", async () => {
    const chickenSelection = page.getByLabel("Select Slot 1 Taco Chicken");
    const appleSelection = page.getByLabel("Select Slot 2 Apples");
    const saveAndContinue = page.getByRole("button", {
      name: "Save & Continue",
    });
    const trayTableBox = await page
      .locator(".packaging-source-table")
      .boundingBox();
    const allocationFooterBox = await page
      .locator(".packaging-allocation-save")
      .boundingBox();

    await expect(saveAndContinue).toBeDisabled();
    expect(trayTableBox).not.toBeNull();
    expect(allocationFooterBox).not.toBeNull();
    expect(allocationFooterBox!.y).toBeGreaterThan(
      trayTableBox!.y + trayTableBox!.height,
    );

    await expect(rowContaining(chickenSelection)).toContainText("240 g");
    await expect(rowContaining(appleSelection)).toContainText("180 g");
    await chickenSelection.check();
    await appleSelection.check();
    await expect(saveAndContinue).toBeEnabled();
    await expect(saveAndContinue).toHaveCSS(
      "background-color",
      "rgb(24, 60, 52)",
    );

    await expect(
      page.getByText("Selected Completed Trays").locator(".."),
    ).toContainText("2");
    await expect(
      page.getByText("Selected Source Weight").locator(".."),
    ).toContainText("420 g");
    await page
      .getByLabel("Allocation Notes")
      .fill("Chicken and apple source trays");
    await saveAndContinue.click();

    await expect(
      page.getByRole("heading", { name: "Allocation 1" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).toContainText("Taco Chicken");
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).toContainText("Apples");
    await expect(page.getByLabel("Allocation 1 saved balance")).toContainText(
      "420 g",
    );
    await expect(
      page.getByRole("heading", { name: "Create packages" }),
    ).toBeVisible();

    expect(fakeBackend.allocationCreateBodies).toHaveLength(1);
    expect(fakeBackend.allocationCreateBodies[0]).toMatchObject({
      operationId,
      body: {
        tray_ids: ["tray-core-chicken", "tray-core-apples"],
        notes: "Chicken and apple source trays",
      },
    });

    await page.reload();
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).toContainText("Taco Chicken");
    await expect(
      page.getByText("Chicken and apple source trays"),
    ).toBeVisible();
  });

  await test.step("save balanced planned Package rows and restore them through the resume handoff", async () => {
    let editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await editor.getByRole("button", { name: "Add Planned Package" }).click();
    await editor.getByRole("button", { name: "Add Planned Package" }).click();

    await fillPlannedPackage(editor, 1, 1, {
      packageTypeId: "package-type-1",
      finishedWeight: "200",
      sealedWeight: "208",
      storageLocationId: "storage-pantry",
      notes: "Family dinner package",
      displayName: "Taco Chicken Dinner",
    });
    await fillPlannedPackage(editor, 1, 2, {
      packageTypeId: "package-type-2",
      finishedWeight: "220",
      sealedWeight: "230",
      storageLocationId: "storage-pantry",
      notes: "Mixed meal package",
      displayName: "Chicken and Apple Meal",
    });

    await expect(
      editor.getByLabel("Allocation 1 projected weight totals"),
    ).toContainText("0 g");
    await editor
      .getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      })
      .click();
    await expect(
      editor.getByText("Planned Packages saved", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Allocation 1 saved balance")).toContainText(
      "Balanced",
    );

    const savedPlanIds = fakeBackend.createdPackagingIds.plannedPackageRowIds;
    expect(savedPlanIds).toHaveLength(2);

    await page.goto(`/production/${batch.id}`);
    await page.getByRole("link", { name: "Continue Packaging" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/packaging\\?batch=${batch.id}&workspace=1$`),
    );
    await expect(
      page.getByText("Chicken and apple source trays"),
    ).toBeVisible();

    editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await expect(
      editor.getByRole("spinbutton", {
        name: "Allocation 1 Planned Package 1 Finished Product Weight",
        exact: true,
      }),
    ).toHaveValue("200");
    await expect(
      editor.getByRole("spinbutton", {
        name: "Allocation 1 Planned Package 2 Finished Product Weight",
        exact: true,
      }),
    ).toHaveValue("220");
    expect(fakeBackend.startPackagingBodies).toHaveLength(1);
    expect(fakeBackend.packagingOperations).toHaveLength(1);
    expect(fakeBackend.packagingOperations[0].id).toBe(operationId);
    expect(fakeBackend.createdPackagingIds.plannedPackageRowIds).toEqual(
      savedPlanIds,
    );
  });

  await test.step("record Packages and preserve their immutable plan history", async () => {
    await plannedPackageSummary(page, 1)
      .getByRole("button", { name: "Record Package" })
      .click();
    await expect
      .poll(() => fakeBackend.createdPackagingIds.packageIds.length)
      .toBe(1);

    await plannedPackageSummary(page, 2)
      .getByRole("button", { name: "Record Package" })
      .click();
    await expect
      .poll(() => fakeBackend.createdPackagingIds.packageIds.length)
      .toBe(2);

    const recordedPackages =
      fakeBackend.packagingOperations[0].allocations[0].packages;
    expect(recordedPackages).toHaveLength(2);
    await page.getByRole("button", { name: "Next — Review" }).click();
    const reviewStage = page.getByRole("region", { name: "Review & labels" });
    for (const recordedPackage of recordedPackages) {
      await expect(
        reviewStage.getByText(recordedPackage.package_identifier, {
          exact: true,
        }),
      ).toBeVisible();
    }

    await page.reload();
    await goToPackagingStage(page, "Review & labels");
    await expect(
      page.getByRole("heading", { name: "Review & labels" }),
    ).toBeVisible();
    for (const recordedPackage of recordedPackages) {
      await expect(
        reviewStage.getByText(recordedPackage.package_identifier, {
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  await test.step("edit Draft labels, preview them, and record initial Print Events", async () => {
    const recordedPackages =
      fakeBackend.packagingOperations[0].allocations[0].packages;

    for (const [index, recordedPackage] of recordedPackages.entries()) {
      const editor = page.getByLabel(
        `${recordedPackage.package_identifier} Package Label editor`,
      );
      await expect(editor).toContainText("Label status: Draft");
      await editor
        .getByLabel(`${recordedPackage.package_identifier} Label Display Name`)
        .fill(index === 0 ? "Taco Night Dinner" : "Chicken Apple Supper");
      await editor
        .getByLabel(`${recordedPackage.package_identifier} Label Description`)
        .fill("Freeze-dried family meal");
      await editor
        .getByLabel(`${recordedPackage.package_identifier} Label Serving Notes`)
        .fill("Serves two");
      await editor.getByRole("button", { name: "Save Package Label" }).click();
      await goToPackagingStage(page, "Review & labels");
      await expect(
        page.getByText(`${recordedPackage.package_identifier} · Ready`, {
          exact: true,
        }),
      ).toBeVisible();
    }

    await page.reload();
    await goToPackagingStage(page, "Review & labels");
    await expect(
      page.getByLabel(
        `${recordedPackages[0].package_identifier} Label Display Name`,
      ),
    ).toHaveValue("Taco Night Dinner");
    await expect(
      page.getByLabel(
        `${recordedPackages[1].package_identifier} Label Display Name`,
      ),
    ).toHaveValue("Chicken Apple Supper");

    const preview = page.getByLabel("Package Label preview");
    await preview.getByRole("button", { name: "Select All Eligible" }).click();
    await expect(preview).toContainText("2 labels selected");
    await preview.getByRole("button", { name: "Preview Avery 5163" }).click();
    await expect(preview.getByLabel("Avery 5163 preview")).toContainText(
      "2 previewed · 1 sheet",
    );
    await expect(preview).toContainText("Taco Night Dinner");
    await expect(preview).toContainText("Chicken Apple Supper");
    expect(fakeBackend.packageLabelPreviewBodies).toHaveLength(1);
    expect(fakeBackend.packageLabelPrintBodies).toHaveLength(0);

    await preview
      .getByRole("button", { name: "Print Selected Labels" })
      .click();
    await expect(preview).toContainText("Print recorded for 2 Package Labels.");
    await expectOpenedPrintOutput(page, PRINT_OUTPUT_URL);
    expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(2);

    for (const recordedPackage of recordedPackages) {
      const history = preview.getByLabel(
        `${recordedPackage.package_identifier} Print Event history`,
      );
      await expect(history.getByText("Initial Print")).toBeVisible();
      await expect(history).toContainText("Avery 5163");
    }

    await page.reload();
    await goToPackagingStage(page, "Review & labels");
    await expect(
      page.getByRole("heading", { name: "Review & labels" }),
    ).toBeVisible();
    const restoredPreview = page.getByLabel("Package Label preview");
    for (const recordedPackage of recordedPackages) {
      await expect(
        restoredPreview
          .getByLabel(
            `${recordedPackage.package_identifier} Print Event history`,
          )
          .getByText("Initial Print"),
      ).toBeVisible();
    }
    expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(2);
  });

  await test.step("explicitly complete Packaging and retain read-only history", async () => {
    await page.getByRole("button", { name: "Next — Finish" }).click();
    const completion = page.getByLabel("Packaging completion eligibility");
    await expect(completion).toContainText("Appears eligible for completion");
    await expect(completion).not.toContainText("remaining to package");
    await completion
      .getByRole("button", { name: "Complete Packaging" })
      .click();

    await expect(
      page.getByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeVisible();
    await expect(completion).toContainText("Packaging is already Completed");
    expect(fakeBackend.packagingCompleteBodies).toHaveLength(1);
    expect(fakeBackend.productionBatches[0].trays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tray-core-chicken",
          status: "Packaged",
        }),
        expect.objectContaining({ id: "tray-core-apples", status: "Packaged" }),
      ]),
    );

    await page.reload();
    await expect(
      page.getByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeVisible();
    await goToPackagingStage(page, "Create packages");
    await revealRecordedPackages(page, 1);
    await expect(
      page.getByText("Chicken and apple source trays"),
    ).toBeVisible();
    const completedPackageHistory = page.getByLabel(
      "Allocation 1 recorded Packages",
    );
    await expect(completedPackageHistory).toContainText("Taco Night Dinner");
    await expect(completedPackageHistory).toContainText("Chicken Apple Supper");
    await expect(page.getByText("Initial Print")).toHaveCount(2);

    for (const action of [
      "Save & Continue",
      "Add Planned Package",
      "Record Package",
      "Save Package Label",
      "Select All Eligible",
      "Preview Avery 5163",
      "Print Selected Labels",
      "Complete Packaging",
    ]) {
      await expect(page.getByRole("button", { name: action })).toHaveCount(0);
    }
    await expect(page.getByText("Recorded Package created")).toHaveCount(2);
    expect(fakeBackend.packagingCompleteBodies).toHaveLength(1);

    await page.goto(`/production/${batch.id}`);
    await page.getByRole("link", { name: "View Packaging" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/packaging\\?batch=${batch.id}&workspace=1$`),
    );
    await expect(
      page.getByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeVisible();
  });
});

test("records physical bags one at a time and blocks early Review", async ({
  page,
}) => {
  const batch = createScenarioProductionBatch({
    id: "batch-single-bag-loop",
    batch_number: "Batch Single Bag Loop",
    trays: [
      createScenarioTray({
        id: "tray-single-bag-loop",
        production_batch_id: "batch-single-bag-loop",
        final_dry_weight_grams: "240",
      }),
    ],
  });
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [batch],
  });

  await page.goto(`/packaging?batch=${batch.id}`);
  await page.getByRole("button", { name: "Next — Choose trays" }).click();
  const traySelection = page.getByLabel("Select Slot 1 Taco Chicken");
  const saveAndContinue = page.getByRole("button", {
    name: "Save & Continue",
  });
  const trayTableBox = await page
    .locator(".packaging-source-table")
    .boundingBox();
  const allocationFooterBox = await page
    .locator(".packaging-allocation-save")
    .boundingBox();

  await expect(saveAndContinue).toBeDisabled();
  expect(trayTableBox).not.toBeNull();
  expect(allocationFooterBox).not.toBeNull();
  expect(allocationFooterBox!.y).toBeGreaterThan(
    trayTableBox!.y + trayTableBox!.height,
  );

  await traySelection.check();
  await expect(saveAndContinue).toBeEnabled();
  await expect(saveAndContinue).toHaveCSS(
    "background-color",
    "rgb(24, 60, 52)",
  );
  await saveAndContinue.click();

  await expect(page.getByRole("heading", { name: "Bag 1" })).toBeVisible();
  await expect(
    page.getByText("240 g remaining to package", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Package Type" }).click();
  await page.getByRole("option", { name: /Quart Mylar/ }).click();
  await page
    .getByRole("spinbutton", { name: "Finished Product Weight" })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "Sealed Package Weight" })
    .fill("106");
  await page.getByRole("button", { name: "Save Bag 1" }).click();

  await expect(
    page.getByRole("heading", { name: "Do you have another bag to package?" }),
  ).toBeVisible();
  await expect(page.getByRole("listitem", { name: /Bag 1/ })).toContainText(
    "Quart Mylar",
  );
  await expect(
    page.getByRole("button", { name: "No more bags — Review" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Source 1 has 140 g remaining before Review."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add another bag" }).click();
  await expect(page.getByRole("heading", { name: "Bag 2" })).toBeFocused();
  await expect(
    page.getByRole("combobox", { name: "Package Type" }),
  ).toContainText("Quart Mylar");
  await page
    .getByRole("spinbutton", { name: "Finished Product Weight" })
    .fill("140");
  await page
    .getByRole("spinbutton", { name: "Sealed Package Weight" })
    .fill("146");
  await page.getByRole("button", { name: "Save Bag 2" }).click();
  await expect(
    page.getByText("0 g remaining to package", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "No more bags — Review" }).click();
  await expect(
    page.getByRole("heading", { name: "Review & labels" }),
  ).toBeVisible();
  expect(fakeBackend.packageRecordBodies).toHaveLength(2);
});

function rowContaining(locator: Locator) {
  return locator.locator("xpath=ancestor::tr");
}
