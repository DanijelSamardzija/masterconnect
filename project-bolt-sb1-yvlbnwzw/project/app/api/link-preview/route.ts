import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Block private/loopback/link-local IP ranges — SSRF protection
const PRIVATE_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|0\.0\.0\.0|fc00:|fe80:|::1$)/i;
const MAX_BYTES   = 512 * 1024; // 512 KB — we only need <head>
const TIMEOUT_MS  = 4000;

function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'localhost') return false;
    if (PRIVATE_RE.test(h)) return false;
    // Reject bare numeric IPv4 that might bypass hostname check via encoding
    if (/^[\d.]+$/.test(h) && PRIVATE_RE.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

// Extract OG and standard meta tags from HTML string
function extractMeta(html: string) {
  // Helper: try attribute orders (property/content or content/property)
  const og = (prop: string) =>
    /<meta[^>]+property=["']og:PROP["'][^>]+content=["']([^"']{1,500})["']/i
      .exec(html.replace('PROP', prop))?.[1]?.trim()
    ?? /<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:PROP["']/i
      .exec(html.replace('PROP', prop))?.[1]?.trim()
    ?? null;

  const meta = (name: string) =>
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']{1,500})["']`, 'i')
      .exec(html)?.[1]?.trim()
    ?? new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']${name}["']`, 'i')
      .exec(html)?.[1]?.trim()
    ?? null;

  const titleTag = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)?.[1]?.trim() ?? null;

  return {
    title:       og('title')       ?? titleTag,
    description: og('description') ?? meta('description'),
    imageUrl:    og('image'),
    domain:      og('site_name'),
  };
}

export async function POST(req: Request) {
  // Authenticate — only logged-in GigZone users can trigger external fetches
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || url.length > 2048)    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  if (!isSafeUrl(url))              return NextResponse.json({ error: 'Blocked URL' }, { status: 400 });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':      'GigZone-LinkPreview/1.0 (+https://gigzone.app)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'en,sr;q=0.9',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);

    // SSRF check after redirect: verify final URL is still safe
    if (res.url && !isSafeUrl(res.url)) {
      return NextResponse.json({ error: 'Blocked redirect' }, { status: 400 });
    }

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      return NextResponse.json({ error: 'Not HTML' }, { status: 400 });
    }

    // Read up to MAX_BYTES — stop early once we have <head>
    const reader = res.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'No body' }, { status: 502 });

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes >= MAX_BYTES) break;
    }
    reader.cancel().catch(() => {});

    // Concat Uint8Arrays without Buffer
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(merged);

    const meta = extractMeta(html);
    if (!meta.title) return NextResponse.json({ error: 'No metadata' }, { status: 404 });

    const finalUrl = res.url || url;
    const domain   = meta.domain ?? new URL(finalUrl).hostname.replace('www.', '');

    return NextResponse.json(
      { url: finalUrl, title: meta.title, description: meta.description, imageUrl: meta.imageUrl, domain },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
    );
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') return NextResponse.json({ error: 'Timeout' }, { status: 408 });
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });
  }
}
