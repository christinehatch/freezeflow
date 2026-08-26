import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useParams } from "react-router";

import { feedbackApi, productionApi } from "../api/client";
import { formatApiError } from "../utils/apiErrors";
import { getRecentActions } from "../utils/actionLog";
import {
  Button,
  Field,
  Modal,
  Select,
  Textarea,
  type SelectOption,
} from "./design-system";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Bug", label: "Bug" },
  { value: "Confusing", label: "Confusing" },
  { value: "Improvement", label: "Improvement" },
  { value: "Feature Request", label: "Feature Request" },
  { value: "Question", label: "Question" },
];

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const location = useLocation();
  const { batchId, packageId, trayId } = useParams();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reuses the same query key the Production Batch detail page already
  // populates, so this costs nothing extra in the common case of opening
  // Feedback from that page (Design Decision #6, ADR-0020).
  const batchQuery = useQuery({
    queryKey: ["production-batch", batchId],
    queryFn: () => productionApi.getProductionBatch(batchId ?? ""),
    enabled: Boolean(batchId),
  });

  const submitMutation = useMutation({
    mutationFn: feedbackApi.submit,
  });

  function handleSubmit() {
    if (!category) {
      setValidationError("Please choose a category.");
      return;
    }
    if (!description.trim()) {
      setValidationError("Please describe what happened.");
      return;
    }
    setValidationError(null);

    const context = {
      productionBatchId: batchId ?? null,
      trayId: trayId ?? null,
      packageId: packageId ?? null,
      freezeDryer: batchQuery.data?.freeze_dryer
        ? {
            id: batchQuery.data.freeze_dryer.id,
            name: batchQuery.data.freeze_dryer.name,
          }
        : null,
      userAgent: navigator.userAgent,
      recentActions: getRecentActions(),
    };

    const formData = new FormData();
    formData.set("category", category);
    formData.set("description", description.trim());
    formData.set("page", location.pathname);
    formData.set("context_json", JSON.stringify(context));
    attachments.forEach((file) => formData.append("attachments", file));

    submitMutation.mutate(formData);
  }

  if (submitMutation.isSuccess) {
    return (
      <Modal onClose={onClose} title="Send Feedback">
        <p className="text-sm text-slate-700">
          Thank you! Your feedback has been sent.
        </p>
        <div className="ds-modal__actions">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal>
    );
  }

  const errorMessage =
    validationError ??
    (submitMutation.isError ? formatApiError(submitMutation.error) : null);

  return (
    <Modal onClose={onClose} title="Send Feedback">
      {errorMessage ? (
        <p className="mb-3 text-sm text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="space-y-3">
        <Field htmlFor="feedback-category" label="Category">
          <Select
            id="feedback-category"
            options={CATEGORY_OPTIONS}
            placeholder="What's this about?"
            value={category}
            onChange={setCategory}
          />
        </Field>
        <Field htmlFor="feedback-description" label="Description">
          <Textarea
            id="feedback-description"
            placeholder="Tell me what happened…"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <Field htmlFor="feedback-attachments" label="Attachments" optional>
          <input
            accept="image/*"
            id="feedback-attachments"
            multiple
            type="file"
            onChange={(event) =>
              setAttachments(Array.from(event.target.files ?? []))
            }
          />
        </Field>
      </div>
      <div className="ds-modal__actions">
        <Button
          disabled={submitMutation.isPending}
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          disabled={submitMutation.isPending}
          type="button"
          onClick={handleSubmit}
        >
          {submitMutation.isPending ? "Sending…" : "Submit"}
        </Button>
      </div>
    </Modal>
  );
}
