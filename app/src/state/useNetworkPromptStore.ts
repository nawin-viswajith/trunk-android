import { create } from "zustand";

export interface NetworkPromptResult {
  allow: boolean;
  /** Whether "Remember my choice" was checked - downloadPolicy.ts persists
   * this into useSettingsStore so the prompt is skipped from then on. */
  remember: boolean;
}

interface PendingPrompt {
  filename: string;
  resolve: (result: NetworkPromptResult) => void;
}

interface NetworkPromptState {
  pending: PendingPrompt | null;
  /** Shows the prompt and resolves once the user picks Wi-Fi-only or Continue. */
  request: (filename: string) => Promise<NetworkPromptResult>;
  respond: (allow: boolean, remember: boolean) => void;
}

export const useNetworkPromptStore = create<NetworkPromptState>((set, get) => ({
  pending: null,
  request: (filename) =>
    new Promise<NetworkPromptResult>((resolve) => {
      set({ pending: { filename, resolve } });
    }),
  respond: (allow, remember) => {
    const pending = get().pending;
    if (!pending) return;
    set({ pending: null });
    pending.resolve({ allow, remember });
  },
}));
