/** Checks GitHub's public releases API for a newer version than the one
 * installed - trunk-android is the public repo, so this hits it directly
 * (not the app's own configurable backendUrl, which is unrelated). No auth
 * needed: GitHub's REST API allows unauthenticated reads of public repos,
 * just at a lower (but plenty sufficient for one check per app open) rate
 * limit. */
const LATEST_RELEASE_URL = "https://api.github.com/repos/nawin-viswajith/trunk-android/releases/latest";

const REQUEST_TIMEOUT_MS = 8000;

export interface AvailableUpdate {
  version: string;
  releaseUrl: string;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

/** "v1.3.7" -> [1, 3, 7]; a trailing pre-release letter ("1.3.7a") sorts as
 * lower than the plain numeric version it's based on, so a real "1.3.7"
 * release still counts as newer than an "1.3.7a" someone sideloaded. */
function parseVersion(version: string): { parts: number[]; suffix: string } {
  const cleaned = version.replace(/^v/i, "");
  const match = cleaned.match(/^(\d+(?:\.\d+)*)([a-z]*)$/i);
  if (!match) return { parts: [], suffix: "" };
  return { parts: match[1].split(".").map(Number), suffix: match[2] ?? "" };
}

/** Returns true if `remote` is a newer version than `current`. Numeric parts
 * compare first; if those are equal, a build with no letter suffix counts as
 * newer than one with a letter suffix (e.g. "1.3.7" > "1.3.7f"). */
export function isNewerVersion(remote: string, current: string): boolean {
  const a = parseVersion(remote);
  const b = parseVersion(current);
  const len = Math.max(a.parts.length, b.parts.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.parts[i] ?? 0) - (b.parts[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  if (a.suffix === b.suffix) return false;
  if (a.suffix === "") return true;
  if (b.suffix === "") return false;
  return a.suffix > b.suffix;
}

/** Returns null on any failure (offline, rate-limited, malformed response) or
 * if the latest release isn't newer - this is a best-effort background
 * check, never something that should surface an error to the user. */
export async function checkForUpdate(currentVersion: string): Promise<AvailableUpdate | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const release: GithubRelease = await res.json();
    if (release.draft || release.prerelease) return null;
    const remoteVersion = release.tag_name.replace(/^v/i, "");
    if (!isNewerVersion(remoteVersion, currentVersion)) return null;
    return { version: remoteVersion, releaseUrl: release.html_url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
