/**
 * Converts a raw user search term into a PostgreSQL tsquery string
 * with prefix matching on every word.
 *
 * "android developer" → "android:* & developer:*"
 * "klima uređaj"      → "klima:* & uređaj:*"
 *
 * Returns null when the term is empty or whitespace-only.
 * Reusable across Services, Jobs, and Feed.
 */
export function buildFtsQuery(term: string): string | null {
  const words = term.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return words.map((w) => `${w}:*`).join(' & ');
}
