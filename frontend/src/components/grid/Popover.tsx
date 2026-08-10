import { CSSProperties, ReactNode, RefObject, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  anchorEl: HTMLElement | null;
  popoverRef: RefObject<HTMLDivElement>;
  open: boolean;
  className?: string;
  children: ReactNode;
}

// Renders into document.body via a portal so the popover can float above scroll/clip
// boundaries (e.g. the table's overflow-x:auto container, which — per the CSS overflow
// spec — implicitly clips the Y axis too, not just X) instead of being trapped inside them.
//
// anchorEl must be React state (set from a ref callback), not a plain ref object read via
// `.current`. React commits refs and layout effects bottom-up (children before parents), so
// on the commit where this popover first opens, the anchor is typically an ANCESTOR of this
// component whose own ref hasn't attached yet by the time this effect runs — reading a plain
// ref's `.current` here would see `null` and silently no-op forever, since mutating `.current`
// doesn't change the effect's dependencies to ever re-run it. Tracking the anchor as state
// means the parent's ref callback firing triggers a re-render with a real dependency change,
// so this effect correctly gets a second chance to run once the anchor actually exists.
export default function Popover({ anchorEl, popoverRef, open, className, children }: PopoverProps) {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;

    function updatePosition() {
      const rect = anchorEl!.getBoundingClientRect();
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
  }, [open, anchorEl]);

  if (!open) return null;

  return createPortal(
    <div ref={popoverRef} className={className} style={style}>
      {children}
    </div>,
    document.body
  );
}
