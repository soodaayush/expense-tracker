import { CSSProperties, ReactNode, RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  anchorRef: RefObject<HTMLElement>;
  popoverRef: RefObject<HTMLDivElement>;
  open: boolean;
  className?: string;
  children: ReactNode;
}

// Renders into document.body via a portal so the popover can float above scroll/clip
// boundaries (e.g. the table's overflow-x:auto container, which — per the CSS overflow
// spec — implicitly clips the Y axis too, not just X) instead of being trapped inside them.
export default function Popover({ anchorRef, popoverRef, open, className, children }: PopoverProps) {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    function updatePosition() {
      const rect = anchorRef.current!.getBoundingClientRect();
      const viewportGutter = 8;
      const top = Math.min(rect.bottom + 4, window.innerHeight - viewportGutter);
      const left = Math.min(rect.left, window.innerWidth - viewportGutter);
      setStyle({ position: "fixed", top, left, minWidth: rect.width });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div ref={popoverRef} className={className} style={style}>
      {children}
    </div>,
    document.body
  );
}
