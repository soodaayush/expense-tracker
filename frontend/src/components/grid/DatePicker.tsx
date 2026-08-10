import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  formatDisplayDate,
  formatMonthLabel,
  isSameDay,
  monthGrid,
  parseISODate,
  startOfMonth,
  toISODate,
  weekdayLabels,
} from "../../lib/dateUtils";
import Popover from "./Popover";

interface DatePickerProps {
  value: string;
  onCommit: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
}

export default function DatePicker({ value, onCommit, id, label, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseISODate(value);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Popover needs the anchor as state, not just a ref — see the comment in Popover.tsx.
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setViewMonth(startOfMonth(selected ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function pick(date: Date) {
    onCommit(toISODate(date));
    setOpen(false);
  }

  const today = new Date();
  const grid = monthGrid(viewMonth);

  return (
    <div
      className="date-picker"
      ref={(el) => {
        containerRef.current = el;
        setAnchorEl(el);
      }}
    >
      <div
        id={id}
        className={`cell-display${value ? "" : " cell-empty"}`}
        onClick={() => setOpen((o) => !o)}
        tabIndex={0}
        title={label}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        {formatDisplayDate(value) || placeholder || ""}
      </div>

      <Popover anchorEl={anchorEl} popoverRef={popoverRef} open={open} className="date-popover">
        <div role="dialog" aria-label={label ? `${label} calendar` : "Calendar"}>
          <div className="date-popover-header">
            <button
              type="button"
              className="date-nav"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span>{formatMonthLabel(viewMonth)}</span>
            <button
              type="button"
              className="date-nav"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="date-grid date-grid-labels">
            {weekdayLabels.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="date-grid">
            {grid.map((date) => {
              const outside = date.getMonth() !== viewMonth.getMonth();
              const isSelected = Boolean(selected && isSameDay(date, selected));
              const isToday = isSameDay(date, today);
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={[
                    "date-cell",
                    outside ? "date-cell-muted" : "",
                    isSelected ? "date-cell-selected" : "",
                    isToday && !isSelected ? "date-cell-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => pick(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="date-popover-footer">
            <button type="button" className="btn-link" onClick={() => pick(new Date())}>
              Today
            </button>
            {value && (
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  onCommit("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
}
