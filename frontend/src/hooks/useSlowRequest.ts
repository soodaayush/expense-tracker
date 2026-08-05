import { useSyncExternalStore } from "react";
import { isSlowRequestPending, subscribeSlowRequest } from "../lib/slowRequest";

export function useSlowRequest(): boolean {
  return useSyncExternalStore(subscribeSlowRequest, isSlowRequestPending, () => false);
}
