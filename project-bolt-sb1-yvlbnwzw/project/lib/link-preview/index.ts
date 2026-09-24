import { getCached, setCached } from './cache';
import { isGigZoneUrl, parseGigZoneUrl } from './parse-gigzone-url';
import { resolveInternal } from './resolve-internal';
import { resolveExternal } from './resolve-external';
import type { PreviewData } from './types';

/**
 * Resolve a URL to a preview card data object.
 * - GigZone internal URLs → Supabase directly (no proxy, no SSRF risk)
 * - External URLs → /api/link-preview server-side proxy
 * - Returns null when no preview is available (URL stays as plain link)
 * - Results are cached in memory + sessionStorage to avoid redundant requests
 */
export async function resolvePreview(url: string): Promise<PreviewData | null> {
  const cached = getCached(url);
  if (cached !== undefined) return cached;

  try {
    let result: PreviewData | null;

    if (isGigZoneUrl(url)) {
      const info = parseGigZoneUrl(url);
      result = info ? await resolveInternal(url, info) : null;
    } else {
      result = await resolveExternal(url);
    }

    setCached(url, result);
    return result;
  } catch {
    setCached(url, null);
    return null;
  }
}

export type { PreviewData } from './types';
export type { GigZoneUrlInfo } from './parse-gigzone-url';
export { parseGigZoneUrl, isGigZoneUrl } from './parse-gigzone-url';
