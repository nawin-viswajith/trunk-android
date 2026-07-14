import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSettingsStore } from "../state/useSettingsStore";

export type LogKind = "error" | "event";

export interface LogEntry {
  timestamp: number;
  kind: LogKind;
  context: string;
  message: string;
}

const STORAGE_KEY = "pocketcoder-session-log";
const MAX_BYTES = 150 * 1024 * 1024;
const MAX_SESSIONS = 5;
const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

let cache: LogEntry[] | null = null;
let sessionBoundaries: number[] = [];

async function load(): Promise<LogEntry[]> {
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

/** Rolling retention: error entries survive 30 days regardless of session
 * count, everything else is dropped once more than MAX_SESSIONS boot marks
 * have accumulated, and the whole log is hard-capped at MAX_BYTES so a
 * runaway session can't fill the device's storage. */
function prune(entries: LogEntry[]): LogEntry[] {
  const now = Date.now();
  let kept = entries.filter((e) => e.kind === "error" && now - e.timestamp <= ERROR_RETENTION_MS);
  const bootMarks = entries.filter((e) => e.context === "Session boot").map((e) => e.timestamp);
  const cutoff = bootMarks.length > MAX_SESSIONS ? bootMarks.sort((a, b) => b - a)[MAX_SESSIONS - 1] : 0;
  const recent = entries.filter((e) => e.timestamp >= cutoff);
  kept = [...kept, ...recent].filter((e, i, arr) => arr.findIndex((o) => o.timestamp === e.timestamp && o.message === e.message) === i);
  kept.sort((a, b) => b.timestamp - a.timestamp);

  let size = 0;
  const capped: LogEntry[] = [];
  for (const entry of kept) {
    size += entry.message.length + entry.context.length + 32;
    if (size > MAX_BYTES) break;
    capped.push(entry);
  }
  return capped;
}

/** Called once per app process at boot, marking where "last session" ends
 * and the new one begins for the MAX_SESSIONS rolling window. */
export async function markSessionBoot(): Promise<void> {
  const entries = await load();
  entries.unshift({ timestamp: Date.now(), kind: "event", context: "Session boot", message: "App launched" });
  cache = prune(entries);
  sessionBoundaries = cache.filter((e) => e.context === "Session boot").map((e) => e.timestamp);
  await persist();
}

/** Whether the immediately preceding session (the one before this boot mark)
 * recorded an error — used to trigger the "send a report?" boot-time prompt. */
export async function didPreviousSessionError(): Promise<boolean> {
  const entries = await load();
  const boots = entries.filter((e) => e.context === "Session boot").map((e) => e.timestamp).sort((a, b) => b - a);
  if (boots.length < 2) return false;
  const [current, previous] = boots;
  return entries.some((e) => e.kind === "error" && e.timestamp < current && e.timestamp >= previous);
}

export async function logFailure(context: string, error: unknown): Promise<void> {
  const entries = await load();
  entries.unshift({
    timestamp: Date.now(),
    kind: "error",
    context,
    message: error instanceof Error ? error.message : String(error),
  });
  cache = prune(entries);
  await persist();
}

/** Call sites call this unconditionally, same as logFailure — the
 * usageLoggingEnabled gate (see useSettingsStore.ts) lives here, centrally,
 * rather than being repeated at every call site (same convention as
 * keepAwake.ts's setKeepAwake gating on its own settings flag). */
export async function logEvent(context: string, message: string): Promise<void> {
  if (!useSettingsStore.getState().usageLoggingEnabled) return;
  const entries = await load();
  entries.unshift({ timestamp: Date.now(), kind: "event", context, message });
  cache = prune(entries);
  await persist();
}

export async function getSessionLog(): Promise<LogEntry[]> {
  return load();
}

export async function clearSessionLog(): Promise<void> {
  cache = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function clearErrorLog(): Promise<void> {
  const entries = await load();
  cache = entries.filter((e) => e.kind !== "error");
  await persist();
}

export function formatSessionLog(entries: LogEntry[]): string {
  if (entries.length === 0) return "No log entries.";
  return entries
    .map((e) => `[${new Date(e.timestamp).toISOString()}] (${e.kind}) ${e.context}\n  ${e.message}`)
    .join("\n\n");
}
