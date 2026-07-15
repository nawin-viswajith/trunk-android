import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import DeviceInfo from "react-native-device-info";
import appJson from "../../app.json";
import { api } from "../api/client";
import { getSessionLog } from "./sessionLog";

export type QueuedReportStatus =
  /** Written the moment a failure happens, before the toast even shows -
   * covers a fatal crash killing the process before the user could act. */
  | "pending"
  /** The 5s auto-send toast ran to completion and the request succeeded. */
  | "sent"
  /** The user tapped Cancel on the toast before the 5s elapsed. */
  | "cancelled"
  /** Send was attempted (toast completed, or a retry ran) but failed -
   * e.g. no network, backend unreachable. Retried on next launch/network. */
  | "failed";

export interface QueuedReport {
  id: string;
  context: string;
  message: string;
  /** ISO 8601 - when the failure actually happened, not when it was sent. */
  timestamp: string;
  appVersion: string;
  status: QueuedReportStatus;
}

const STORAGE_KEY = "trunk-crash-report-queue";
const MAX_LOG_ENTRIES = 20;

let cache: QueuedReport[] | null = null;

async function load(): Promise<QueuedReport[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? JSON.parse(raw) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

async function persist(): Promise<void> {
  if (!cache) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Called the instant a failure happens - before the toast, before any
 * network attempt - so a fatal crash that kills the process a moment later
 * still leaves a durable "this happened, still needs sending" record with
 * exactly when it occurred and which build it happened on. */
export async function enqueueReport(context: string, error: unknown): Promise<QueuedReport> {
  const entries = await load();
  const report: QueuedReport = {
    id: randomId(),
    context,
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
    appVersion: appJson.expo.version,
    status: "pending",
  };
  entries.unshift(report);
  cache = entries;
  await persist();
  return report;
}

export async function markReportStatus(id: string, status: QueuedReportStatus): Promise<void> {
  const entries = await load();
  const entry = entries.find((e) => e.id === id);
  if (entry) entry.status = status;
  cache = entries;
  await persist();
}

export async function getReportQueue(): Promise<QueuedReport[]> {
  return load();
}

/** Actually posts one report to the backend - shared by the toast's own
 * send button and the retry sweep below, so both go through the exact same
 * request shape (including the same recent-error-log attachment). */
export async function sendQueuedReport(report: QueuedReport): Promise<void> {
  const [totalMemoryBytes, sessionLog] = await Promise.all([DeviceInfo.getTotalMemory(), getSessionLog()]);
  const recentErrors = sessionLog
    .filter((e) => e.kind === "error")
    .slice(0, MAX_LOG_ENTRIES)
    .map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.context}: ${e.message}`)
    .join("\n");

  await api.post(
    "/api/support/report",
    {
      context: report.context,
      message: report.message,
      device: {
        model: DeviceInfo.getModel(),
        os_version: `${DeviceInfo.getSystemName()} ${DeviceInfo.getSystemVersion()}`,
        total_memory_mb: Math.round(totalMemoryBytes / (1024 * 1024)),
      },
      app_version: report.appVersion,
      recent_errors: recentErrors || null,
      // Lets the filed issue show exactly when the failure happened, not
      // just when the (possibly much later, post-reconnect) send succeeded.
      occurred_at: report.timestamp,
    },
    process.env.EXPO_PUBLIC_APP_SHARED_SECRET ? { "X-App-Secret": process.env.EXPO_PUBLIC_APP_SHARED_SECRET } : undefined
  );
}

/** Sweeps every "pending"/"failed" report and retries them - call once at
 * boot (covers "crashed last launch, never got to send") and whenever the
 * network transitions from offline to online (covers "failed mid-session
 * because the connection was down"). Each report is attempted independently
 * so one bad report can't block the rest of the queue. */
export async function retryQueuedReports(): Promise<void> {
  let state: Network.NetworkState;
  try {
    state = await Network.getNetworkStateAsync();
  } catch {
    return;
  }
  if (!state.isConnected) return;

  const entries = await load();
  const outstanding = entries.filter((e) => e.status === "pending" || e.status === "failed");
  for (const report of outstanding) {
    try {
      await sendQueuedReport(report);
      await markReportStatus(report.id, "sent");
    } catch {
      await markReportStatus(report.id, "failed");
    }
  }
}
