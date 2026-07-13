import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsStore } from "../state/useSettingsStore";

export type BackendHealthStatus = "checking" | "online" | "offline";

/** Render's free tier spins the backend down after idle, so the first
 * request after a lull can take 30-50s to come back up. Screens that call
 * the backend (Hugging Face search/files) use this to show a "connecting"
 * state instead of just hanging, and a retry button if it genuinely fails. */
export function useBackendHealth() {
  const [status, setStatus] = useState<BackendHealthStatus>("checking");
  // Double-tapping Retry while the first (slow, cold-start) request is still
  // in flight used to let whichever response landed last win, even if it was
  // the older/slower one — so a fresh "online" could flip back to a stale
  // "offline". This ignores any response that isn't from the most recent call.
  const requestIdRef = useRef(0);

  const check = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setStatus("checking");
    fetch(`${useSettingsStore.getState().backendUrl}/api/health`)
      .then((res) => {
        if (requestIdRef.current !== requestId) return;
        setStatus(res.ok ? "online" : "offline");
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setStatus("offline");
      });
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, retry: check };
}
