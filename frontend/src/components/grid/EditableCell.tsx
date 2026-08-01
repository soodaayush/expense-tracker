import { useEffect, useRef, useState } from "react";
import { sanitizeAmountInput } from "../../lib/numberInput";

interface EditableCellProps {
  value: string;
  displayValue?: string;
  type?: "text" | "number";
  placeholder?: string;
  align?: "left" | "right";
  label?: string;
  onCommit: (value: string) => void;
}

export default function EditableCell({
  value,
  displayValue,
  type = "text",
  placeholder,
  align = "left",
  label,
  onCommit,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        style={{ textAlign: align }}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={draft}
        placeholder={placeholder}
        title={label}
        aria-label={label}
        onChange={(e) => setDraft(type === "number" ? sanitizeAmountInput(e.target.value) : e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
    );
  }

  return (
    <div
      className={`cell-display${value ? "" : " cell-empty"}`}
      style={{ textAlign: align }}
      onClick={() => setEditing(true)}
      tabIndex={0}
      onFocus={() => setEditing(true)}
    >
      {displayValue || value || placeholder || ""}
    </div>
  );
}
