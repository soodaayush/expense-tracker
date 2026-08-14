import { ReactNode, useEffect, useRef, useState } from "react";
import Popover from "./grid/Popover";

interface NavMenuProps {
  label: ReactNode;
  children: ReactNode;
}

// A collapsed "more actions" menu for the page header — reuses the same Popover the grid's
// ComboSelect/DatePicker use, so it gets the same portal + viewport-clamped positioning for
// free. Any click inside the menu (a Link navigating or a button's own handler) bubbles up to
// the wrapper's onClick, which closes it — no per-item wiring needed.
export default function NavMenu({ label, children }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      className="nav-menu"
      ref={(el) => {
        containerRef.current = el;
        setAnchorEl(el);
      }}
    >
      <button
        type="button"
        className="btn-link"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
      </button>
      <Popover anchorEl={anchorEl} popoverRef={popoverRef} open={open} className="nav-menu-list">
        <div role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      </Popover>
    </div>
  );
}
