import DeviceInfo from "react-native-device-info";
import { api } from "../api/client";
import { PendingCrashReport } from "../state/useCrashReportStore";
import { getSessionLog } from "./sessionLog";

export interface CrashReportResult {
  issueUrl: string;
}

// Only the error trail, not the full session log - `logEvent` entries are
// gated behind the (opt-in, off-by-default) usageLoggingEnabled setting, and
// silently attaching them here regardless of that setting would defeat the
// point of it being opt-in. Errors are always recorded (see sessionLog.ts's
// logFailure) since they're the whole point of this report existing.
const MAX_LOG_ENTRIES = 20;

/** Posts to the backend, which files the actual GitHub issue - the app never
 * holds a GitHub credential itself (see backend/app/services/github_service.py).
 * X-App-Secret only stops opportunistic abuse of the endpoint (anyone
 * decompiling the APK can read this same constant) - see the backend's
 * app_shared_secret setting in config.py for the other half of the check. */
export async function sendCrashReport(report: PendingCrashReport): Promise<CrashReportResult> {
  const [totalMemoryBytes, sessionLog] = await Promise.all([DeviceInfo.getTotalMemory(), getSessionLog()]);
  const recentErrors = sessionLog
    .filter((e) => e.kind === "error")
    .slice(0, MAX_LOG_ENTRIES)
    .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.context}: ${e.message}`)
    .join("\n");

  const { issue_url } = await api.post<{ issue_url: string }>(
    "/api/support/report",
    {
      context: report.context,
      message: report.message,
      device: {
        model: DeviceInfo.getModel(),
        os_version: `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`,
        total_memory_mb: Math.round(totalMemoryBytes / (1024 * 1024)),
      },
      app_version: DeviceInfo.getVersion(),
      recent_errors: recentErrors || null,
    },
    process.env.EXPO_PUBLIC_APP_SHARED_SECRET ? { "X-App-Secret": process.env.EXPO_PUBLIC_APP_SHARED_SECRET } : undefined
  );
  return { issueUrl: issue_url };
}
