export type WeightUnit = "g" | "oz" | "lb";

export const WEIGHT_UNIT_OPTIONS: { label: string; value: WeightUnit }[] = [
  { label: "g", value: "g" },
  { label: "oz", value: "oz" },
  { label: "lb", value: "lb" },
];

export function toGrams(value: string, unit: WeightUnit) {
  if (value === "") return "";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";

  if (unit === "oz") return formatDecimal(numericValue * 28.349523125);
  if (unit === "lb") return formatDecimal(numericValue * 453.59237);
  return formatDecimal(numericValue);
}

export function formatGrams(value: string | null, maximumFractionDigits = 1) {
  if (value === null) return "-";
  return `${Number(value).toLocaleString(undefined, {
    maximumFractionDigits,
  })} g`;
}

function formatDecimal(value: number) {
  return value.toFixed(3);
}
