import { NextRequest, NextResponse } from 'next/server';
import { detectLang, SUPPORTED_LANGS } from '@/lib/i18n-config';

const PUBLIC_PATHS = ['/jobs', '/services', '/invest'];

// UUID v4 pattern — detail pages (services, jobs) use UUIDs and have canonical URLs without lang prefix
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Already on a valid lang path — pass through
  const langSegment = pathname.split('/')[1];
  if (SUPPORTED_LANGS.includes(langSegment as any)) {
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
    '/sr/:path*',
    '/en/:path*',
    '/de/:path*',
  ],
};
