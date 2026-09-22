import { NextRequest, NextResponse } from 'next/server';
import { detectLang, SUPPORTED_LANGS } from '@/lib/i18n-config';

const PUBLIC_PATHS = ['/jobs', '/services', '/invest'];

// UUID v4 pattern — detail pages (services, jobs) use UUIDs and have canonical URLs without lang prefix
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Routes that require an authenticated session.
// Public booking pages (/booking/, /booking/[businessId]/*, /booking/majstori/*, etc.) are excluded.
const BOOKING_AUTH_PREFIXES = [
  '/booking/business',
  '/booking/trade',
  '/booking/my',
  '/booking/orders',
  '/booking/stays',
  '/booking/reservations',
  '/booking/requests',
];

function requiresAuth(pathname: string): boolean {
  return BOOKING_AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Lightweight session presence check — looks for any Supabase auth cookie.
// Full JWT validation happens at the page/RPC layer; this is a UX-layer guard.
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    ({ name }) => name.startsWith('sb-') && name.includes('-auth-token'),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already on a valid lang path — forward x-lang on the REQUEST so headers() in the
  // root layout Server Component can read it (response headers are not visible to headers()).
  const langSegment = pathname.split('/')[1];
  if (SUPPORTED_LANGS.includes(langSegment as any)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-lang', langSegment);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Protected booking routes — redirect to login if no session cookie present
  if (requiresAuth(pathname)) {
    if (!hasAuthCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Only redirect known public SEO paths
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
  if (!isPublic) return NextResponse.next();

  // Detail pages (/services/{uuid}, /jobs/{uuid}) are served directly without lang prefix —
  // their canonical URLs have no lang segment, so don't redirect them.
  const detailSlug = pathname.split('/')[2];
  if (detailSlug && UUID_RE.test(detailSlug)) return NextResponse.next();

  const lang = detectLang(request.headers.get('accept-language') || '');
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname}`;

  return NextResponse.redirect(url, { status: 301 });
}

export const config = {
  matcher: [
    '/jobs',
    '/jobs/:path*',
    '/services',
    '/services/:path*',
    '/invest',
    '/invest/:path*',
    '/booking/business',
    '/booking/business/:path*',
    '/booking/trade',
    '/booking/trade/:path*',
    '/booking/my',
    '/booking/my/:path*',
    '/booking/orders',
    '/booking/orders/:path*',
    '/booking/stays',
    '/booking/stays/:path*',
    '/booking/reservations',
    '/booking/reservations/:path*',
    '/booking/requests',
    '/booking/requests/:path*',
    '/sr/:path*',
    '/en/:path*',
    '/de/:path*',
    '/es/:path*',
    '/fr/:path*',
  ],
};
