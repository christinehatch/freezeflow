import { expect, test } from "@playwright/test";

test("seeds the Basic Demo from the developer-only page", async ({ page }) => {
  let requestCount = 0;
  await page.route("http://127.0.0.1:8000/dev/demo/basic", async (route) => {
    requestCount += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          action: "basic",
          message: "Basic demo seeded for browser testing.",
          counts: {
            freeze_dryers: 2,
            recipes: 4,
            production_batches: 4,
            packages: 3,
          },
        },
        meta: {},
      }),
    });
  });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/developer-tools");
  await expect(
    page.getByRole("heading", { name: "Developer Tools" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Seed Basic Demo" }).click();

  const result = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Developer action complete" }),
  });
  await expect(
    result.getByText("Basic demo seeded for browser testing."),
  ).toBeVisible();
  await expect(page.getByText("production batches")).toBeVisible();
  await expect(result.getByText("4", { exact: true }).first()).toBeVisible();
  expect(requestCount).toBe(1);
});
