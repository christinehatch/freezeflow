import { Button } from "./Button";

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel" role="alert">
      <p className="text-red-700">{message}</p>
      {onRetry ? (
        <Button
          className="mt-3"
          type="button"
          variant="secondary"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
