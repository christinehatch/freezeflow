import type { ReactNode } from "react";

import { Surface } from "./Surface";

type FreezeDryerCardProps = {
  name: string;
  status: ReactNode;
  summary: string;
  detail?: string;
  action: ReactNode;
};

export function FreezeDryerCard({
  action,
  detail,
  name,
  status,
  summary,
}: FreezeDryerCardProps) {
  return (
    <Surface className="ds-freeze-dryer-card">
      <div className="ds-freeze-dryer-card__header">
        <h4 className="ds-freeze-dryer-card__title">{name}</h4>
        {status}
      </div>
      <div className="ds-freeze-dryer-card__copy">
        <p className="ds-freeze-dryer-card__summary">{summary}</p>
        {detail ? (
          <p className="ds-freeze-dryer-card__detail">{detail}</p>
        ) : null}
      </div>
      <div className="ds-freeze-dryer-card__action">{action}</div>
    </Surface>
  );
}
