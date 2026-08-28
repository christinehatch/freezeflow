import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
}

export function Modal({ children, onClose, title }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // A ref, not a dependency: onClose is typically a fresh inline closure on
  // every parent render (e.g. `onClose={() => setOpen(false)}`), and typing
  // into a field inside the modal re-renders the parent on every keystroke.
  // Depending on `onClose` directly would tear down and rebuild focus
  // management — including the initial-focus jump — on every keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const initialFocusTarget = dialog
      ? (getFocusableElements(dialog)[0] ?? dialog)
      : null;
    initialFocusTarget?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
    // Runs once per mount/unmount (open/close) by design; onClose is read
    // via a ref above so this never needs to be a dependency.
  }, []);

  return (
    <div className="ds-modal-overlay" onClick={onClose}>
      <div
        aria-labelledby="ds-modal-title"
        aria-modal="true"
        className="ds-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="ds-modal__title" id="ds-modal-title">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
