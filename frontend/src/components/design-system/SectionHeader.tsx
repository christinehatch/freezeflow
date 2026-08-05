import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  id?: string;
};

export function SectionHeader({ action, id, title }: SectionHeaderProps) {
  return (
    <header className="ds-section-header">
      <h3 className="ds-section-header__title" id={id}>
        {title}
      </h3>
      {action ? (
        <div className="ds-section-header__action">{action}</div>
      ) : null}
    </header>
  );
}
