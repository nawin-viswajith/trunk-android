import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LoggedFailure {
  timestamp: number;
  context: string;
  message: string;
}

const STORAGE_KEY = "pocketcoder-failure-log";
const MAX_ENTRIES = 200;

let cache: LoggedFailure[] | null = null;

async function load(): Promise<LoggedFailure[]> {
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

/** Called from the real catch blocks that already show the user an alert
 * (Inference send, Flow run, benchmark) rather than hooked in generically
 * through showAlert — a title-string match ("does this alert look like an
 * error?") is far more fragile than each call site just saying so directly. */
export async function logFailure(context: string, error: unknown): Promise<void> {
  const entries = await load();
  entries.unshift({ timestamp: Date.now(), context, message: error instanceof Error ? error.message : String(error) });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  await persist();
}

export async function getFailureLog(): Promise<LoggedFailure[]> {
  return load();
}

export async function clearFailureLog(): Promise<void> {
  cache = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function formatFailureLog(entries: LoggedFailure[]): string {
  if (entries.length === 0) return "No failures logged.";
  return entries.map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.context}\n  ${e.message}`).join("\n\n");
}
