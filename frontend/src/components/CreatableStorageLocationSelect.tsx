import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useState } from "react";

import { inventoryApi } from "../api/client";
import {
  Button,
  Field,
  Modal,
  Select,
  TextField,
  type SelectOption,
} from "./design-system";
import { formatApiError } from "../utils/apiErrors";

const CREATE_NEW_STORAGE_LOCATION = "__create_new_storage_location__";

type CreatableStorageLocationSelectProps = {
  id: string;
  invalidateQueryKey: QueryKey;
  label: string;
  onChange: (storageLocationId: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
};

export function CreatableStorageLocationSelect({
  id,
  invalidateQueryKey,
  label,
  onChange,
  options,
  placeholder,
  value,
}: CreatableStorageLocationSelectProps) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: inventoryApi.createStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: (created) => {
      setError(null);
      setIsCreating(false);
      setDraft({ name: "", notes: "" });
      onChange(created.id);
      void queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
    },
  });

  return (
    <>
      <Field htmlFor={id} label={label}>
        <Select
          id={id}
          options={[
            ...options,
            {
              value: CREATE_NEW_STORAGE_LOCATION,
              label: "+ New Storage Location…",
              accent: true,
            },
          ]}
          placeholder={placeholder}
          value={value}
          onChange={(selected) => {
            if (selected === CREATE_NEW_STORAGE_LOCATION) {
              setError(null);
              setIsCreating(true);
              return;
            }
            onChange(selected);
          }}
        />
      </Field>
      {isCreating ? (
        <Modal
          onClose={() => setIsCreating(false)}
          title="New Storage Location"
        >
          {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
          <div className="space-y-3">
            <Field htmlFor={`${id}-new-name`} label="Name">
              <TextField
                id={`${id}-new-name`}
                placeholder="Bin 34"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Field>
            <Field htmlFor={`${id}-new-notes`} label="Notes" optional>
              <TextField
                id={`${id}-new-notes`}
                placeholder="Basement"
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </Field>
          </div>
          <div className="ds-modal__actions">
            <Button
              disabled={createMutation.isPending}
              type="button"
              variant="secondary"
              onClick={() => setIsCreating(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!draft.name.trim() || createMutation.isPending}
              type="button"
              onClick={() =>
                createMutation.mutate({
                  name: draft.name.trim(),
                  notes: draft.notes.trim() || null,
                })
              }
            >
              {createMutation.isPending ? "Creating…" : "Create and select"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
