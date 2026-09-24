import type { PreviewData } from './types';

const STORAGE_PREFIX = 'gzlp:'; // gz link preview
const mem = new Map<string, PreviewData | null>();

function ssGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function ssSet(key: string, val: string): void {
  try { sessionStorage.setItem(key, val); } catch {}
}

/** Returns the cached value, or `undefined` if nothing is cached for this URL. */
export function getCached(url: string): PreviewData | null | undefined {
  if (mem.has(url)) return mem.get(url)!;
  const raw = ssGet(STORAGE_PREFIX + url);
  if (raw === null) return undefined;
  const val: PreviewData | null = raw === 'null' ? null : (() => { try { return JSON.parse(raw) as PreviewData; } catch { return null; } })();
  mem.set(url, val);
  return val;
}

/** Stores `null` to mark "fetched, no preview available" and prevent future requests. */
export function setCached(url: string, data: PreviewData | null): void {
  mem.set(url, data);
  ssSet(STORAGE_PREFIX + url, data === null ? 'null' : JSON.stringify(data));
}
