import type { ReactNode } from "react";

export type WorkflowStepStatus =
  | "complete"
  | "current"
  | "available"
  | "upcoming";

export type WorkflowStep = {
  id: string;
  label: string;
  status: WorkflowStepStatus;
  summary?: string;
};

export function WorkflowStepper({
  label,
  onStepSelect,
  steps,
}: {
  label: string;
  onStepSelect?: (step: WorkflowStep) => void;
  steps: WorkflowStep[];
}) {
  return (
    <nav aria-label={label} className="ds-workflow-stepper">
      <ol className="ds-workflow-stepper__list">
        {steps.map((step, index) => (
          <li
            aria-current={step.status === "current" ? "step" : undefined}
            className={`ds-workflow-stepper__step ds-workflow-stepper__step--${step.status}`}
            key={step.id}
          >
            <span aria-hidden="true" className="ds-workflow-stepper__number">
              {step.status === "complete" ? "✓" : index + 1}
            </span>
            <span className="ds-workflow-stepper__copy">
              {onStepSelect &&
              (step.status === "complete" || step.status === "available") ? (
                <button
                  className="ds-workflow-stepper__button"
                  type="button"
                  onClick={() => onStepSelect(step)}
                >
                  <span className="ds-workflow-stepper__label">
                    {step.label}
                  </span>
                  {step.summary ? (
                    <span className="ds-workflow-stepper__summary">
                      {step.summary}
                    </span>
                  ) : null}
                </button>
              ) : (
                <>
                  <span className="ds-workflow-stepper__label">
                    {step.label}
                  </span>
                  {step.summary ? (
                    <span className="ds-workflow-stepper__summary">
                      {step.summary}
                    </span>
                  ) : null}
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function WorkflowStage({
  action,
  children,
  className = "",
  collapsible = false,
  collapsedLabel,
  description,
  id,
  stage,
  status,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  collapsedLabel?: string;
  description: string;
  id?: string;
  stage: number;
  status: WorkflowStepStatus;
  title: string;
}) {
  const headingId = `workflow-stage-${id ?? stage}`;
  const content = <div className="ds-workflow-stage__content">{children}</div>;
  return (
    <section
      aria-labelledby={headingId}
      className={`ds-workflow-stage ds-workflow-stage--${status} ${className}`.trim()}
    >
      <header className="ds-workflow-stage__header">
        <div className="ds-workflow-stage__heading">
          <span className="ds-workflow-stage__eyebrow">Stage {stage}</span>
          <h2 className="ds-workflow-stage__title" id={headingId} tabIndex={-1}>
            {title}
          </h2>
          <p className="ds-workflow-stage__description">{description}</p>
        </div>
        {action ? (
          <div className="ds-workflow-stage__action">{action}</div>
        ) : null}
      </header>
      {collapsible && status !== "current" && status !== "available" ? (
        <details className="ds-workflow-stage__review">
          <summary>
            {collapsedLabel ??
              (status === "complete"
                ? "Review completed stage"
                : "Preview upcoming stage")}
          </summary>
          {content}
        </details>
      ) : (
        content
      )}
    </section>
  );
}
