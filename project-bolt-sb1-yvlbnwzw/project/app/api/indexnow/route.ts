import { NextRequest, NextResponse } from 'next/server';
import { notifyIndexNow } from '@/lib/indexnow';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls: unknown = body?.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls required' }, { status: 400 });
    }

    const safeUrls = urls.filter(
      (u): u is string =>
        typeof u === 'string' && u.startsWith('https://www.gigzone.app/')
    );

    notifyIndexNow(safeUrls).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
}
