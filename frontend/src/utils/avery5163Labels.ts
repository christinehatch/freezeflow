export type Avery5163Label = {
  packageIdentifier: string;
  productName: string;
  packageLine: string;
  batchLine: string;
  oxygenAbsorber: string | null;
  storageLocation: string;
};

const LABELS_PER_SHEET = 10;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LABEL_WIDTH = 288;
const LABEL_HEIGHT = 144;
const LEFT_MARGIN = 13.5;
const TOP_MARGIN = 36;
const COLUMN_GAP = 9;

export function printAvery5163Labels(labels: Avery5163Label[]) {
  const pdf = buildPdf(labels);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const pdfWindow = window.open(url, "_blank", "height=900,width=900");

  if (!pdfWindow) {
    URL.revokeObjectURL(url);
    return false;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

function buildPdf(labels: Avery5163Label[]) {
  const pages = chunkLabels(labels, LABELS_PER_SHEET);
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
  const productLines = wrapText(label.productName, 24, 2);
  const detailLines = [
    label.packageLine,
    label.batchLine,
    label.oxygenAbsorber ? `Oxygen absorber: ${label.oxygenAbsorber}` : null,
    `Storage: ${label.storageLocation}`,
  ].filter((line): line is string => Boolean(line));

  return [
    pdfText(textX, yFromTop(labelTop + 20), label.packageIdentifier.toUpperCase(), {
      font: "F2",
      size: 8,
      color: "0.28 0.33 0.41",
    }),
    ...productLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 42 + lineIndex * 17), line, {
        font: "F2",
        size: 16,
        color: "0.01 0.02 0.09",
      }),
    ),
    ...detailLines.map((line, lineIndex) =>
      pdfText(textX, yFromTop(labelTop + 76 + lineIndex * 13), truncateText(line, 44), {
        font: "F1",
        size: 9,
        color: "0.20 0.25 0.33",
      }),
    ),
  ].join("\n");
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

function chunkLabels(labels: Avery5163Label[], chunkSize: number) {
  const chunks: Avery5163Label[][] = [];
  for (let index = 0; index < labels.length; index += chunkSize) {
    chunks.push(labels.slice(index, index + chunkSize));
  }
  return chunks.length > 0 ? chunks : [[]];
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
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
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
