import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { preparationPresetsApi, type PreparationPreset } from "../api/client";
import {
  Button,
  Field,
  PageHeader,
  SectionHeader,
  StatusBanner,
  Surface,
  TagAutocompleteField,
  Textarea,
  TextField,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";

const QUERY_KEY = ["preparation-presets", "including-archived"];

type Draft = {
  name: string;
  productName: string;
  ingredients: string[];
  preparationMethods: string[];
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  productName: "",
  ingredients: [],
  preparationMethods: [],
  notes: "",
};

export function PreparationPresetsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      preparationPresetsApi.listPreparationPresets({ includeArchived: true }),
  });
  const ingredientSuggestionsQuery = useQuery({
    queryKey: ["preparation-preset-suggestions", "ingredients"],
    queryFn: () => preparationPresetsApi.getSuggestions("ingredients"),
  });
  const preparationMethodSuggestionsQuery = useQuery({
    queryKey: ["preparation-preset-suggestions", "preparation_methods"],
    queryFn: () => preparationPresetsApi.getSuggestions("preparation_methods"),
  });
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  const createPreset = useMutation({
    mutationFn: preparationPresetsApi.createPreparationPreset,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const archivePreset = useMutation({
    mutationFn: preparationPresetsApi.archivePreparationPreset,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const restorePreset = useMutation({
    mutationFn: preparationPresetsApi.restorePreparationPreset,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const updatePreset = useMutation({
    mutationFn: (params: { id: string; draft: Draft }) =>
      preparationPresetsApi.updatePreparationPreset(params.id, {
        name: params.draft.name.trim(),
        product_name: params.draft.productName.trim(),
        ingredients: params.draft.ingredients,
        preparation_methods: params.draft.preparationMethods,
        notes: params.draft.notes.trim() || null,
      }),
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  function startEditing(preset: PreparationPreset) {
    setError(null);
    setEditingId(preset.id);
    setEditDraft({
      name: preset.name,
      productName: preset.product_name,
      ingredients: preset.ingredients ?? [],
      preparationMethods: preset.preparation_methods ?? [],
      notes: preset.notes ?? "",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createPreset.mutate({
      name: draft.name,
      product_name: draft.productName,
      ingredients: draft.ingredients,
      preparation_methods: draft.preparationMethods,
      notes: draft.notes.trim() || null,
    });
  }

  function goBack() {
    if (location.key === "default") {
      navigate("/production");
    } else {
      navigate(-1);
    }
  }

  const presets = presetsQuery.data ?? [];
  const activePresets = presets.filter((preset) => !preset.archived);
  const archivedPresets = presets.filter((preset) => preset.archived);
  const ingredientSuggestions = ingredientSuggestionsQuery.data ?? [];
  const preparationMethodSuggestions =
    preparationMethodSuggestionsQuery.data ?? [];

  return (
    <div className="preparation-presets-page">
      <nav>
        <button className="quiet-action -ml-3" type="button" onClick={goBack}>
          &larr; Back
        </button>
      </nav>

      <PageHeader
        description="Reusable starting points for a Tray's product name, ingredients, and preparation methods. Selecting one only pre-fills the Tray setup form - it never overrides what the operator actually submits."
        eyebrow="Production setup"
        title="Preparation Presets"
      />

      {error ? (
        <StatusBanner
          body={error}
          title="Preparation Preset action failed"
          tone="danger"
        />
      ) : null}

      <Surface>
        <SectionHeader title="Create Preparation Preset" />
        <form className="preparation-preset-form" onSubmit={handleSubmit}>
          <Field htmlFor="preparation-preset-name" label="Name">
            <TextField
              id="preparation-preset-name"
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </Field>
          <Field htmlFor="preparation-preset-product-name" label="Product Name">
            <TextField
              id="preparation-preset-product-name"
              required
              value={draft.productName}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  productName: event.target.value,
                }))
              }
            />
          </Field>
          <TagAutocompleteField
            id="preparation-preset-ingredients"
            label="Ingredients"
            suggestions={ingredientSuggestions}
            values={draft.ingredients}
            onChange={(ingredients) =>
              setDraft((current) => ({ ...current, ingredients }))
            }
          />
          <TagAutocompleteField
            id="preparation-preset-preparation-methods"
            label="Preparation Methods"
            suggestions={preparationMethodSuggestions}
            values={draft.preparationMethods}
            onChange={(preparationMethods) =>
              setDraft((current) => ({ ...current, preparationMethods }))
            }
          />
          <Field htmlFor="preparation-preset-notes" label="Notes" optional>
            <Textarea
              id="preparation-preset-notes"
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </Field>
          <Button disabled={createPreset.isPending} type="submit">
            {createPreset.isPending ? "Creating…" : "Add Preparation Preset"}
          </Button>
        </form>
      </Surface>

      <section aria-labelledby="active-preparation-presets">
        <SectionHeader
          id="active-preparation-presets"
          title="Active Preparation Presets"
        />
        {presetsQuery.isLoading ? (
          <Surface>Loading Preparation Presets…</Surface>
        ) : presetsQuery.isError ? (
          <StatusBanner
            body={formatApiError(presetsQuery.error)}
            title="Preparation Presets could not be loaded"
            tone="danger"
          />
        ) : activePresets.length ? (
          <div className="preparation-preset-list">
            {activePresets.map((preset) => (
              <PreparationPresetCard
                editDraft={editDraft}
                ingredientSuggestions={ingredientSuggestions}
                isEditing={editingId === preset.id}
                isSaving={updatePreset.isPending}
                key={preset.id}
                preparationMethodSuggestions={preparationMethodSuggestions}
                preset={preset}
                secondaryAction={
                  <Button
                    disabled={archivePreset.isPending}
                    variant="secondary"
                    onClick={() => archivePreset.mutate(preset.id)}
                  >
                    Archive
                  </Button>
                }
                onCancelEdit={() => setEditingId(null)}
                onChangeDraft={setEditDraft}
                onStartEdit={() => startEditing(preset)}
                onSubmitEdit={() =>
                  updatePreset.mutate({ id: preset.id, draft: editDraft })
                }
              />
            ))}
          </div>
        ) : (
          <Surface>No active Preparation Presets yet.</Surface>
        )}
      </section>

      {archivedPresets.length ? (
        <section aria-labelledby="archived-preparation-presets">
          <SectionHeader
            id="archived-preparation-presets"
            title="Archived Preparation Presets"
          />
          <div className="preparation-preset-list">
            {archivedPresets.map((preset) => (
              <PreparationPresetCard
                editDraft={editDraft}
                ingredientSuggestions={ingredientSuggestions}
                isEditing={editingId === preset.id}
                isSaving={updatePreset.isPending}
                key={preset.id}
                preparationMethodSuggestions={preparationMethodSuggestions}
                preset={preset}
                secondaryAction={
                  <Button
                    disabled={restorePreset.isPending}
                    variant="secondary"
                    onClick={() => restorePreset.mutate(preset.id)}
                  >
                    Restore
                  </Button>
                }
                onCancelEdit={() => setEditingId(null)}
                onChangeDraft={setEditDraft}
                onStartEdit={() => startEditing(preset)}
                onSubmitEdit={() =>
                  updatePreset.mutate({ id: preset.id, draft: editDraft })
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PreparationPresetCard({
  editDraft,
  ingredientSuggestions,
  isEditing,
  isSaving,
  preparationMethodSuggestions,
  preset,
  secondaryAction,
  onCancelEdit,
  onChangeDraft,
  onStartEdit,
  onSubmitEdit,
}: {
  editDraft: Draft;
  ingredientSuggestions: string[];
  isEditing: boolean;
  isSaving: boolean;
  preparationMethodSuggestions: string[];
  preset: PreparationPreset;
  secondaryAction: ReactNode;
  onCancelEdit: () => void;
  onChangeDraft: (draft: Draft) => void;
  onStartEdit: () => void;
  onSubmitEdit: () => void;
}) {
  if (isEditing) {
    return (
      <Surface className="preparation-preset-card preparation-preset-card--editing">
        <form
          className="preparation-preset-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitEdit();
          }}
        >
          <Field htmlFor={`preparation-preset-name-${preset.id}`} label="Name">
            <TextField
              id={`preparation-preset-name-${preset.id}`}
              required
              value={editDraft.name}
              onChange={(event) =>
                onChangeDraft({ ...editDraft, name: event.target.value })
              }
            />
          </Field>
          <Field
            htmlFor={`preparation-preset-product-name-${preset.id}`}
            label="Product Name"
          >
            <TextField
              id={`preparation-preset-product-name-${preset.id}`}
              required
              value={editDraft.productName}
              onChange={(event) =>
                onChangeDraft({
                  ...editDraft,
                  productName: event.target.value,
                })
              }
            />
          </Field>
          <TagAutocompleteField
            id={`preparation-preset-ingredients-${preset.id}`}
            label="Ingredients"
            suggestions={ingredientSuggestions}
            values={editDraft.ingredients}
            onChange={(ingredients) =>
              onChangeDraft({ ...editDraft, ingredients })
            }
          />
          <TagAutocompleteField
            id={`preparation-preset-preparation-methods-${preset.id}`}
            label="Preparation Methods"
            suggestions={preparationMethodSuggestions}
            values={editDraft.preparationMethods}
            onChange={(preparationMethods) =>
              onChangeDraft({ ...editDraft, preparationMethods })
            }
          />
          <Field
            htmlFor={`preparation-preset-notes-${preset.id}`}
            label="Notes"
            optional
          >
            <Textarea
              id={`preparation-preset-notes-${preset.id}`}
              value={editDraft.notes}
              onChange={(event) =>
                onChangeDraft({ ...editDraft, notes: event.target.value })
              }
            />
          </Field>
          <div className="preparation-preset-card__edit-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving…" : "Save"}
            </Button>
            <Button
              disabled={isSaving}
              type="button"
              variant="secondary"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Surface>
    );
  }

  return (
    <Surface className="preparation-preset-card">
      <div>
        <h3>{preset.name}</h3>
        <p className="preparation-preset-card__product">
          {preset.product_name}
        </p>
        {preset.ingredients && preset.ingredients.length > 0 ? (
          <p>
            <span className="label-text">Ingredients: </span>
            {preset.ingredients.join(", ")}
          </p>
        ) : null}
        {preset.preparation_methods && preset.preparation_methods.length > 0 ? (
          <p>
            <span className="label-text">Preparation Methods: </span>
            {preset.preparation_methods.join(", ")}
          </p>
        ) : null}
        {preset.notes ? <p>{preset.notes}</p> : null}
      </div>
      <div className="preparation-preset-card__actions">
        <Button variant="secondary" onClick={onStartEdit}>
          Edit
        </Button>
        {secondaryAction}
      </div>
    </Surface>
  );
}
