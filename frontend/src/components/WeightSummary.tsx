import { formatGrams } from "../utils/weights";

export function WeightSummary({
  allocatedWeightGrams,
  remainingWeightGrams,
  selectedWeightGrams,
}: {
  allocatedWeightGrams: number | null;
  remainingWeightGrams: number | null;
  selectedWeightGrams: number | null;
}) {
  const remainingState =
    remainingWeightGrams === null
      ? "unavailable"
      : remainingWeightGrams < 0
        ? "overallocated"
        : remainingWeightGrams === 0
          ? "balanced"
          : "remaining";

  return (
    <dl className="packaging-weight-summary">
      <WeightValue label="Selected Source" value={selectedWeightGrams} />
      <WeightValue label="Allocated to Packages" value={allocatedWeightGrams} />
      <WeightValue
        dominant
        label={
          remainingState === "overallocated"
            ? "Overallocated"
            : "Remaining to Package"
        }
        state={remainingState}
        value={
          remainingWeightGrams === null ? null : Math.abs(remainingWeightGrams)
        }
      />
    </dl>
  );
}

function WeightValue({
  dominant = false,
  label,
  state,
  value,
}: {
  dominant?: boolean;
  label: string;
  state?: string;
  value: number | null;
}) {
  return (
    <div
      className={`packaging-weight-summary__item${dominant ? " packaging-weight-summary__item--dominant" : ""}${state ? ` packaging-weight-summary__item--${state}` : ""}`}
    >
      <dt>{label}</dt>
      <dd>{value === null ? "Unavailable" : formatGrams(String(value), 3)}</dd>
    </div>
  );
}
