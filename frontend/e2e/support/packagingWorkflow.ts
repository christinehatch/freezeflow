import { expect, type Locator, type Page } from "@playwright/test";

export type PlannedPackageValues = {
  packageTypeId?: string;
  finishedWeight: string;
  sealedWeight: string;
  storageLocationId?: string;
  notes?: string;
  displayName: string;
};

export function plannedPackageFinishedWeight(
  editor: Locator,
  allocationNumber: number,
  rowNumber: number,
) {
  return editor.getByRole("spinbutton", {
    name: `Allocation ${allocationNumber} Planned Package ${rowNumber} Finished Product Weight`,
    exact: true,
  });
}

export async function fillPlannedPackage(
  editor: Locator,
  allocationNumber: number,
  rowNumber: number,
  values: PlannedPackageValues,
) {
  const prefix = `Allocation ${allocationNumber} Planned Package ${rowNumber}`;
  const row = editor.getByLabel(`${prefix} pending editor`);
  await row
    .getByLabel(`${prefix} Package Type`)
    .selectOption(values.packageTypeId ?? "package-type-1");
  await plannedPackageFinishedWeight(editor, allocationNumber, rowNumber).fill(
    values.finishedWeight,
  );
  await row
    .getByRole("spinbutton", {
      name: `${prefix} Sealed Package Weight`,
      exact: true,
    })
    .fill(values.sealedWeight);
  await row
    .getByLabel(`${prefix} Storage Location`)
    .selectOption(values.storageLocationId ?? "storage-pantry");
  if (values.notes !== undefined) {
    await row.getByLabel(`${prefix} Package Notes`).fill(values.notes);
  }
  await row.getByText("Package Label Details").click();
  await row.getByLabel(`${prefix} Label Display Name`).fill(values.displayName);
}

export function plannedPackageSummary(page: Page, rowNumber: number) {
  return page
    .getByRole("heading", {
      name: `Planned Package ${rowNumber}`,
      exact: true,
    })
    .locator("xpath=ancestor::article[1]");
}

export type PrintWindowOptions = {
  blockOpen?: boolean;
  failNavigationTimes?: number;
};

export type PrintWindowState = {
  openedWith: string[];
  navigatedTo: string[];
  blobTypes: string[];
  blobTexts: string[];
  closeCount: number;
  revokeCount: number;
};

export async function stubPrintWindow(
  page: Page,
  blobUrl: string,
  options: PrintWindowOptions = {},
) {
  await page.addInitScript(
    ({ configuredBlobUrl, configuredOptions }) => {
      const state: PrintWindowState = {
        openedWith: [],
        navigatedTo: [],
        blobTypes: [],
        blobTexts: [],
        closeCount: 0,
        revokeCount: 0,
      };
      let remainingNavigationFailures =
        configuredOptions.failNavigationTimes ?? 0;
      Object.defineProperty(window, "__freezeflowPrintWindowState", {
        configurable: true,
        value: state,
      });
      URL.createObjectURL = (blob: Blob) => {
        state.blobTypes.push(blob.type);
        void blob.text().then((value) => state.blobTexts.push(value));
        return configuredBlobUrl;
      };
      URL.revokeObjectURL = () => {
        state.revokeCount += 1;
      };
      window.open = (url?: string | URL) => {
        state.openedWith.push(String(url ?? ""));
        if (configuredOptions.blockOpen) return null;

        const outputWindow = {
          closed: false,
          close() {
            this.closed = true;
            state.closeCount += 1;
          },
          document: {
            title: "",
            body: {
              replaceChildren() {},
              append() {},
            },
            createElement() {
              return { textContent: "", style: { cssText: "" } };
            },
          },
          location: {
            replace(destination: string) {
              if (remainingNavigationFailures > 0) {
                remainingNavigationFailures -= 1;
                throw new Error("Simulated reserved-window navigation failure");
              }
              state.navigatedTo.push(destination);
            },
          },
        };
        return outputWindow as unknown as Window;
      };
    },
    { configuredBlobUrl: blobUrl, configuredOptions: options },
  );
}

export async function printWindowState(page: Page) {
  return page.evaluate(() => {
    return (
      window as Window & {
        __freezeflowPrintWindowState?: PrintWindowState;
      }
    ).__freezeflowPrintWindowState;
  });
}

export async function expectOpenedPrintOutput(page: Page, blobUrl: string) {
  await expect
    .poll(async () => (await printWindowState(page))?.navigatedTo.join("\n"))
    .toContain(blobUrl);
}

export async function expectPrintPdfText(page: Page, expectedLines: string[]) {
  await expect
    .poll(async () => (await printWindowState(page))?.blobTexts.at(-1) ?? "")
    .toContain(expectedLines[0]);

  const state = await printWindowState(page);
  expect(state?.blobTypes.at(-1)).toBe("application/pdf");
  const pdfText = state?.blobTexts.at(-1) ?? "";
  for (const line of expectedLines) {
    expect(pdfText).toContain(line);
  }
  expect(pdfText).not.toContain("Storage:");
}
