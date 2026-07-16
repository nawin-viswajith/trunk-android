import { create } from "zustand";

export interface AlertButtonConfig {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger" | "neutral";
}

interface AlertContent {
  title: string;
  message: string;
  buttons: AlertButtonConfig[];
}

interface AlertState {
  current: AlertContent | null;
  show: (title: string, message: string, buttons?: AlertButtonConfig[]) => void;
  dismiss: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  current: null,
  show: (title, message, buttons) => set({ current: { title, message, buttons: buttons ?? [{ label: "OK" }] } }),
  dismiss: () => set({ current: null }),
}));

/** App-styled drop-in replacement for Alert.alert() - the native dialog looks
 * out of place against the rest of the flat, sharp-edged design. Rendered by
 * the single <AlertModalHost/> mounted at the app root. */
export function showAlert(title: string, message: string, buttons?: AlertButtonConfig[]): void {
  useAlertStore.getState().show(title, message, buttons);
}
