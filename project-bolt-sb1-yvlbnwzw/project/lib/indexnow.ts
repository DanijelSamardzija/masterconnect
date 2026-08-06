const BASE = 'https://www.gigzone.app';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
// In production, INDEXNOW_KEY must be set in Vercel environment variables.
// The hardcoded value is used only in local development.
const KEY = process.env.INDEXNOW_KEY ?? (
  process.env.NODE_ENV === 'production'
    ? (console.error('[IndexNow] INDEXNOW_KEY env var not set in production!'), 'b4d9e2f1a7c34f8b9d1e2a5c6f0b3d8e')
    : 'b4d9e2f1a7c34f8b9d1e2a5c6f0b3d8e'
);
const DEDUPE_TTL_MS = 60_000;

const recentlySent = new Map<string, number>();

export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const now = Date.now();

  const toSend = urls.filter(url => {
    const last = recentlySent.get(url);
    return !last || now - last > DEDUPE_TTL_MS;
  });

  if (toSend.length === 0) return;

  for (const url of toSend) recentlySent.set(url, now);

  // Prune stale entries to prevent unbounded memory growth
  for (const [url, ts] of recentlySent.entries()) {
    if (now - ts > DEDUPE_TTL_MS * 60) recentlySent.delete(url);
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'www.gigzone.app',
        key: KEY,
        keyLocation: `${BASE}/${KEY}.txt`,
        urlList: toSend,
      }),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[IndexNow] ${res.status} — ${toSend.length} URL(s):`, toSend);
    } else if (!res.ok && res.status !== 202) {
      console.error(`[IndexNow] ${res.status}`);
    }
  } catch (err) {
    console.error('[IndexNow] fetch failed:', err);
  }
}
