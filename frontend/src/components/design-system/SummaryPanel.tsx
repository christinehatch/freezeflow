import type { ReactNode } from "react";

import { Surface } from "./Surface";

export type SummaryPanelItem = {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
};

export function SummaryPanel({
  children,
  className = "",
  items,
  title,
}: {
  children?: ReactNode;
  className?: string;
  items: SummaryPanelItem[];
  title: string;
}) {
  return (
    <aside
      aria-label={title}
      className={`ds-summary-panel ${className}`.trim()}
    >
      <Surface>
        <h3 className="ds-summary-panel__title">{title}</h3>
        <dl className="ds-summary-panel__metrics">
          {items.map((item) => (
            <div
              className={`ds-summary-panel__metric ${item.emphasis ? "ds-summary-panel__metric--emphasis" : ""}`.trim()}
              key={item.label}
            >
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        {children ? (
          <div className="ds-summary-panel__supporting">{children}</div>
        ) : null}
      </Surface>
    </aside>
  );
}
