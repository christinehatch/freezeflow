import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "active" | "success" | "attention" | "danger";
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`ds-badge ds-badge--${tone}`}>{children}</span>;
}
