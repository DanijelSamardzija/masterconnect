import { NextRequest, NextResponse } from 'next/server';
import { detectLang, SUPPORTED_LANGS } from '@/lib/i18n-config';

const PUBLIC_PATHS = ['/jobs', '/services', '/invest'];

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

  const lang = detectLang(request.headers.get('accept-language') || '');
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname}`;

  return NextResponse.redirect(url, { status: 302 });
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
