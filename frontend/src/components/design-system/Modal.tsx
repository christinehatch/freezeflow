import { useEffect, type ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: string;
};

export function Modal({ children, onClose, title }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="ds-modal-overlay" onClick={onClose}>
      <div
        aria-labelledby="ds-modal-title"
        aria-modal="true"
        className="ds-modal"
        role="dialog"
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
