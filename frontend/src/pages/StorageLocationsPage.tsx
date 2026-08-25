import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { inventoryApi, type StorageLocation } from "../api/client";
import {
  Button,
  ButtonLink,
  PageHeader,
  SectionHeader,
  StatusBanner,
  Surface,
} from "../components/design-system";
import { formatApiError } from "../utils/apiErrors";
import {
  reserveBinContentsPrintOutput,
  toBinContents,
} from "../utils/binContentsPrintouts";

const UNASSIGNED_LOCATION_NAME = "Unassigned";

const QUERY_KEY = ["storage-locations", "including-archived"];

export function StorageLocationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const storageLocationsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => inventoryApi.listStorageLocations({ includeArchived: true }),
  });
  const [draft, setDraft] = useState({ name: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", notes: "" });

  const createStorageLocation = useMutation({
    mutationFn: inventoryApi.createStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setDraft({ name: "", notes: "" });
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const archiveStorageLocation = useMutation({
    mutationFn: inventoryApi.archiveStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const restoreStorageLocation = useMutation({
    mutationFn: inventoryApi.restoreStorageLocation,
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
  const updateStorageLocation = useMutation({
    mutationFn: (params: {
      id: string;
      name?: string;
      notes?: string | null;
    }) =>
      inventoryApi.updateStorageLocation(params.id, {
        name: params.name,
        notes: params.notes,
      }),
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: () => {
      setError(null);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const printContentsMutation = useMutation({
    mutationFn: async (location: StorageLocation) => {
      const output = reserveBinContentsPrintOutput();
      const packages = await inventoryApi.searchInventory({
        storageLocationId: location.id,
        status: "In Storage",
        limit: 500,
      });
      if (packages.length === 0) {
        output?.close();
        return { notice: `${location.name} has nothing in it to print.` };
      }
      output?.load([toBinContents(location, packages)]);
      return { notice: null };
    },
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: (result) => {
      setError(null);
      setPrintNotice(result.notice);
    },
  });

  const printAllBinsMutation = useMutation({
    mutationFn: async () => {
      const output = reserveBinContentsPrintOutput();
      const targets = (storageLocationsQuery.data ?? []).filter(
        (item) => !item.archived,
      );
      const results = await Promise.all(
        targets.map((target) =>
          inventoryApi.searchInventory({
            storageLocationId: target.id,
            status: "In Storage",
            limit: 500,
          }),
        ),
      );
      const bins = targets
        .map((target, index) => ({ target, packages: results[index] }))
        .filter(({ packages }) => packages.length > 0)
        .map(({ target, packages }) => toBinContents(target, packages));
      if (bins.length === 0) {
        output?.close();
        return {
          notice:
            "No active Storage Locations currently have anything to print.",
        };
      }
      output?.load(bins);
      return { notice: null };
    },
    onError: (mutationError) => setError(formatApiError(mutationError)),
    onSuccess: (result) => {
      setError(null);
      setPrintNotice(result.notice);
    },
  });

  function startEditing(location: StorageLocation) {
    setError(null);
    setEditingId(location.id);
    setEditDraft({ name: location.name, notes: location.notes ?? "" });
  }

  function submitEdit(location: StorageLocation) {
    const isUnassigned = location.name === UNASSIGNED_LOCATION_NAME;
    updateStorageLocation.mutate({
      id: location.id,
      notes: editDraft.notes.trim() || null,
      ...(isUnassigned ? {} : { name: editDraft.name.trim() }),
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createStorageLocation.mutate({
      name: draft.name,
      notes: draft.notes.trim() || null,
    });
  }

  function goBack() {
    if (location.key === "default") {
      navigate("/inventory");
    } else {
      navigate(-1);
    }
  }

  const locations = storageLocationsQuery.data ?? [];
  const activeLocations = locations.filter((item) => !item.archived);
  const archivedLocations = locations.filter((item) => item.archived);

  return (
    <div className="storage-locations-page">
      <nav>
        <button className="quiet-action -ml-3" type="button" onClick={goBack}>
          &larr; Back
        </button>
      </nav>

      <PageHeader
        description="Manage the physical places Packages are stored without interrupting active Inventory work."
        eyebrow="Inventory setup"
        title="Storage Locations"
      />

      {error ? (
        <StatusBanner
          body={error}
          title="Storage Location action failed"
          tone="danger"
        />
      ) : null}

      {printNotice ? (
        <StatusBanner body={printNotice} title="Nothing to print" tone="calm" />
      ) : null}

      <Surface>
        <SectionHeader title="Create Storage Location" />
        <form className="storage-location-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              required
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="field storage-location-form__notes">
            <span>Notes</span>
            <input
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </label>
          <Button disabled={createStorageLocation.isPending} type="submit">
            {createStorageLocation.isPending
              ? "Creating…"
              : "Add Storage Location"}
          </Button>
        </form>
      </Surface>

      <section aria-labelledby="active-storage-locations">
        <SectionHeader
          action={
            activeLocations.length ? (
              <Button
                disabled={printAllBinsMutation.isPending}
                variant="secondary"
                onClick={() => printAllBinsMutation.mutate()}
              >
                Print All Bins
              </Button>
            ) : null
          }
          id="active-storage-locations"
          title="Active Storage Locations"
        />
        {storageLocationsQuery.isLoading ? (
          <Surface>Loading Storage Locations…</Surface>
        ) : storageLocationsQuery.isError ? (
          <StatusBanner
            body={formatApiError(storageLocationsQuery.error)}
            title="Storage Locations could not be loaded"
            tone="danger"
          />
        ) : activeLocations.length ? (
          <div className="storage-location-list">
            {activeLocations.map((location) => (
              <StorageLocationCard
                editDraft={editDraft}
                isEditing={editingId === location.id}
                isSaving={updateStorageLocation.isPending}
                key={location.id}
                location={location}
                secondaryAction={
                  <Button
                    disabled={
                      archiveStorageLocation.isPending ||
                      location.name === UNASSIGNED_LOCATION_NAME
                    }
                    variant="secondary"
                    onClick={() => archiveStorageLocation.mutate(location.id)}
                  >
                    Archive
                  </Button>
                }
                onCancelEdit={() => setEditingId(null)}
                onChangeDraft={setEditDraft}
                onPrintContents={() => printContentsMutation.mutate(location)}
                onStartEdit={() => startEditing(location)}
                onSubmitEdit={() => submitEdit(location)}
                printPending={printContentsMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <Surface>No active Storage Locations yet.</Surface>
        )}
      </section>

      {archivedLocations.length ? (
        <section aria-labelledby="archived-storage-locations">
          <SectionHeader
            id="archived-storage-locations"
            title="Archived Storage Locations"
          />
          <div className="storage-location-list">
            {archivedLocations.map((location) => (
              <StorageLocationCard
                editDraft={editDraft}
                isEditing={editingId === location.id}
                isSaving={updateStorageLocation.isPending}
                key={location.id}
                location={location}
                secondaryAction={
                  <Button
                    disabled={restoreStorageLocation.isPending}
                    variant="secondary"
                    onClick={() => restoreStorageLocation.mutate(location.id)}
                  >
                    Restore
                  </Button>
                }
                onCancelEdit={() => setEditingId(null)}
                onChangeDraft={setEditDraft}
                onStartEdit={() => startEditing(location)}
                onSubmitEdit={() => submitEdit(location)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StorageLocationCard({
  editDraft,
  isEditing,
  isSaving,
  location,
  secondaryAction,
  onCancelEdit,
  onChangeDraft,
  onPrintContents,
  onStartEdit,
  onSubmitEdit,
  printPending = false,
}: {
  editDraft: { name: string; notes: string };
  isEditing: boolean;
  isSaving: boolean;
  location: StorageLocation;
  secondaryAction: ReactNode;
  onCancelEdit: () => void;
  onChangeDraft: (draft: { name: string; notes: string }) => void;
  onPrintContents?: () => void;
  onStartEdit: () => void;
  onSubmitEdit: () => void;
  printPending?: boolean;
}) {
  const isUnassigned = location.name === UNASSIGNED_LOCATION_NAME;

  if (isEditing) {
    return (
      <Surface className="storage-location-card storage-location-card--editing">
        <form
          className="storage-location-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitEdit();
          }}
        >
          <label className="field">
            <span>Name</span>
            <input
              disabled={isUnassigned}
              required
              value={editDraft.name}
              onChange={(event) =>
                onChangeDraft({ ...editDraft, name: event.target.value })
              }
            />
          </label>
          <label className="field storage-location-form__notes">
            <span>Notes</span>
            <input
              value={editDraft.notes}
              onChange={(event) =>
                onChangeDraft({ ...editDraft, notes: event.target.value })
              }
            />
          </label>
          <div className="storage-location-card__edit-actions">
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
    <Surface className="storage-location-card">
      <div>
        <h3>{location.name}</h3>
        {location.notes ? <p>{location.notes}</p> : null}
      </div>
      <div className="storage-location-card__actions">
        <ButtonLink
          to={`/inventory?location=${location.id}`}
          variant="secondary"
        >
          View Contents
        </ButtonLink>
        {onPrintContents ? (
          <Button
            disabled={printPending}
            variant="secondary"
            onClick={onPrintContents}
          >
            Print Contents
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onStartEdit}>
          Edit
        </Button>
        {secondaryAction}
      </div>
    </Surface>
  );
}
