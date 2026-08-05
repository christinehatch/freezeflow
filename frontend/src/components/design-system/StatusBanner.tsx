import type { ReactNode } from "react";

type StatusBannerProps = {
  title: string;
  body: string;
  tone: "calm" | "attention" | "success" | "danger";
  badge?: ReactNode;
  action?: ReactNode;
};

export function StatusBanner({
  action,
  badge,
  body,
  title,
  tone,
}: StatusBannerProps) {
  return (
    <section
      className={`ds-banner ds-banner--${tone}`}
      role={tone === "danger" ? "alert" : undefined}
    >
      <div className="ds-banner__copy">
        {badge ? <div className="ds-banner__badge">{badge}</div> : null}
        <h3 className="ds-banner__title">{title}</h3>
        <p className="ds-banner__body">{body}</p>
      </div>
      {action ? <div className="ds-banner__action">{action}</div> : null}
    </section>
  );
}
