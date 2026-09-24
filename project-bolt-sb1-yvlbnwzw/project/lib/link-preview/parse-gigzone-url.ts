const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export type GigZoneUrlInfo =
  | { type: 'booking-termini'; businessId: string; locationId?: string }
  | { type: 'booking-service'; businessId: string; serviceId: string }
  | { type: 'majstori';        businessId: string }
  | { type: 'post';            postId: string }
  | { type: 'profile';         userId: string }
  | { type: 'job';             jobId: string }
  | { type: 'service';         serviceId: string }
  | null;

const GIGZONE_HOSTS = new Set(['gigzone.app', 'www.gigzone.app']);

function parsedUrl(raw: string): URL | null {
  try { return new URL(raw); } catch { return null; }
}

export function isGigZoneUrl(url: string): boolean {
  const u = parsedUrl(url);
  if (!u) return false;
  return GIGZONE_HOSTS.has(u.hostname) || u.hostname === 'localhost' || u.hostname === '127.0.0.1';
}

/** Parse a GigZone URL and return structured info, or null for unrecognised paths. */
export function parseGigZoneUrl(url: string): GigZoneUrlInfo {
  const u = parsedUrl(url);
  if (!u) return null;
  if (!isGigZoneUrl(url)) return null;

  const path = u.pathname;
  const sp   = u.searchParams;

  // /booking/majstori/{uuid}
  const maj = path.match(new RegExp(`^/booking/majstori/(${UUID})`, 'i'));
  if (maj) return { type: 'majstori', businessId: maj[1] };

  // /booking/{uuid}/{serviceId}
  const svc = path.match(new RegExp(`^/booking/(${UUID})/(${UUID})`, 'i'));
  if (svc) return { type: 'booking-service', businessId: svc[1], serviceId: svc[2] };

  // /booking/{uuid}  (bare profile or ?locationId=...)
  const trm = path.match(new RegExp(`^/booking/(${UUID})$`, 'i'));
  if (trm) {
    const locationId = sp.get('locationId') ?? undefined;
    return { type: 'booking-termini', businessId: trm[1], locationId };
  }

  // /posts/{uuid}  or /{lang}/posts/{uuid}
  const post = path.match(new RegExp(`^(?:/[a-z]{2})?/posts/(${UUID})`, 'i'));
  if (post) return { type: 'post', postId: post[1] };

  // /profile/{uuid}
  const prof = path.match(new RegExp(`^/profile/(${UUID})`, 'i'));
  if (prof) return { type: 'profile', userId: prof[1] };

  // /jobs/{uuid}
  const job = path.match(new RegExp(`^/jobs/(${UUID})`, 'i'));
  if (job) return { type: 'job', jobId: job[1] };

  // /services/{uuid}  — GigZone "Usluge" (posts with booking_enabled)
  const srv = path.match(new RegExp(`^/services/(${UUID})`, 'i'));
  if (srv) return { type: 'service', serviceId: srv[1] };

  return null;
}
