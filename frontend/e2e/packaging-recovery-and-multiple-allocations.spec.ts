import { expect, test } from "@playwright/test";

import {
  createScenarioFreezeDryer,
  createScenarioProductionBatch,
  createScenarioTray,
  savedPlanningPackagingScenario,
} from "./support/packagingScenarios";
import {
  fillPlannedPackage,
  goToPackagingStage,
  plannedPackageFinishedWeight,
  REVIEW_STAGE_NAME,
  skipBagReviewToSummary,
  stubPrintWindow,
} from "./support/packagingWorkflow";
import { mockFreezeflowApi } from "./support/mockApi";

const RECOVERY_PRINT_OUTPUT_URL = "blob:packaging-recovery-labels";

test.skip("recovers persisted plans, Packages, labels, and Print Events after failed refreshes", async ({
  page,
}) => {
  const scenario = savedPlanningPackagingScenario();
  const batch = scenario.productionBatches[0];
  const operation = scenario.packagingOperations[0];
  const fakeBackend = await mockFreezeflowApi(page, scenario);
  await stubPrintWindow(page, RECOVERY_PRINT_OUTPUT_URL);

  await page.goto(`/packaging?batch=${batch.id}&workspace=1`);

  await test.step("discard browser-only edits while restoring saved work", async () => {
    let editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await plannedPackageFinishedWeight(editor, 1, 1).fill("200");
    await editor
      .getByLabel("Allocation 1 Planned Package 1 Package Notes")
      .fill("Unsaved interruption note");
    await expect(
      editor.getByText("Unsaved changes", { exact: true }),
    ).toBeVisible();

    await page.reload();
    editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await expect(plannedPackageFinishedWeight(editor, 1, 1)).toHaveValue("120");
    await expect(
      editor.getByLabel("Allocation 1 Planned Package 1 Package Notes"),
    ).toHaveValue("Saved package plan");
    expect(fakeBackend.allocationUpdateBodies).toHaveLength(0);
    expect(fakeBackend.packagingOperations[0].id).toBe(operation.id);
  });

  await test.step("preserve a planned-row save when its authoritative refresh fails", async () => {
    const editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await plannedPackageFinishedWeight(editor, 1, 1).fill("240");
    fakeBackend.failNextPackagingRequest({
      method: "GET",
      path: `/production-batches/${batch.id}/packaging-operation`,
      status: 503,
      code: "PACKAGING_REFRESH_UNAVAILABLE",
      message: "Authoritative Packaging refresh is temporarily unavailable.",
    });

    await editor
      .getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      })
      .click();

    await expect(editor.getByRole("alert")).toContainText(
      "Planned Packages were saved, but the latest operation state could not be refreshed",
    );
    await expect(editor.getByRole("alert")).toContainText(
      "Authoritative Packaging refresh is temporarily unavailable.",
    );
    await expect(
      editor.getByRole("button", { name: "Retry latest state" }),
    ).toBeVisible();
    expect(fakeBackend.allocationUpdateBodies).toHaveLength(1);
    expect(
      fakeBackend.packagingOperations[0].allocations[0].planned_packages,
    ).toHaveLength(1);
    expect(
      fakeBackend.packagingOperations[0].allocations[0].planned_packages[0]
        .finished_product_weight_grams,
    ).toBe("240.000");

    await editor.getByRole("button", { name: "Retry latest state" }).click();
    await expect(plannedPackageFinishedWeight(editor, 1, 1)).toHaveValue("240");
    await expect(
      editor.getByText("Planned Packages saved", { exact: true }),
    ).toBeVisible();
    expect(fakeBackend.allocationUpdateBodies).toHaveLength(1);
    expect(
      fakeBackend.packagingOperations[0].allocations[0].planned_packages,
    ).toHaveLength(1);
  });

  await test.step("recover a recorded Package without submitting it twice", async () => {
    fakeBackend.failNextPackagingRequest({
      method: "GET",
      path: `/production-batches/${batch.id}/packaging-operation`,
      status: 503,
      code: "PACKAGING_REFRESH_UNAVAILABLE",
      message: "The recorded Package cannot be refreshed yet.",
    });

    const recording = page.getByLabel("Planned Package 1 recording");
    await recording.getByRole("button", { name: "Record Package" }).dblclick();

    await expect(recording.getByRole("alert")).toContainText(
      "The Package was recorded, but the latest operation state could not be refreshed",
    );
    await expect(recording).toContainText("Package recorded; refresh required");
    await expect(
      recording.getByRole("button", { name: "Retry latest state" }),
    ).toBeVisible();
    expect(fakeBackend.packageRecordBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.packageIds).toHaveLength(1);

    await recording.getByRole("button", { name: "Retry latest state" }).click();
    const recordedPackage =
      fakeBackend.packagingOperations[0].allocations[0].packages[0];
    await page.getByRole("button", { name: "Next — Review" }).click();
    await expect(
      page
        .getByRole("region", { name: REVIEW_STAGE_NAME })
        .getByText(recordedPackage.package_identifier, {
          exact: true,
        }),
    ).toBeVisible();
    expect(fakeBackend.packageRecordBodies).toHaveLength(1);
  });

  await test.step("recover a saved Label and printed event without duplicate mutations", async () => {
    const recordedPackage =
      fakeBackend.packagingOperations[0].allocations[0].packages[0];
    const labelEditor = page.getByLabel(
      `${recordedPackage.package_identifier} Package Label editor`,
    );
    await labelEditor
      .getByLabel(`${recordedPackage.package_identifier} Label Display Name`)
      .fill("Recovered Taco Dinner");
    fakeBackend.failNextPackagingRequest({
      method: "GET",
      path: `/production-batches/${batch.id}/packaging-operation`,
      status: 503,
      code: "PACKAGING_REFRESH_UNAVAILABLE",
      message: "The saved Package Label cannot be refreshed yet.",
    });
    await labelEditor
      .getByRole("button", { name: "Save Package Label" })
      .click();

    await expect(labelEditor.getByRole("alert")).toContainText(
      "The Package Label was saved, but the latest operation state could not be refreshed",
    );
    await expect(
      labelEditor.getByRole("button", { name: "Retry latest state" }),
    ).toBeVisible();
    expect(fakeBackend.packageLabelUpdateBodies).toHaveLength(1);

    await labelEditor
      .getByRole("button", { name: "Retry latest state" })
      .click();
    await expect(labelEditor).toContainText("Label status: Ready");
    await expect(
      labelEditor.getByLabel(
        `${recordedPackage.package_identifier} Label Display Name`,
      ),
    ).toHaveValue("Recovered Taco Dinner");

    await skipBagReviewToSummary(page);
    const preview = page.getByLabel("Package Label preview");
    await preview
      .getByLabel(`Select ${recordedPackage.package_identifier} Package Label`)
      .check();
    fakeBackend.failNextPackagingRequest({
      method: "GET",
      path: `/production-batches/${batch.id}/packaging-operation`,
      status: 503,
      code: "PACKAGING_REFRESH_UNAVAILABLE",
      message: "Printed history cannot be refreshed yet.",
    });
    await preview
      .getByRole("button", { name: "Print Selected Labels" })
      .dblclick();

    await expect(
      preview.getByRole("alert").filter({
        hasText:
          "Printing was recorded, but the Packaging workspace refresh failed",
      }),
    ).toContainText(
      "Printing was recorded, but the Packaging workspace refresh failed",
    );
    await expect(
      preview.getByRole("button", { name: "Retry Workspace Refresh" }),
    ).toBeVisible();
    expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(1);

    await preview
      .getByRole("button", { name: "Retry Workspace Refresh" })
      .click();
    await expect(
      page
        .getByLabel(`${recordedPackage.package_identifier} Print Event history`)
        .getByText("Initial Print"),
    ).toBeVisible();
    expect(fakeBackend.packageLabelPrintBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.printEventIds).toHaveLength(1);

    await page.goto(`/production/${batch.id}`);
    await page.getByRole("link", { name: "Continue Packaging" }).click();
    await goToPackagingStage(page, "Review & labels", REVIEW_STAGE_NAME);
    await expect(
      page.getByRole("region", { name: REVIEW_STAGE_NAME }),
    ).toContainText("Recovered Taco Dinner");
    await expect(page.getByText("Initial Print")).toBeVisible();
    expect(fakeBackend.packagingOperations).toHaveLength(1);
  });
});

