import { create } from "zustand";
import { enqueueReport, QueuedReport } from "../services/crashReportQueue";
import { useSettingsStore } from "./useSettingsStore";

export type PendingCrashReport = QueuedReport;

interface CrashReportState {
  pending: PendingCrashReport | null;
  offer: (report: PendingCrashReport) => void;
  dismiss: () => void;
}

export const useCrashReportStore = create<CrashReportState>((set) => ({
  pending: null,
  offer: (report) => set({ pending: report }),
  dismiss: () => set({ pending: null }),
}));

/** Call alongside logFailure() at any failure site to durably record the
 * report (survives a crash or being offline - see crashReportQueue.ts) and,
 * if crash reporting is enabled, surface the bottom "sending this crash
 * report..." toast. Reporting off just leaves the record queued/pending
 * without ever prompting - CrashReportPrompt.tsx only shows for `pending`. */
export async function offerCrashReport(context: string, error: unknown): Promise<void> {
  const report = await enqueueReport(context, error);
  if (useSettingsStore.getState().crashReportingEnabled) {
    useCrashReportStore.getState().offer(report);
  }
}
