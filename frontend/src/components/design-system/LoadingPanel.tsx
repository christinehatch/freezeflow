export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="panel" role="status">
      {label}
    </div>
  );
}
