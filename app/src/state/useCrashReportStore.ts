import { create } from "zustand";

export interface PendingCrashReport {
  context: string;
  message: string;
}

interface CrashReportState {
  pending: PendingCrashReport | null;
  offer: (context: string, error: unknown) => void;
  dismiss: () => void;
}

export const useCrashReportStore = create<CrashReportState>((set) => ({
  pending: null,
  offer: (context, error) =>
    set({ pending: { context, message: error instanceof Error ? error.message : String(error) } }),
  dismiss: () => set({ pending: null }),
}));

/** Call alongside logFailure() at a model load/generate failure site to
 * surface the bottom "share this crash?" prompt - see CrashReportPrompt.tsx.
 * Kept as a plain function (mirrors showAlert in useAlertStore.ts) so call
 * sites don't need to touch the store/hook directly. */
export function offerCrashReport(context: string, error: unknown): void {
  useCrashReportStore.getState().offer(context, error);
}
