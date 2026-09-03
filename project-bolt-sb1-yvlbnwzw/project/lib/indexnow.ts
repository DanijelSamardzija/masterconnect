const BASE = 'https://www.gigzone.app';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
// Set INDEXNOW_KEY in Vercel env vars. In local dev, submissions are silently skipped.
const KEY = process.env.INDEXNOW_KEY ?? null;
const DEDUPE_TTL_MS = 60_000;

const recentlySent = new Map<string, number>();

export async function notifyIndexNow(urls: string[]): Promise<void> {
  if (!KEY || urls.length === 0) return;

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
