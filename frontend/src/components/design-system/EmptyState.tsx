import type { ReactNode } from "react";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel">
      <p className="text-slate-600">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
