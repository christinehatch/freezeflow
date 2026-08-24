import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Field } from "./FormControls";

type TagAutocompleteFieldProps = {
  hint?: string;
  id?: string;
  label: string;
  onChange: (values: string[]) => void;
  optional?: boolean;
  placeholder?: string;
  suggestions?: string[];
  values: string[];
};

export function TagAutocompleteField({
  hint,
  id,
  label,
  onChange,
  optional,
  placeholder,
  suggestions = [],
  values,
}: TagAutocompleteFieldProps) {
  const generatedId = useId();
  const controlId = id ?? `tag-field-${generatedId}`;
  const listboxId = `${controlId}-listbox`;
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    const selected = new Set(values.map((value) => value.toLowerCase()));
    return suggestions
      .filter((suggestion) => !selected.has(suggestion.toLowerCase()))
      .filter((suggestion) =>
        query ? suggestion.toLowerCase().includes(query) : true,
      )
      .slice(0, 8);
  }, [draft, suggestions, values]);

  function addValue(rawValue: string) {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const alreadyAdded = values.some(
      (value) => value.toLowerCase() === trimmed.toLowerCase(),
    );
    if (!alreadyAdded) {
      onChange([...values, trimmed]);
    }
    setDraft("");
    setOpen(false);
    setActiveIndex(0);
  }

  function removeValue(valueToRemove: string) {
    onChange(values.filter((value) => value !== valueToRemove));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (filteredSuggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((current) => (current + 1) % filteredSuggestions.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      if (filteredSuggestions.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(
          (current) =>
            (current - 1 + filteredSuggestions.length) %
            filteredSuggestions.length,
        );
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && filteredSuggestions[activeIndex]) {
        addValue(filteredSuggestions[activeIndex]);
      } else {
        addValue(draft);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === "Backspace" && draft === "" && values.length > 0) {
      removeValue(values[values.length - 1]);
    }
  }

  return (
    <Field hint={hint} htmlFor={controlId} label={label} optional={optional}>
      <div className="ds-tag-field">
        {values.length > 0 ? (
          <ul className="ds-tag-field__chips">
            {values.map((value) => (
              <li className="ds-tag-field__chip" key={value}>
                <span>{value}</span>
                <button
                  aria-label={`Remove ${value}`}
                  className="ds-tag-field__chip-remove"
                  type="button"
                  onClick={() => removeValue(value)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open && filteredSuggestions.length > 0}
          aria-haspopup="listbox"
          className="ds-input ds-tag-field__input"
          id={controlId}
          placeholder={placeholder}
          ref={inputRef}
          role="combobox"
          type="text"
          value={draft}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && filteredSuggestions.length > 0 ? (
          <ul className="ds-tag-field__menu" id={listboxId} role="listbox">
            {filteredSuggestions.map((suggestion, index) => (
              <li key={suggestion}>
                <button
                  aria-selected={index === activeIndex}
                  className={`ds-tag-field__option ${
                    index === activeIndex ? "ds-tag-field__option--active" : ""
                  }`.trim()}
                  role="option"
                  tabIndex={-1}
                  type="button"
                  onMouseDown={(event) => {
                    // Prevent the input from blurring (and the menu closing)
                    // before the click is registered.
                    event.preventDefault();
                    addValue(suggestion);
                  }}
                  onPointerMove={() => setActiveIndex(index)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
