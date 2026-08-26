import { useState } from "react";

import { formatApiError } from "../utils/apiErrors";
import { Button, Field, TextField, Textarea } from "./design-system";

type CorrectableFieldProps = {
  fieldId: string;
  label: string;
  value: string;
  displayValue?: string;
  multiline?: boolean;
  onSave: (correctedValue: string, reason: string | null) => Promise<unknown>;
};

/**
 * A current value plus a "Correct" action that reveals an inline
 * correction form (new value + optional reason). Generalizes the
 * Weight Check correction UI already proven in ProductionBatchPage.tsx
 * to every ADR-0005 correctable field.
 */
export function CorrectableField({
  fieldId,
  label,
  value,
  displayValue,
  multiline = false,
  onSave,
}: CorrectableFieldProps) {
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isCorrecting) {
    return (
      <div className="correctable-field">
        <span className="correctable-field__label">{label}</span>
        <span className="correctable-field__value">
          {displayValue ?? (value.trim() === "" ? "Not recorded" : value)}
        </span>
        <button
          aria-label={`Correct ${label}`}
          className="quiet-action"
          type="button"
          onClick={() => {
            setDraftValue(value);
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

  const InputComponent = multiline ? Textarea : TextField;
  const isUnchanged = draftValue.trim() === value.trim();

  return (
    <div className="correctable-field correctable-field--editing">
      {error ? (
        <p className="correctable-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <Field htmlFor={fieldId} label={`Corrected ${label}`}>
        <InputComponent
          id={fieldId}
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
        />
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
          disabled={isSaving || isUnchanged}
          type="button"
          onClick={async () => {
            setIsSaving(true);
            setError(null);
            try {
              await onSave(
                draftValue,
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
