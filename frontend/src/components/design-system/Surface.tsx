import { forwardRef, type HTMLAttributes } from "react";

export const Surface = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function Surface({ className = "", ...props }, ref) {
  return (
    <div className={`ds-surface ${className}`.trim()} ref={ref} {...props} />
  );
});
