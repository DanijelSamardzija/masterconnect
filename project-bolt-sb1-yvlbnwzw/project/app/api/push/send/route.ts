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

  // If this is a message notification, check if user is actively in the conversation
  // by looking at thread_participants.last_read_at (updated every time user is in the thread)
  if (meta?.thread_id) {
    const { data: participant } = await supabase
      .from('thread_participants')
      .select('last_read_at')
      .eq('thread_id', meta.thread_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (participant?.last_read_at) {
      const lastRead = new Date(participant.last_read_at).getTime();
      const now = Date.now();
      // If user was active in this thread in the last 60 seconds, skip notification
      if (now - lastRead < 60000) {
        return NextResponse.json({ skipped: 'user is active in conversation' });
      }
    }
  }

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

  // Resolve actor avatar (shown as notification icon like Instagram)
  let actorAvatar: string | null = null;
  if (meta?.follower_id) {
    const { data: actor } = await supabase
      .from('profiles').select('avatar_url').eq('id', meta.follower_id).maybeSingle();
    actorAvatar = actor?.avatar_url || null;
  } else if (meta?.reviewer_id) {
    const { data: actor } = await supabase
      .from('profiles').select('avatar_url').eq('id', meta.reviewer_id).maybeSingle();
    actorAvatar = actor?.avatar_url || null;
  } else if (meta?.thread_id) {
    // Find the sender of the most recent message in this thread (not the recipient)
    const { data: lastMsg } = await supabase
      .from('messages')
      .select('sender_id, profiles!messages_sender_id_fkey(avatar_url)')
      .eq('thread_id', meta.thread_id)
      .eq('is_deleted', false)
      .neq('sender_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    actorAvatar = (lastMsg as any)?.profiles?.avatar_url || null;
  }

  const payload = JSON.stringify({
    title: title || 'GigZone',
    body: notifBody || '',
    url,
    icon: actorAvatar || undefined,
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

  // Send email notification for new messages
  if (meta?.thread_id && process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL) {
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('id', user_id)
      .maybeSingle();

    if (recipientProfile?.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GigZone <support@gigzone.app>',
          to: [recipientProfile.email],
          subject: title || 'Nova poruka na GigZone',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#ea580c">${title || 'Nova poruka'}</h2>
              <p>${notifBody || ''}</p>
              <a href="https://www.gigzone.app/messages/${meta.thread_id}"
                 style="display:inline-block;background:#ea580c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:12px">
                Otvori poruku
              </a>
              <p style="color:#888;font-size:12px;margin-top:24px">GigZone — gigzone.app</p>
            </div>
          `,
        }),
      }).catch(() => {}); // non-blocking
    }
  }

  return NextResponse.json({ sent, total: subscriptions.length });
}
