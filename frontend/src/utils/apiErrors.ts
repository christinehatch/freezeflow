import { ApiError } from "../api/client";

export function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    const detail = formatApiErrorDetail(error.detail) || error.message;
    return error.code ? `${error.code}: ${detail}` : detail;
  }
  return error instanceof Error
    ? error.message || "Unable to complete the action."
    : "Unable to complete the request.";
}

function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail.map(formatApiErrorDetail).filter(Boolean).join("; ");
  }
  if (!detail || typeof detail !== "object") return "";

  const value = detail as Record<string, unknown>;
  const directMessage = value.message ?? value.msg ?? value.reason;
  if (typeof directMessage === "string" && directMessage.trim() !== "") {
    const location =
      formatApiErrorLocation(value.loc) ||
      (typeof value.field === "string"
        ? value.field.trim().replace(/_/g, " ")
        : "");
    const formattedMessage = location
      ? `${location}: ${directMessage.trim()}`
      : directMessage.trim();
    const nestedErrors = formatApiErrorDetail(value.errors);
    return nestedErrors
      ? `${formattedMessage}; ${nestedErrors}`
      : formattedMessage;
  }

  for (const key of ["detail", "errors", "error"]) {
    const nestedMessage = formatApiErrorDetail(value[key]);
    if (nestedMessage) return nestedMessage;
  }

  return Object.entries(value)
    .filter(([key]) => !["code", "status", "type", "loc"].includes(key))
    .map(([, nestedValue]) => formatApiErrorDetail(nestedValue))
    .filter(Boolean)
    .join("; ");
}

function formatApiErrorLocation(location: unknown) {
  if (!Array.isArray(location)) return "";
  return location
    .filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number",
    )
    .filter((part) => part !== "body")
    .map((part) => String(part).replace(/_/g, " "))
    .join(" ");
}
