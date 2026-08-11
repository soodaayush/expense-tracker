import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";

// How long the app waits with zero user activity before forcing a logout.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"] as const;

// Logs the user out after IDLE_TIMEOUT_MS of no mouse/keyboard/touch activity — a session left
// open on a shared or unattended device shouldn't stay signed in indefinitely just because the
// 30-day session cookie is still valid.
export function useIdleLogout(enabled: boolean, timeoutMs: number = IDLE_TIMEOUT_MS) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled) return;

    async function handleIdle() {
      await logout().catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/login", { replace: true });
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(handleIdle, timeoutMs);
    }

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [enabled, timeoutMs, navigate, queryClient]);
}
