function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function isSubsequence(text: string, query: string): boolean {
  let qi = 0;
  for (let i = 0; i < text.length && qi < query.length; i++) {
    if (text[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

/** Lightweight, dependency-free fuzzy filter: exact substring first, then a
 * subsequence match (handles skipped/abbreviated chars), then per-token edit
 * distance (handles typos like a swapped or missing letter). */
export function fuzzyMatch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  if (isSubsequence(t, q)) return true;

  const threshold = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
  return tokenize(text).some((tok) => levenshtein(tok, q) <= threshold);
}
