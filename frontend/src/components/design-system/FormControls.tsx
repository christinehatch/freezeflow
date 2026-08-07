import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  children: ReactNode;
  className?: string;
  error?: string;
  errorId?: string;
  hint?: string;
  htmlFor: string;
  label: string;
  optional?: boolean;
};

export function Field({
  children,
  className = "",
  error,
  errorId,
  hint,
  htmlFor,
  label,
  optional = false,
}: FieldProps) {
  return (
    <div className={`ds-field ${className}`.trim()}>
      <label className="ds-field__label" htmlFor={htmlFor}>
        {label}
        {optional ? <span className="ds-field__optional">Optional</span> : null}
      </label>
      {hint ? <p className="ds-field__hint">{hint}</p> : null}
      {children}
      {error ? (
        <p className="ds-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextField({ className = "", type = "text", ...props }, ref) {
  return (
    <input
      className={`ds-input ${className}`.trim()}
      ref={ref}
      type={type}
      {...props}
    />
  );
});

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  suffix?: ReactNode;
};

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField({ className = "", suffix, ...props }, ref) {
    return (
      <div className="ds-number-field">
        <input
          className={`ds-input ds-number-field__input ${className}`.trim()}
          ref={ref}
          type="number"
          {...props}
        />
        {suffix ? (
          <span aria-hidden="true" className="ds-number-field__suffix">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      className={`ds-input ds-textarea ${className}`.trim()}
      ref={ref}
      {...props}
    />
  );
});

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type SelectProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  value: string;
};

export function Select({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  className = "",
  disabled = false,
  id,
  name,
  onChange,
  options,
  placeholder = "Select an option",
  value,
}: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? `select-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : 0,
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(options));
  }, [open, options, selectedIndex]);

  function moveActive(direction: 1 | -1) {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let count = 0; count < options.length; count += 1) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) {
        setActiveIndex(next);
        return;
      }
    }
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(firstEnabled(options));
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(lastEnabled(options));
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={`ds-select ${className}`.trim()} ref={rootRef}>
      {name ? <input name={name} type="hidden" value={value} /> : null}
      <button
        aria-activedescendant={
          open && options[activeIndex]
            ? `${controlId}-option-${activeIndex}`
            : undefined
        }
        aria-controls={listboxId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        className="ds-select__trigger"
        disabled={disabled}
        id={controlId}
        ref={triggerRef}
        role="combobox"
        type="button"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="ds-select__value">
          <span
            className={`ds-select__primary ${selectedOption ? "" : "ds-select__placeholder"}`.trim()}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="ds-select__secondary">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <div className="ds-select__menu" id={listboxId} role="listbox">
          {options.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={`ds-select__option ${index === activeIndex ? "ds-select__option--active" : ""}`.trim()}
              disabled={option.disabled}
              id={`${controlId}-option-${index}`}
              key={option.value}
              role="option"
              tabIndex={-1}
              type="button"
              onClick={() => choose(option)}
              onPointerMove={() => setActiveIndex(index)}
            >
              <span className="ds-select__check" aria-hidden="true">
                {option.value === value ? "✓" : ""}
              </span>
              <span className="ds-select__option-copy">
                <span className="ds-select__primary">{option.label}</span>
                {option.description ? (
                  <span className="ds-select__secondary">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function firstEnabled(options: SelectOption[]) {
  const index = options.findIndex((option) => !option.disabled);
  return index >= 0 ? index : 0;
}

function lastEnabled(options: SelectOption[]) {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index].disabled) return index;
  }
  return 0;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`ds-select__chevron ${open ? "ds-select__chevron--open" : ""}`.trim()}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
