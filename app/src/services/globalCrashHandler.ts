import { logFailure } from "./sessionLog";
import { enqueueReport } from "./crashReportQueue";
import { offerCrashReport } from "../state/useCrashReportStore";

/** Catches whatever the Inference/Benchmark/Flow-run try-catches don't: an
 * uncaught JS exception anywhere else in the tree, or a promise rejection
 * nobody awaited/caught. Both would otherwise either crash the app silently
 * (isFatal) or vanish into the console with no record and no chance to
 * report - installed once at boot (see App.tsx), before anything else runs. */
export function installGlobalCrashHandler(): void {
  const g = globalThis as any;

  const previousErrorHandler = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
    if (isFatal) {
      // The process is about to die - no time for the 5s toast (it can't
      // finish an HTTP request either way). Just leave a durable "pending"
      // record; retryQueuedReports() picks it up silently at the start of
      // the NEXT launch (see App.tsx) instead.
      logFailure("App crash", error);
      enqueueReport("App crash", error).catch(() => {});
    } else {
      logFailure("Unhandled error", error);
      offerCrashReport("Unhandled error", error);
    }
    // Still lets the engine's own fatal-error handling (red box in dev,
    // process teardown in a release build) run afterward - this only adds
    // a report, it doesn't swallow the crash.
    previousErrorHandler?.(error, isFatal);
  });

  // React Native's JS engines (Hermes included) support the same
  // addEventListener("unhandledrejection", ...) surface web does - a
  // rejected promise with no .catch reaches here instead of vanishing.
  // Never fatal by definition (the process is still running to report it),
  // so this always goes through the normal toast flow.
  g.addEventListener?.("unhandledrejection", (event: { reason?: unknown }) => {
    const reason = event?.reason;
    logFailure("Unhandled promise rejection", reason);
    offerCrashReport("Unhandled promise rejection", reason);
  });
}
