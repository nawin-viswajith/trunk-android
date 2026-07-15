import { useSettingsStore } from "../state/useSettingsStore";

function baseUrl(): string {
  return useSettingsStore.getState().backendUrl;
}

export function wsBaseUrl(): string {
  return baseUrl().replace(/^http/, "ws");
}

// Render's free-tier cold start (see backendHealth.ts) can take 30-50s, so
// this needs to be generous — but with no timeout at all, a genuinely
// stalled connection left the caller's loading spinner stuck indefinitely
// with no way to recover short of leaving the screen.
const REQUEST_TIMEOUT_MS = 60_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error("Request timed out - the server took too long to respond.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, headers }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
