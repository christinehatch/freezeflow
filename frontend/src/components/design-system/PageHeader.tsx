import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function PageHeader({
  action,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header__copy">
        {eyebrow ? <p className="ds-page-header__eyebrow">{eyebrow}</p> : null}
        <h2 className="ds-page-header__title">{title}</h2>
        <p className="ds-page-header__description">{description}</p>
      </div>
      {action ? <div className="ds-page-header__action">{action}</div> : null}
    </header>
  );
}
