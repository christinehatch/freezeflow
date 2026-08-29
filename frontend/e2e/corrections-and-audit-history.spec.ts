import { expect, test } from "@playwright/test";

const API_BASE = "http://127.0.0.1:8000/api/v1";
const TRAY_ID = "tray-1";

test("corrects a Tray field and reviews the correction in Audit History", async ({
  page,
}) => {
  const tray = {
    id: TRAY_ID,
    production_batch_id: "batch-1",
    tray_slot_id: "slot-1",
    tray_slot: {
      id: "slot-1",
      freeze_dryer_id: "fd-1",
      slot_number: 1,
      label: null,
      archived: false,
    },
    physical_tray_id: "ptray-1",
    physical_tray: {
      id: "ptray-1",
      label: "Tray A",
      tare_weight_grams: "500",
      notes: null,
      archived: false,
    },
    preparation_preset_id: null,
    preparation_preset_name: null,
    product_name: "Strawberries",
    ingredients: ["Strawberries"],
    preparation_methods: ["Sliced"],
    preparation: null,
    starting_weight_grams: "1000",
    final_dry_weight_grams: null,
    completed_at: null,
    notes: "Original notes",
    status: "Running",
    weight_checks: [],
    latest_weight_grams: "1000",
    previous_weight_grams: null,
    packaging: null,
  };

  let auditEntries: Array<{
    id: string;
    entity_type: string;
    entity_id: string;
    field_name: string;
    previous_value: string;
    current_value: string;
    observed_at: string | null;
    corrected_at: string;
    reason: string | null;
  }> = [];

  await page.route(`${API_BASE}/trays/${TRAY_ID}`, (route) =>
    route.fulfill({ json: { success: true, data: tray, meta: {} } }),
  );

  await page.route(
    `${API_BASE}/trays/${TRAY_ID}/correct-notes`,
    async (route) => {
      const body = route.request().postDataJSON() as {
        notes: string;
        reason: string | null;
      };
      auditEntries = [
        ...auditEntries,
        {
          id: `audit-${auditEntries.length + 1}`,
          entity_type: "Tray",
          entity_id: TRAY_ID,
          field_name: "notes",
          previous_value: tray.notes ?? "",
          current_value: body.notes,
          observed_at: null,
          corrected_at: new Date().toISOString(),
          reason: body.reason,
        },
      ];
      tray.notes = body.notes;
      return route.fulfill({ json: { success: true, data: tray, meta: {} } });
    },
  );

  await page.route(`${API_BASE}/audit-entries**`, (route) =>
    route.fulfill({ json: { success: true, data: auditEntries, meta: {} } }),
  );

  await page.goto(`/trays/${TRAY_ID}`);

  await expect(
    page.getByRole("heading", { name: "Strawberries" }),
  ).toBeVisible();
  await expect(page.getByText("Original notes")).toBeVisible();

  await page.getByRole("button", { name: "Correct Notes" }).click();
  await page.getByLabel("Corrected Notes").fill("Corrected notes");
  await page.getByLabel("Correction reasonOptional").fill("Typo fix");
  await page.getByRole("button", { name: "Save Correction" }).click();

  await expect(
    page.getByText("Corrected notes", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "View History" }).click();

  await expect(
    page.getByRole("heading", { name: "Correction History" }),
  ).toBeVisible();
  await expect(
    page.getByText("Originally entered: Original notes"),
  ).toBeVisible();
  await expect(page.getByText("Corrected: Corrected notes")).toBeVisible();
  await expect(page.getByText("Reason: Typo fix")).toBeVisible();
});
