import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Called by Supabase Database Webhook when a notification row is inserted
export async function POST(request: NextRequest) {
  // Verify webhook secret to prevent unauthorized calls
  const secret = request.headers.get('x-webhook-secret');
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'support@gigzone.app'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const body = await request.json();
  // Supabase webhook sends { type, table, record, ... }
  const record = body.record ?? body;
  const { user_id, title, body: notifBody, meta } = record;

  if (!user_id) return NextResponse.json({ error: 'No user_id' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all push subscriptions for this user
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ skipped: 'no subscriptions' });
  }

  // Build deep-link URL
  let url = '/';
  if (meta?.thread_id) url = `/messages/${meta.thread_id}`;
  else if (meta?.post_id) url = `/posts/${meta.post_id}`;
  else if (meta?.job_id) url = `/jobs/${meta.job_id}`;
  else if (meta?.follower_id) url = `/profile/${meta.follower_id}`;
  else if (meta?.reviewer_id) url = '/dashboard';

  const payload = JSON.stringify({
    title: title || 'GigZone',
    body: notifBody || '',
    url,
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Clean up expired/invalid subscriptions (410 Gone or 404 Not Found)
  const expiredEndpoints = results
    .map((r, i) => ({ r, sub: subscriptions[i] }))
    .filter(({ r }) => {
      if (r.status !== 'rejected') return false;
      const code = (r as PromiseRejectedResult).reason?.statusCode;
      return code === 410 || code === 404;
    })
    .map(({ sub }) => sub.endpoint);

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return NextResponse.json({ sent, total: subscriptions.length });
}
