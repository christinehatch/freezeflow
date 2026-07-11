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

export function fromGramsForInput(value: string | null): {
  value: string;
  unit: WeightUnit;
} {
  if (value === null) return { value: "", unit: "g" };
  const grams = Number(value);
  if (!Number.isFinite(grams)) return { value: "", unit: "g" };

  if (Math.abs(grams) >= 453.59237) {
    return { value: formatInputDecimal(grams / 453.59237), unit: "lb" };
  }
  if (Math.abs(grams) >= 28.349523125) {
    return { value: formatInputDecimal(grams / 28.349523125), unit: "oz" };
  }
  return { value: formatInputDecimal(grams), unit: "g" };
}

function formatDecimal(value: number) {
  return value.toFixed(3);
}

function formatInputDecimal(value: number) {
  return Number(value.toFixed(3)).toString();
}
