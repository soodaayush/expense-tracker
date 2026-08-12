import { useState } from "react";

const STORAGE_KEY = "privacyMode";

// Shared across every page that can show sensitive amounts (bills grid, reports) so toggling
// it on one page keeps the rest of the app censored too, and it survives a reload.
export function usePrivacyMode() {
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  function toggle() {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return { privacyMode, toggle };
}
