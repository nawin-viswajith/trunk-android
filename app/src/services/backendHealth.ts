import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "../state/useSettingsStore";

export type BackendHealthStatus = "checking" | "online" | "offline";

/** Render's free tier spins the backend down after idle, so the first
 * request after a lull can take 30-50s to come back up. Screens that call
 * the backend (Hugging Face search/files) use this to show a "connecting"
 * state instead of just hanging, and a retry button if it genuinely fails. */
export function useBackendHealth() {
  const [status, setStatus] = useState<BackendHealthStatus>("checking");

  const check = useCallback(() => {
    setStatus("checking");
    fetch(`${useSettingsStore.getState().backendUrl}/api/health`)
      .then((res) => setStatus(res.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"));
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, retry: check };
}
