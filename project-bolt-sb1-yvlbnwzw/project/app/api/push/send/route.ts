import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function processPush(body: any) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'support@gigzone.app'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const record = body.record ?? body;
  const { user_id, title, body: notifBody, meta } = record;
  if (!user_id) return;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (meta?.thread_id) {
    const { data: participant } = await supabase
      .from('thread_participants')
      .select('last_read_at')
      .eq('thread_id', meta.thread_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (participant?.last_read_at) {
      const lastRead = new Date(participant.last_read_at).getTime();
      if (Date.now() - lastRead < 60000) return;
    }
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user_id);

  if (!subscriptions || subscriptions.length === 0) return;

  let url = '/';
  if (meta?.thread_id) url = `/messages/${meta.thread_id}`;
  else if (meta?.post_id) url = `/posts/${meta.post_id}`;
  else if (meta?.job_id) url = `/jobs/${meta.job_id}`;
  else if (meta?.follower_id) url = `/profile/${meta.follower_id}`;
  else if (meta?.reviewer_id) url = '/dashboard';

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

  const expiredEndpoints = results
    .map((r, i) => ({ r, sub: subscriptions[i] }))
    .filter(({ r }) => {
      if (r.status !== 'rejected') return false;
      const code = (r as PromiseRejectedResult).reason?.statusCode;
      return code === 410 || code === 404;
    })
    .map(({ sub }) => sub.endpoint);

  if (expiredEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
  }

  if (meta?.thread_id && process.env.RESEND_API_KEY) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GigZone <hello@gigzone.app>',
          to: [recipientProfile.email],
          reply_to: 'support@gigzone.app',
          subject: title || 'Nova poruka na GigZone',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <div style="text-align:center;padding:24px 0 12px">
                <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px">
                  Gig<span style="color:#ea580c">Zone</span>
                </span>
              </div>
              <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
                <h2 style="margin:0 0 8px;color:#1a1a1a">${title || 'Nova poruka'}</h2>
                <p style="color:#555;margin:0 0 20px">${notifBody || ''}</p>
                <a href="https://www.gigzone.app/messages/${meta.thread_id}"
                   style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                  Otvori poruku
                </a>
              </div>
              <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">GigZone · gigzone.app</p>
            </div>
          `,
        }),
      }).catch(() => {});
    }
  }
}

// Called by Supabase Database Webhook when a notification row is inserted
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret');
  if (!process.env.PUSH_WEBHOOK_SECRET || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Return 200 immediately so Supabase webhook never times out.
  // waitUntil keeps the function alive until push processing finishes.
  waitUntil(processPush(body));

  return NextResponse.json({ ok: true });
}