test.skip("surfaces structured validation and stale conflicts while preventing duplicate actions", async ({
  page,
}) => {
  const freezeDryer = createScenarioFreezeDryer();
  const batch = createScenarioProductionBatch({
    id: "batch-validation-recovery",
    batch_number: "Batch Validation Recovery",
    freeze_dryer: freezeDryer,
    freeze_dryer_id: freezeDryer.id,
    trays: [
      createScenarioTray({
        id: "tray-validation-saved",
        production_batch_id: "batch-validation-recovery",
        tray_slot: freezeDryer.tray_slots[0],
        final_dry_weight_grams: "240",
      }),
      createScenarioTray({
        id: "tray-validation-stale",
        production_batch_id: "batch-validation-recovery",
        physical_tray_id: "physical-validation-stale",
        tray_slot: freezeDryer.tray_slots[1],
        product_name: "Apples",
        final_dry_weight_grams: "180",
      }),
    ],
  });
  const otherFreezeDryer = createScenarioFreezeDryer({
    id: "freeze-dryer-validation-other",
    name: "Other Validation Freeze Dryer",
  });
  const otherBatch = createScenarioProductionBatch({
    id: "batch-validation-other",
    batch_number: "Batch Validation Other",
    freeze_dryer: otherFreezeDryer,
    freeze_dryer_id: otherFreezeDryer.id,
    trays: [
      createScenarioTray({
        id: "tray-validation-other",
        production_batch_id: "batch-validation-other",
        physical_tray_id: "physical-validation-other",
        tray_slot: otherFreezeDryer.tray_slots[0],
        product_name: "Cross Batch Pears",
        final_dry_weight_grams: "95",
      }),
    ],
  });
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [batch, otherBatch],
  });

  await page.goto(`/packaging?batch=${batch.id}`);

  await test.step("protect start and Allocation creation from double clicks", async () => {
    await page.getByRole("button", { name: "Next — Choose trays" }).dblclick();
    await expect(
      page.getByRole("heading", { name: "Choose trays" }),
    ).toBeVisible();
    expect(fakeBackend.startPackagingBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.operationIds).toHaveLength(1);

    await page.getByLabel("Select Slot 1 Taco Chicken").check();
    await page.getByLabel("Allocation Notes").fill("Saved source");
    await page.getByRole("button", { name: "Save & Continue" }).dblclick();
    await expect(
      page.getByRole("heading", { name: "Allocation 1" }),
    ).toBeVisible();
    expect(fakeBackend.allocationCreateBodies).toHaveLength(1);
    expect(fakeBackend.createdPackagingIds.allocationIds).toHaveLength(1);
  });

  await test.step("show structured planned-row validation and preserve entered values", async () => {
    const operation = fakeBackend.packagingOperations[0];
    const allocation = operation.allocations[0];
    const editor = page.getByLabel("Allocation 1 Planned Packages editor");
    await editor.getByRole("button", { name: "Add Planned Package" }).click();
    await fillPlannedPackage(editor, 1, 1, {
      finishedWeight: "240",
      sealedWeight: "248",
      displayName: "Validated Taco Dinner",
    });
    fakeBackend.failNextPackagingRequest({
      method: "PATCH",
      path: `/packaging-operations/${operation.id}/allocations/${allocation.id}`,
      status: 422,
      code: "PACKAGING_WEIGHT_INVALID",
      message: "Allocation 1 Finished Product Weight must be reviewed.",
      errors: [
        {
          field: "planned_packages.0.finished_product_weight_grams",
          message: "The recorded scale value is invalid.",
        },
      ],
    });

    await editor
      .getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      })
      .click();
    await expect(editor.getByRole("alert")).toContainText(
      "Allocation 1 Finished Product Weight must be reviewed.",
    );
    await expect(editor.getByRole("alert")).toContainText(
      "The recorded scale value is invalid.",
    );
    await expect(plannedPackageFinishedWeight(editor, 1, 1)).toHaveValue("240");
    expect(
      fakeBackend.packagingOperations[0].allocations[0].planned_packages,
    ).toHaveLength(0);

    await editor
      .getByRole("button", {
        name: "Save Allocation 1 Planned Packages",
      })
      .click();
    await expect(
      editor.getByText("Planned Packages saved", { exact: true }),
    ).toBeVisible();
    expect(
      fakeBackend.packagingOperations[0].allocations[0].planned_packages,
    ).toHaveLength(1);
  });

  await test.step("associate structured Label validation with its Package editor", async () => {
    const operation = fakeBackend.packagingOperations[0];
    const allocation = operation.allocations[0];
    const plannedPackage = allocation.planned_packages[0];
    const recording = page.getByLabel("Planned Package 1 recording");
    fakeBackend.failNextPackagingRequest({
      method: "POST",
      path: `/packaging-operations/${operation.id}/allocations/${allocation.id}/packages`,
      status: 422,
      code: "PACKAGE_RECORDING_INVALID",
      message: "Review this planned Package before recording inventory.",
      errors: [
        {
          field: "planned_package_row_id",
          message: "The saved planned Package requires confirmation.",
        },
      ],
    });

    await recording.getByRole("button", { name: "Record Package" }).click();
    await expect(recording.getByRole("alert")).toContainText(
      "Review this planned Package before recording inventory.",
    );
    await expect(recording.getByRole("alert")).toContainText(
      "planned package row id: The saved planned Package requires confirmation.",
    );
    expect(allocation.packages).toHaveLength(0);
    expect(plannedPackage.recorded_package_id).toBeNull();

    await recording.getByRole("button", { name: "Record Package" }).click();
    const recordedPackage =
      fakeBackend.packagingOperations[0].allocations[0].packages[0];
    await page.getByRole("button", { name: "Next — Review" }).click();
    const editor = page.getByLabel(
      `${recordedPackage.package_identifier} Package Label editor`,
    );
    await editor
      .getByLabel(`${recordedPackage.package_identifier} Label Display Name`)
      .fill("Corrected Taco Dinner");
    fakeBackend.failNextPackagingRequest({
      method: "PATCH",
      path: `/packages/${recordedPackage.id}/label`,
      status: 422,
      code: "PACKAGE_LABEL_INVALID",
      message: "Review this Package Label before it can be Ready.",
      errors: [
        { field: "display_name", message: "Display Name needs confirmation." },
      ],
    });

    await editor.getByRole("button", { name: "Save Package Label" }).click();
    await expect(editor.getByRole("alert")).toContainText(
      "Review this Package Label before it can be Ready.",
    );
    await expect(editor.getByRole("alert")).toContainText(
      "Display Name needs confirmation.",
    );
    await expect(
      editor.getByLabel(
        `${recordedPackage.package_identifier} Label Display Name`,
      ),
    ).toHaveValue("Corrected Taco Dinner");

    await editor.getByRole("button", { name: "Save Package Label" }).click();
    await expect(editor).toContainText("Label status: Ready");
    expect(fakeBackend.packageLabelUpdateBodies).toHaveLength(1);
    expect(
      fakeBackend.packagingRequests.filter(
        (request) =>
          request.method === "PATCH" &&
          request.path === `/packages/${recordedPackage.id}/label`,
      ),
    ).toHaveLength(2);
  });

  await test.step("reject a stale Tray conflict and remove it after refresh", async () => {
    await goToPackagingStage(page, "Choose trays");
    await expect(page.getByText("Cross Batch Pears")).toHaveCount(0);
    await page.getByLabel("Select Slot 2 Apples").check();
    const operation = fakeBackend.packagingOperations[0];
    fakeBackend.failNextPackagingRequest({
      method: "POST",
      path: `/packaging-operations/${operation.id}/allocate-trays`,
      status: 409,
      code: "PACKAGING_TRAY_CONFLICT",
      message: "Apples was allocated by another saved Packaging action.",
    });

    await page.getByRole("button", { name: "Save & Continue" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Apples was allocated by another saved Packaging action.",
    );
    expect(operation.allocations).toHaveLength(1);
    expect(operation.allocations[0].notes).toBe("Saved source");

    const staleTray = batch.trays.find(
      (tray) => tray.id === "tray-validation-stale",
    );
    if (!staleTray) throw new Error("Expected the stale Tray fixture.");
    staleTray.status = "Packaged";
    await page.reload();
    await goToPackagingStage(page, "Choose trays");
    await expect(page.getByLabel("Select Slot 2 Apples")).toHaveCount(0);
    await goToPackagingStage(page, "Create packages");
    await expect(
      page.getByRole("heading", { name: "Allocation 1" }),
    ).toBeVisible();
    expect(operation.allocations).toHaveLength(1);
  });

  await test.step("display completion validation and accept only one repeated completion action", async () => {
    const operation = fakeBackend.packagingOperations[0];
    await goToPackagingStage(page, "Finish");
    const completion = page.getByLabel("Packaging completion eligibility");
    await expect(completion).toContainText("Appears eligible for completion");
    fakeBackend.failNextPackagingRequest({
      method: "POST",
      path: `/packaging-operations/${operation.id}/complete`,
      status: 409,
      code: "PACKAGING_COMPLETION_CONFLICT",
      message: "Packaging changed before completion. Review and try again.",
    });

    await completion
      .getByRole("button", { name: "Complete Packaging" })
      .click();
    await expect(completion.getByRole("alert")).toContainText(
      "Packaging changed before completion. Review and try again.",
    );
    expect(operation.status).toBe("Open");

    await completion
      .getByRole("button", { name: "Complete Packaging" })
      .dblclick();
    await expect(
      page.getByText(
        "Packaging is complete. This workspace is read-only history.",
      ),
    ).toBeVisible();
    expect(fakeBackend.packagingCompleteBodies).toHaveLength(1);
    expect(
      fakeBackend.packagingRequests.filter(
        (request) =>
          request.method === "POST" &&
          request.path === `/packaging-operations/${operation.id}/complete`,
      ),
    ).toHaveLength(2);
    expect(operation.status).toBe("Completed");
  });
});

