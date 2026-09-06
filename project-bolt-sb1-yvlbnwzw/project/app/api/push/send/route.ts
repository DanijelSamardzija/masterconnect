import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';
import { translateNotification } from '@/lib/notification-translations';

export const runtime = 'nodejs';

async function processPush(body: any) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'support@gigzone.app'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const record = body.record ?? body;
  const { user_id, title, body: notifBody, meta, type: notifType, action_type } = record;
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

  // Translate push title/body to recipient's preferred language
  const { data: recipientLangRow } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', user_id)
    .maybeSingle();
  const pushLang = (recipientLangRow?.preferred_language as string) || 'sr';
  const translated = translateNotification({ title, body: notifBody, action_type, meta }, pushLang);

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
    title: translated.title || 'GigZone',
    body: translated.body || '',
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

  // Email locale — drives all 4 email types below
  const emailLocales: Record<string, {
    fb: string;
    msgCta: string;
    revHeading: (s: string) => string;
    revBody: (n: string) => string;
    revCta: string;
    folHeading: string;
    folBody: (n: string) => string;
    folCta: string;
    comHeading: (r: boolean) => string;
    comBody: (n: string, r: boolean) => string;
    comCta: string;
  }> = {
    en: {
      fb: 'Someone',
      msgCta: 'Open message',
      revHeading: (s) => `New review ${s}`,
      revBody: (n) => `<strong>${n}</strong> left you a review.`,
      revCta: 'View review',
      folHeading: 'New follower 👤',
      folBody: (n) => `<strong>${n}</strong> started following you.`,
      folCta: 'View profile',
      comHeading: (r) => r ? 'New reply 💬' : 'New comment 💬',
      comBody: (n, r) => `<strong>${n}</strong> ${r ? 'replied to your comment' : 'commented on your post'}.`,
      comCta: 'View post',
    },
    de: {
      fb: 'Jemand',
      msgCta: 'Nachricht öffnen',
      revHeading: (s) => `Neue Bewertung ${s}`,
      revBody: (n) => `<strong>${n}</strong> hat eine Bewertung hinterlassen.`,
      revCta: 'Bewertung ansehen',
      folHeading: 'Neuer Follower 👤',
      folBody: (n) => `<strong>${n}</strong> folgt Ihnen jetzt.`,
      folCta: 'Profil ansehen',
      comHeading: (r) => r ? 'Neue Antwort 💬' : 'Neuer Kommentar 💬',
      comBody: (n, r) => `<strong>${n}</strong> ${r ? 'hat auf Ihren Kommentar geantwortet' : 'hat Ihren Beitrag kommentiert'}.`,
      comCta: 'Beitrag ansehen',
    },
    es: {
      fb: 'Alguien',
      msgCta: 'Abrir mensaje',
      revHeading: (s) => `Nueva reseña ${s}`,
      revBody: (n) => `<strong>${n}</strong> te dejó una reseña.`,
      revCta: 'Ver reseña',
      folHeading: 'Nuevo seguidor 👤',
      folBody: (n) => `<strong>${n}</strong> te ha empezado a seguir.`,
      folCta: 'Ver perfil',
      comHeading: (r) => r ? 'Nueva respuesta 💬' : 'Nuevo comentario 💬',
      comBody: (n, r) => `<strong>${n}</strong> ${r ? 'respondió a tu comentario' : 'comentó tu publicación'}.`,
      comCta: 'Ver publicación',
    },
    fr: {
      fb: 'Quelqu\'un',
      msgCta: 'Ouvrir le message',
      revHeading: (s) => `Nouvel avis ${s}`,
      revBody: (n) => `<strong>${n}</strong> vous a laissé un avis.`,
      revCta: 'Voir l\'avis',
      folHeading: 'Nouvel abonné 👤',
      folBody: (n) => `<strong>${n}</strong> vous suit maintenant.`,
      folCta: 'Voir le profil',
      comHeading: (r) => r ? 'Nouvelle réponse 💬' : 'Nouveau commentaire 💬',
      comBody: (n, r) => `<strong>${n}</strong> ${r ? 'a répondu à votre commentaire' : 'a commenté votre publication'}.`,
      comCta: 'Voir la publication',
    },
    sr: {
      fb: 'Neko',
      msgCta: 'Otvori poruku',
      revHeading: (s) => `Nova recenzija ${s}`,
      revBody: (n) => `<strong>${n}</strong> ti je ostavio/la recenziju.`,
      revCta: 'Pogledaj recenziju',
      folHeading: 'Novi pratilac 👤',
      folBody: (n) => `<strong>${n}</strong> je počeo/la da te prati.`,
      folCta: 'Pogledaj profil',
      comHeading: (r) => r ? 'Novi odgovor na komentar 💬' : 'Novi komentar 💬',
      comBody: (n, r) => `<strong>${n}</strong> ${r ? 'je odgovorio/la na tvoj komentar' : 'je komentarisao/la tvoj post'}.`,
      comCta: 'Pogledaj post',
    },
  };
  const eL = emailLocales[pushLang] ?? emailLocales.sr;

  const emailLogo = `
    <div style="text-align:center;padding:24px 0 12px">
      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px">Gig<span style="color:#ea580c">Zone</span></span>
    </div>`;
  const emailFooter = `<p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">GigZone · gigzone.app</p>`;

  // Email for new message (also fires for offer/inquiry thread notifications)
  if (meta?.thread_id) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      await sendEmail({
        to: recipientProfile.email,
        replyTo: 'support@gigzone.app',
        subject: translated.title || (pushLang === 'sr' ? 'Nova poruka na GigZone' : 'New message on GigZone'),
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            ${emailLogo}
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
              <h2 style="margin:0 0 8px;color:#1a1a1a">${translated.title || ''}</h2>
              <p style="color:#555;margin:0 0 20px">${translated.body || ''}</p>
              <a href="https://www.gigzone.app/messages/${meta.thread_id}"
                 style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                ${eL.msgCta}
              </a>
            </div>
            ${emailFooter}
          </div>
        `,
      }).catch(() => {});
    }
  }

  // Email for new review
  if (meta?.reviewer_id) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      const stars = '⭐'.repeat(meta.rating || 0);
      const reviewerName = meta.actor_name || eL.fb;
      const profileUrl = `https://www.gigzone.app/profile/${user_id}`;
      await sendEmail({
        to: recipientProfile.email,
        replyTo: 'support@gigzone.app',
        subject: translated.title || eL.revHeading(stars),
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            ${emailLogo}
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
              <h2 style="margin:0 0 8px;color:#1a1a1a">${eL.revHeading(stars)}</h2>
              <p style="color:#555;margin:0 0 8px">${eL.revBody(reviewerName)}</p>
              ${notifBody ? `<p style="color:#333;background:#f9fafb;border-left:3px solid #ea580c;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;font-style:italic">"${notifBody}"</p>` : '<div style="margin-bottom:20px"></div>'}
              <a href="${profileUrl}"
                 style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                ${eL.revCta}
              </a>
            </div>
            ${emailFooter}
          </div>
        `,
      }).catch(() => {});
    }
  }

  // Email for new follower
  if (notifType === 'follow' && meta?.follower_id) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      const followerName = meta.actor_name || eL.fb;
      const followerUrl = `https://www.gigzone.app/profile/${meta.follower_id}`;
      await sendEmail({
        to: recipientProfile.email,
        replyTo: 'support@gigzone.app',
        subject: translated.title || eL.folHeading,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            ${emailLogo}
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
              <h2 style="margin:0 0 8px;color:#1a1a1a">${eL.folHeading}</h2>
              <p style="color:#555;margin:0 0 20px">${eL.folBody(followerName)}</p>
              <a href="${followerUrl}"
                 style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                ${eL.folCta}
              </a>
            </div>
            ${emailFooter}
          </div>
        `,
      }).catch(() => {});
    }
  }

  // Email for new comment or reply
  if ((notifType === 'comment' || notifType === 'reply') && meta?.post_id) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      const commenterName = meta.actor_name || eL.fb;
      const isReply = notifType === 'reply';
      const postUrl = `https://www.gigzone.app/posts/${meta.post_id}`;
      await sendEmail({
        to: recipientProfile.email,
        replyTo: 'support@gigzone.app',
        subject: translated.title || eL.comHeading(isReply),
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            ${emailLogo}
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
              <h2 style="margin:0 0 8px;color:#1a1a1a">${eL.comHeading(isReply)}</h2>
              <p style="color:#555;margin:0 0 8px">${eL.comBody(commenterName, isReply)}</p>
              ${notifBody ? `<p style="color:#333;background:#f9fafb;border-left:3px solid #ea580c;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;font-style:italic">"${notifBody}"</p>` : '<div style="margin-bottom:20px"></div>'}
              <a href="${postUrl}"
                 style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                ${eL.comCta}
              </a>
            </div>
            ${emailFooter}
          </div>
        `,
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
