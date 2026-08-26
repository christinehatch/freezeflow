import { useState } from "react";

import { formatApiError } from "../utils/apiErrors";
import {
  formatGrams,
  toGrams,
  WEIGHT_UNIT_OPTIONS,
  type WeightUnit,
} from "../utils/weights";
import { Button, Field, NumberField, Select, TextField } from "./design-system";

type WeightCorrectableFieldProps = {
  fieldId: string;
  label: string;
  valueGrams: string;
  onSave: (correctedGrams: string, reason: string | null) => Promise<unknown>;
};

/** Weight-specific variant of CorrectableField with unit conversion. */
export function WeightCorrectableField({
  fieldId,
  label,
  valueGrams,
  onSave,
}: WeightCorrectableFieldProps) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [draftUnit, setDraftUnit] = useState<WeightUnit>("g");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isCorrecting) {
    return (
      <div className="correctable-field">
        <span className="correctable-field__label">{label}</span>
        <span className="correctable-field__value">
          {formatGrams(valueGrams)}
        </span>
        <button
          aria-label={`Correct ${label}`}
          className="quiet-action"
          type="button"
          onClick={() => {
            // Starts in grams with the exact stored value, matching the
            // proven Weight Check correction pattern — avoiding the lb/oz
            // round-trip precision loss a smart-unit default would risk.
            setDraftValue(valueGrams);
            setDraftUnit("g");
            setReason("");
            setError(null);
            setIsCorrecting(true);
          }}
        >
          Correct
        </button>
      </div>
    );
  }

  const correctedGrams =
    draftValue === "" ? "" : toGrams(draftValue, draftUnit);
  const isUnchanged =
    correctedGrams !== "" && Number(correctedGrams) === Number(valueGrams);

  return (
    <div className="correctable-field correctable-field--editing">
      {error ? (
        <p className="correctable-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Field htmlFor={fieldId} label={`Corrected ${label}`}>
        <div className="production-weight-input">
          <NumberField
            id={fieldId}
            min="0"
            step="0.001"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
          />
          <Select
            aria-label={`${label} unit`}
            className="production-weight-input__unit"
            id={`${fieldId}-unit`}
            onChange={(unit) => setDraftUnit(unit as WeightUnit)}
            options={WEIGHT_UNIT_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={draftUnit}
          />
        </div>
      </Field>
      <Field htmlFor={`${fieldId}-reason`} label="Correction reason" optional>
        <TextField
          id={`${fieldId}-reason`}
          placeholder="reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <div className="correctable-field__actions">
        <Button
          disabled={isSaving || draftValue === "" || isUnchanged}
          type="button"
          onClick={async () => {
            setIsSaving(true);
            setError(null);
            try {
              await onSave(
                toGrams(draftValue, draftUnit),
                reason.trim() === "" ? null : reason.trim(),
              );
              setIsCorrecting(false);
            } catch (caught) {
              setError(formatApiError(caught));
            } finally {
              setIsSaving(false);
            }
          }}
        >
          Save Correction
        </Button>
        <Button
          disabled={isSaving}
          type="button"
          variant="secondary"
          onClick={() => setIsCorrecting(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