test.skip("keeps multiple Packaging Allocations independently traceable and balanced", async ({
  page,
}) => {
  const freezeDryer = createScenarioFreezeDryer({ tray_slot_count: 4 });
  const batch = createScenarioProductionBatch({
    id: "batch-multiple-allocations",
    batch_number: "Batch Multiple Allocations",
    freeze_dryer: freezeDryer,
    freeze_dryer_id: freezeDryer.id,
    trays: [
      createScenarioTray({
        id: "tray-multi-chicken",
        production_batch_id: "batch-multiple-allocations",
        tray_slot: freezeDryer.tray_slots[0],
        product_name: "Taco Chicken",
        final_dry_weight_grams: "150",
      }),
      createScenarioTray({
        id: "tray-multi-apples",
        production_batch_id: "batch-multiple-allocations",
        physical_tray_id: "physical-multi-apples",
        tray_slot: freezeDryer.tray_slots[1],
        product_name: "Apples",
        preparation: "Sliced",
        final_dry_weight_grams: "100",
      }),
      createScenarioTray({
        id: "tray-multi-strawberries",
        production_batch_id: "batch-multiple-allocations",
        physical_tray_id: "physical-multi-strawberries",
        tray_slot: freezeDryer.tray_slots[2],
        product_name: "Strawberries",
        preparation: "Halved",
        final_dry_weight_grams: "80",
      }),
    ],
  });
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [batch],
  });

  await page.goto(`/packaging?batch=${batch.id}`);
  await page.getByRole("button", { name: "Next — Choose trays" }).click();

  await test.step("save two disjoint source groups", async () => {
    await page.getByLabel("Select Slot 1 Taco Chicken").check();
    await page.getByLabel("Allocation Notes").fill("Chicken Allocation");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Create packages" }),
    ).toBeVisible();
    await goToPackagingStage(page, "Choose trays");
    await expect(page.getByLabel("Select Slot 2 Apples")).toBeEnabled();
    await page.getByLabel("Select Slot 2 Apples").check();
    await page.getByLabel("Select Slot 3 Strawberries").check();
    await page.getByLabel("Allocation Notes").fill("Fruit Allocation");
    await page.getByRole("button", { name: "Save & Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Allocation 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Allocation 2" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).toContainText("Taco Chicken");
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).not.toContainText("Apples");
    await expect(
      page.getByLabel("Allocation 2 source completed Trays"),
    ).toContainText("Apples");
    await expect(
      page.getByLabel("Allocation 2 source completed Trays"),
    ).toContainText("Strawberries");
    expect(fakeBackend.allocationCreateBodies).toHaveLength(2);
    expect(fakeBackend.allocationCreateBodies[0].body.tray_ids).toEqual([
      "tray-multi-chicken",
    ]);
    expect(fakeBackend.allocationCreateBodies[1].body.tray_ids).toEqual([
      "tray-multi-apples",
      "tray-multi-strawberries",
    ]);
  });

  await test.step("balance each Allocation independently", async () => {
    const firstEditor = page.getByLabel("Allocation 1 Planned Packages editor");
    const secondEditor = page.getByLabel(
      "Allocation 2 Planned Packages editor",
    );
    await firstEditor
      .getByRole("button", { name: "Add Planned Package" })
      .click();
    await fillPlannedPackage(firstEditor, 1, 1, {
      finishedWeight: "150",
      sealedWeight: "158",
      displayName: "Taco Chicken Package",
    });
    await firstEditor
      .getByRole("button", { name: "Save Allocation 1 Planned Packages" })
      .click();
    await expect(page.getByLabel("Allocation 1 saved balance")).toContainText(
      "Balanced",
    );
    await expect(page.getByLabel("Allocation 2 saved balance")).toContainText(
      "180 g remaining",
    );
    await expect(
      page.getByLabel("Packaging completion eligibility"),
    ).toContainText("Allocation 2 has 180 g remaining to package.");

    await secondEditor
      .getByRole("button", { name: "Add Planned Package" })
      .click();
    await fillPlannedPackage(secondEditor, 2, 1, {
      packageTypeId: "package-type-2",
      finishedWeight: "130",
      sealedWeight: "138",
      displayName: "Fruit Package",
    });
    await secondEditor
      .getByRole("button", { name: "Save Allocation 2 Planned Packages" })
      .click();
    await expect(page.getByLabel("Allocation 2 saved balance")).toContainText(
      "50 g remaining",
    );
    await expect(page.getByLabel("Allocation 1 saved balance")).toContainText(
      "Balanced",
    );

    await plannedPackageFinishedWeight(secondEditor, 2, 1).fill("180");
    await secondEditor
      .getByRole("button", { name: "Save Allocation 2 Planned Packages" })
      .click();
    await expect(page.getByLabel("Allocation 2 saved balance")).toContainText(
      "Balanced",
    );
    await expect(
      page.getByLabel("Packaging completion eligibility"),
    ).toContainText("Planned Packages that must be recorded");
  });

  await test.step("record and prepare both histories before completion becomes eligible", async () => {
    await page
      .getByLabel("Planned Package 1 recording")
      .nth(0)
      .getByRole("button", { name: "Record Package" })
      .click();
    await page
      .getByLabel("Planned Package 1 recording")
      .getByRole("button", { name: "Record Package" })
      .click();

    const packages = fakeBackend.packagingOperations[0].allocations.flatMap(
      (allocation) => allocation.packages,
    );
    expect(packages).toHaveLength(2);
    await page.getByRole("button", { name: "Next — Review" }).click();
    for (const recordedPackage of packages) {
      const editor = page.getByLabel(
        `${recordedPackage.package_identifier} Package Label editor`,
      );
      await editor
        .getByLabel(`${recordedPackage.package_identifier} Label Description`)
        .fill("Prepared for independent Allocation history");
      await editor.getByRole("button", { name: "Save Package Label" }).click();
      await expect(editor).toContainText("Label status: Ready");
    }

    await page.getByRole("button", { name: "Next — Finish" }).click();
    await expect(
      page.getByLabel("Packaging completion eligibility"),
    ).toContainText("Appears eligible for completion");
    await page.reload();
    await goToPackagingStage(page, "Create packages");
    await expect(page.getByText("Chicken Allocation")).toBeVisible();
    await expect(page.getByText("Fruit Allocation")).toBeVisible();
    await expect(
      page.getByLabel("Allocation 1 source completed Trays"),
    ).toContainText("Taco Chicken");
    await expect(
      page.getByLabel("Allocation 2 source completed Trays"),
    ).toContainText("Apples");
    await expect(page.getByLabel("Allocation 1 saved balance")).toContainText(
      "Balanced",
    );
    await expect(page.getByLabel("Allocation 2 saved balance")).toContainText(
      "Balanced",
    );
    await goToPackagingStage(page, "Finish");
    await expect(
      page.getByLabel("Packaging completion eligibility"),
    ).toContainText("Appears eligible for completion");
    expect(fakeBackend.packagingOperations[0].allocations).toHaveLength(2);
  });
});
