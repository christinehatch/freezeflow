import type { ReactNode } from "react";
import { Link } from "react-router";

type RecentProductionRowProps = {
  to: string;
  batchNumber: string;
  freezeDryerName: string;
  status: ReactNode;
  started: string;
};

export function RecentProductionRow({
  batchNumber,
  freezeDryerName,
  started,
  status,
  to,
}: RecentProductionRowProps) {
  return (
    <li className="ds-recent-production-row">
      <div className="ds-recent-production-row__identity">
        <Link className="ds-recent-production-row__link" to={to}>
          {batchNumber}
        </Link>
        <span className="ds-recent-production-row__dryer">
          {freezeDryerName}
        </span>
      </div>
      <div className="ds-recent-production-row__status">{status}</div>
      <time className="ds-recent-production-row__date">{started}</time>
    </li>
  );
}
