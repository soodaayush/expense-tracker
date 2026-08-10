import { useEffect, useMemo, useRef, useState } from "react";
import Popover from "./Popover";

interface ComboSelectProps {
  value: string;
  options: string[];
  placeholder?: string;
  id?: string;
  label?: string;
  onCommit: (value: string) => void;
  onAddOption?: (value: string) => void;
  // When true, committing an empty draft clears the value (onCommit("")) instead of being a
  // no-op — for optional fields like payment method, where "unset" is a valid choice. Payee
  // stays required, so it leaves this off.
  allowClear?: boolean;
}

export default function ComboSelect({
  value,
  options,
  placeholder,
  id,
  label,
  onCommit,
  onAddOption,
  allowClear = false,
}: ComboSelectProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Popover needs the anchor as state, not just a ref — see the comment in Popover.tsx.
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    setHighlight(0);
  }, [editing]);

  useEffect(() => {
    if (!editing) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      commit(draft);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft]);

  const filtered = useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => o.toLowerCase().includes(query));
  }, [options, draft]);

  const exactMatch = options.some((o) => o.toLowerCase() === draft.trim().toLowerCase());
  const showAddOption = draft.trim() && !exactMatch;
  const listItems = showAddOption ? [...filtered, "__add__"] : filtered;

  function commit(next: string) {
    setEditing(false);
    const trimmed = next.trim();
    if (!trimmed) {
      if (allowClear && value) onCommit("");
      return;
    }
    if (trimmed !== value) {
      const isNew = !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
      onCommit(trimmed);
      if (isNew) onAddOption?.(trimmed);
    }
  }

  function selectItem(item: string) {
    if (item === "__add__") {
      commit(draft.trim());
    } else {
      commit(item);
    }
  }

  if (!editing) {
    return (
      <div
        id={id}
        className={`cell-display${value ? "" : " cell-empty"}`}
        onClick={() => setEditing(true)}
        tabIndex={0}
        title={label}
        aria-label={label}
        onFocus={() => setEditing(true)}
      >
        {value || placeholder || ""}
      </div>
    );
  }

  return (
    <div
      className="combo-select"
      ref={(el) => {
        containerRef.current = el;
        setAnchorEl(el);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        className="cell-input"
        value={draft}
        placeholder={placeholder}
        title={label}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, listItems.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const chosen = listItems[highlight];
            selectItem(chosen ?? draft);
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
      <Popover anchorEl={anchorEl} popoverRef={popoverRef} open={listItems.length > 0} className="combo-listbox">
        {listItems.map((item, i) => (
          <button
            key={item}
            type="button"
            className={`combo-option${i === highlight ? " combo-option-active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setHighlight(i)}
            onClick={() => selectItem(item)}
          >
            {item === "__add__" ? `+ Add "${draft.trim()}"` : item}
          </button>
        ))}
      </Popover>
    </div>
  );
}
