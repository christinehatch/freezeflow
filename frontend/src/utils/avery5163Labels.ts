import type { Package, PackageLabel } from "../api/client";

export type Avery5163Label = {
  packageIdentifier: string;
  productName: string;
  preparationSummary: string;
  netWeightDisplay?: string | null;
  freshEquivalentDisplay?: string | null;
  freshEquivalentGrams: string | null;
  finishedProductWeightGrams: string | null;
  packageType: string;
  batchLine: string;
  oxygenAbsorber: string | null;
  packagedAt: string;
};

export function toAvery5163Label(item: {
  label: PackageLabel;
  recordedPackage: Package;
}): Avery5163Label {
  const { label, recordedPackage } = item;
  return {
    packageIdentifier: recordedPackage.package_identifier,
    productName: label.display_name,
    preparationSummary:
      label.ingredients_summary ||
      label.preparation_summary ||
      label.description ||
      "No ingredients or preparation summary",
    netWeightDisplay: label.net_weight_display,
    freshEquivalentDisplay: label.fresh_equivalent_display,
    freshEquivalentGrams: null,
    finishedProductWeightGrams:
      recordedPackage.finished_product_weight_grams === null
        ? null
        : String(recordedPackage.finished_product_weight_grams),
    packageType:
      recordedPackage.package_type?.name ?? "Package Type unavailable",
    batchLine: "",
    oxygenAbsorber: recordedPackage.oxygen_absorber,
    packagedAt: recordedPackage.packaged_at,
  };
}

export const AVERY_5163_LABELS_PER_SHEET = 10;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LABEL_WIDTH = 288;
const LABEL_HEIGHT = 144;
const LEFT_MARGIN = 13.5;
const TOP_MARGIN = 36;
const COLUMN_GAP = 9;

export type Avery5163PrintOutput = {
  close: () => void;
  load: (labels: Avery5163Label[]) => boolean;
};

export function reserveAvery5163PrintOutput(): Avery5163PrintOutput | null {
  const pdfWindow = window.open("", "_blank", "height=900,width=900");
  if (!pdfWindow) return null;

  showPrintOutputLoadingState(pdfWindow);

  return {
    close: () => {
      try {
        if (!pdfWindow.closed) pdfWindow.close();
      } catch {
        // The output window may have been closed or navigated by the browser.
      }
    },
    load: (labels) => loadAvery5163PrintOutput(pdfWindow, labels),
  };
}

export function printAvery5163Labels(labels: Avery5163Label[]) {
  const output = reserveAvery5163PrintOutput();
  if (!output) return false;

  const loaded = output.load(labels);
  if (!loaded) output.close();
  return loaded;
}

function loadAvery5163PrintOutput(pdfWindow: Window, labels: Avery5163Label[]) {
  if (pdfWindow.closed) return false;

  const pdf = buildPdf(labels);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    pdfWindow.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}

function showPrintOutputLoadingState(pdfWindow: Window) {
  try {
    pdfWindow.document.title = "Preparing Avery 5163 output";
    pdfWindow.document.body.replaceChildren();
    const status = pdfWindow.document.createElement("p");
    status.textContent =
      "Freezeflow is recording the Print Events and preparing Avery 5163 output…";
    status.style.cssText =
      "font: 16px system-ui, sans-serif; margin: 2rem; color: #334155;";
    pdfWindow.document.body.append(status);
  } catch {
    // A browser may restrict access to the reserved window before navigation.
  }
}

