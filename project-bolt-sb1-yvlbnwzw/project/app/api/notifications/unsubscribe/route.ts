import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return new NextResponse('Invalid link', { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await supabase
    .from('search_subscriptions')
    .delete()
    .eq('email', decodeURIComponent(email).toLowerCase().trim());

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gigzone.app';

  return new NextResponse(
    `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribed — GigZone</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;text-align:center;padding:60px 24px;background:#f9fafb">
  <div style="max-width:480px;margin:0 auto;background:white;padding:40px;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="font-size:48px;margin-bottom:16px">✅</div>
    <h2 style="color:#111827;margin:0 0 8px">Successfully unsubscribed</h2>
    <p style="color:#6b7280">You will no longer receive search notifications from GigZone.</p>
    <a href="${siteUrl}" style="display:inline-block;margin-top:24px;background:#f97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Back to GigZone</a>
  </div>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
