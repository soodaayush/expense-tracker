// Tracks whether any in-flight API request has been pending longer than SLOW_THRESHOLD_MS —
// the signal a "waking up the database" banner is shown for. A plain module-level store (no
// context/library) since apiFetch itself isn't a React component and needs to report into this
// from anywhere; components read it via useSyncExternalStore (see useSlowRequest.ts).
export const SLOW_THRESHOLD_MS = 3000;

type Listener = () => void;

let pendingSlowCount = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function beginSlowRequest() {
  pendingSlowCount++;
  notify();
}

export function endSlowRequest() {
  pendingSlowCount = Math.max(0, pendingSlowCount - 1);
  notify();
}

export function isSlowRequestPending() {
  return pendingSlowCount > 0;
}

export function subscribeSlowRequest(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