function buildPdf(labels: Avery5163Label[]) {
  const pages = paginateAvery5163Items(labels);
  if (pages.length === 0) pages.push([]);
  const pageContentObjects = pages.map(renderPageContent);
  const pageReferences = pages
    .map((_, index) => `${3 + index * 2} 0 R`)
    .join(" ");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageReferences}] /Count ${pages.length} >>`,
  ];

  pages.forEach((_, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(streamObject(pageContentObjects[index]));
  });

  return serializePdf(objects);
}

function renderPageContent(labels: Avery5163Label[]) {
  return labels.map(renderLabel).join("\n");
}

function renderLabel(label: Avery5163Label, index: number) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const labelLeft = LEFT_MARGIN + column * (LABEL_WIDTH + COLUMN_GAP);
  const labelTop = TOP_MARGIN + row * LABEL_HEIGHT;
  const textX = labelLeft + 13;
  const productLines = wrapText(label.productName, 31, 1);
  const preparationLines = wrapText(label.preparationSummary, 48, 2);
  const equivalence = freshEquivalentLine(label);
  const detailLines = [
    `${label.packageType} · ${formatPackagingDate(label.packagedAt)}`,
    label.batchLine,
    `Oxygen absorber: ${label.oxygenAbsorber ?? "None"}`,
  ].filter((line): line is string => Boolean(line));

  return [
    pdfText(
      textX,
      yFromTop(labelTop + 20),
      label.packageIdentifier.toUpperCase(),
      {
        font: "F2",
        size: 8,
        color: "0.28 0.33 0.41",
      },
    ),
    ...productLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 38 + lineIndex * 15), line, {
        font: "F2",
        size: 14,
        color: "0.01 0.02 0.09",
      }),
    ),
    pdfText(textX, yFromTop(labelTop + 56), equivalence, {
      font: "F2",
      size: 10,
      color: "0.01 0.02 0.09",
    }),
    ...preparationLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 72 + lineIndex * 10), line, {
        font: "F1",
        size: 7,
        color: "0.20 0.25 0.33",
      }),
    ),
    ...detailLines.map((line, lineIndex) =>
      pdfText(
        textX,
        yFromTop(labelTop + 98 + lineIndex * 11),
        truncateText(line, 48),
        {
          font: "F1",
          size: 8,
          color: "0.20 0.25 0.33",
        },
      ),
    ),
  ].join("\n");
}

function freshEquivalentLine(label: Avery5163Label) {
  if (label.netWeightDisplay || label.freshEquivalentDisplay) {
    return [
      label.freshEquivalentDisplay
        ? `${label.freshEquivalentDisplay} fresh`
        : "Fresh equivalent unavailable",
      label.netWeightDisplay ?? "Freeze-dried weight unavailable",
    ].join(" = ");
  }
  if (
    label.freshEquivalentGrams === null ||
    label.finishedProductWeightGrams === null
  ) {
    return "Fresh equivalent unavailable";
  }
  return `${formatConvertedWeight(label.freshEquivalentGrams, 453.59237)} lb fresh = ${formatConvertedWeight(label.finishedProductWeightGrams, 28.349523125)} oz freeze-dried`;
}

function formatConvertedWeight(value: string, gramsPerUnit: number) {
  return (Number(value) / gramsPerUnit).toFixed(2).replace(/\.?0+$/, "");
}

function formatPackagingDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function pdfText(
  x: number,
  y: number,
  text: string,
  options: { font: "F1" | "F2"; size: number; color: string },
) {
  return `BT ${options.color} rg /${options.font} ${options.size} Tf 1 0 0 1 ${formatNumber(x)} ${formatNumber(y)} Tm (${escapePdfText(text)}) Tj ET`;
}

function yFromTop(y: number) {
  return PAGE_HEIGHT - y;
}

function streamObject(content: string) {
  return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
}

function serializePdf(objects: string[]) {
  const lines = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteOffset = lines[0].length;

  objects.forEach((object, index) => {
    const objectNumber = index + 1;
    const serialized = `${objectNumber} 0 obj\n${object}\nendobj\n`;
    offsets.push(byteOffset);
    lines.push(serialized);
    byteOffset += serialized.length;
  });

  const xrefOffset = byteOffset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");

  return `${lines.join("")}${xref}`;
}

export function paginateAvery5163Items<Item>(items: Item[]) {
  const chunks: Item[][] = [];
  for (
    let index = 0;
    index < items.length;
    index += AVERY_5163_LABELS_PER_SHEET
  ) {
    chunks.push(items.slice(index, index + AVERY_5163_LABELS_PER_SHEET));
  }
  return chunks;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, " ");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function wrapText(value: string, maxLength: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine === "" ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxLength) {
      currentLine = candidate;
      continue;
    }
    if (currentLine !== "") {
      lines.push(currentLine);
    }
    currentLine = word;
    if (lines.length === maxLines) break;
  }

  if (currentLine !== "" && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return [truncateText(value, maxLength)];
  }

  if (words.join(" ").length > lines.join(" ").length) {
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = truncateText(lastLine, maxLength);
  }

  return lines;
}
