export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export function formatInferenceStats(stats: {
  tokensGenerated?: number;
  tokensPerSecond?: number;
  promptTokens?: number;
  promptTokensPerSecond?: number;
  totalMs?: number;
}): string {
  // Defensive: history entries saved before these fields existed won't have
  // them (no store migration), so fall back rather than render "NaN".
  const promptTokPerSec = stats.promptTokensPerSecond ?? 0;
  const tokPerSec = stats.tokensPerSecond ?? 0;
  const totalMs = stats.totalMs ?? 0;
  return `${promptTokPerSec.toFixed(1)} tok/s in · ${tokPerSec.toFixed(1)} tok/s out · ${(totalMs / 1000).toFixed(1)}s`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(ms: number): string {
  if (!ms) return "unknown date";
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
