import { expect, type Page, test } from "@playwright/test";

import { mockFreezeflowApi } from "./support/mockApi";

test("loads Freeze Dryers and creates a new Freeze Dryer", async ({ page }) => {
  const fakeBackend = await mockFreezeflowApi(page, {
    productionBatches: [],
  });

  await page.goto("/freeze-dryers");

  await expect(
    page.getByRole("heading", { name: "Freeze Dryers", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "black" })).toBeVisible();
  await expect(page.getByText("works well")).toBeVisible();
  await expect(page.getByText("4 Tray Slots")).toBeVisible();

  const createForm = freezeDryerCreateForm(page);
  await createForm.getByLabel("Name").fill("silver");
  await createForm.getByLabel("Tray Slots").fill("6");
  await createForm.getByLabel("Notes").fill("backup dryer");
  await createForm.getByRole("button", { name: "+ New Freeze Dryer" }).click();

  await expect(page.getByRole("heading", { name: "silver" })).toBeVisible();
  await expect(page.getByText("backup dryer")).toBeVisible();
  await expect(page.getByText("6 Tray Slots")).toBeVisible();

  expect(fakeBackend.freezeDryers).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "silver",
        notes: "backup dryer",
        tray_slot_count: 6,
        archived: false,
      }),
    ]),
  );
  expect(fakeBackend.createFreezeDryerBodies).toEqual([
    {
      name: "silver",
      notes: "backup dryer",
      tray_slot_count: 6,
    },
  ]);
});

test("does not create a Freeze Dryer when required fields are blank", async ({
  page,
}) => {
  const fakeBackend = await mockFreezeflowApi(page);

  await page.goto("/freeze-dryers");

  await freezeDryerCreateForm(page)
    .getByRole("button", { name: "+ New Freeze Dryer" })
    .click();

  await expect(page.getByRole("heading", { name: "black" })).toBeVisible();
  expect(fakeBackend.createFreezeDryerBodies).toHaveLength(0);
});

test("edits, archives, and restores a Freeze Dryer", async ({ page }) => {
  const fakeBackend = await mockFreezeflowApi(page);

  await page.goto("/freeze-dryers");

  const blackCard = cardFor(page, "black");
  await blackCard.getByRole("button", { name: "Edit" }).click();

  const editForm = page.locator("article").filter({ hasText: "Tray Slots" });
  await editForm.getByLabel("Name").fill("matte black");
  await editForm.getByLabel("Notes").fill("main production dryer");
  await editForm.getByLabel("Tray Slots").fill("5");
  await editForm.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("heading", { name: "matte black" }),
  ).toBeVisible();
  await expect(page.getByText("main production dryer")).toBeVisible();
  await expect(page.getByText("5 Tray Slots")).toBeVisible();

  await cardFor(page, "matte black")
    .getByRole("button", { name: "Archive" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Archived Freeze Dryers" }),
  ).toBeVisible();
  await expect(archivedRowFor(page, "matte black")).toBeVisible();
  await expect(cardFor(page, "matte black")).toHaveCount(0);

  await archivedRowFor(page, "matte black")
    .getByRole("button", { name: "Restore" })
    .click();

  await expect(
    page.getByRole("heading", { name: "matte black" }),
  ).toBeVisible();
  await expect(cardFor(page, "matte black").getByText("Idle")).toBeVisible();

  expect(fakeBackend.updateFreezeDryerBodies).toEqual([
    {
      id: "freeze-dryer-1",
      body: {
        name: "matte black",
        notes: "main production dryer",
        tray_slot_count: 5,
      },
    },
    {
      id: "freeze-dryer-1",
      body: { archived: true },
    },
    {
      id: "freeze-dryer-1",
      body: { archived: false },
    },
  ]);
});

function freezeDryerCreateForm(page: Page) {
  return page.locator("form").filter({
    has: page.getByRole("button", { name: "+ New Freeze Dryer" }),
  });
}

function cardFor(page: Page, name: string) {
  return page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

function archivedRowFor(page: Page, name: string) {
  return page.locator(".row-line").filter({ hasText: name });
}
