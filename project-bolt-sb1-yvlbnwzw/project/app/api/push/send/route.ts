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

  // Email locale — drives all email types below
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
    bkgCreatedHeading: (n: string) => string;
    bkgCreatedCta: string;
    bkgConfirmedHeading: string;
    bkgConfirmedBody: (biz: string) => string;
    bkgConfirmedCta: string;
    bkgCancelledHeading: string;
    bkgCancelledBody: (biz: string) => string;
    bkgCancelledCta: string;
    bkgCompletedHeading: string;
    bkgCompletedBody: (biz: string) => string;
    bkgCompletedCta: string;
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
      bkgCreatedHeading: (n) => `New booking from ${n}`,
      bkgCreatedCta: 'View booking',
      bkgConfirmedHeading: 'Booking confirmed ✅',
      bkgConfirmedBody: (biz) => `Your booking at <strong>${biz}</strong> has been confirmed.`,
      bkgConfirmedCta: 'View booking',
      bkgCancelledHeading: 'Booking cancelled',
      bkgCancelledBody: (biz) => `Your booking at <strong>${biz}</strong> has been cancelled.`,
      bkgCancelledCta: 'View dashboard',
      bkgCompletedHeading: 'Appointment completed ✅',
      bkgCompletedBody: (biz) => `Your appointment at <strong>${biz}</strong> is complete. Leave a review!`,
      bkgCompletedCta: 'Leave a review',
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
      bkgCreatedHeading: (n) => `Neue Buchung von ${n}`,
      bkgCreatedCta: 'Buchung ansehen',
      bkgConfirmedHeading: 'Buchung bestätigt ✅',
      bkgConfirmedBody: (biz) => `Ihre Buchung bei <strong>${biz}</strong> wurde bestätigt.`,
      bkgConfirmedCta: 'Buchung ansehen',
      bkgCancelledHeading: 'Buchung storniert',
      bkgCancelledBody: (biz) => `Ihre Buchung bei <strong>${biz}</strong> wurde storniert.`,
      bkgCancelledCta: 'Dashboard öffnen',
      bkgCompletedHeading: 'Termin abgeschlossen ✅',
      bkgCompletedBody: (biz) => `Ihr Termin bei <strong>${biz}</strong> ist abgeschlossen. Hinterlassen Sie eine Bewertung!`,
      bkgCompletedCta: 'Bewertung hinterlassen',
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
      bkgCreatedHeading: (n) => `Nueva reserva de ${n}`,
      bkgCreatedCta: 'Ver reserva',
      bkgConfirmedHeading: 'Reserva confirmada ✅',
      bkgConfirmedBody: (biz) => `Tu reserva en <strong>${biz}</strong> ha sido confirmada.`,
      bkgConfirmedCta: 'Ver reserva',
      bkgCancelledHeading: 'Reserva cancelada',
      bkgCancelledBody: (biz) => `Tu reserva en <strong>${biz}</strong> ha sido cancelada.`,
      bkgCancelledCta: 'Ver panel',
      bkgCompletedHeading: 'Cita completada ✅',
      bkgCompletedBody: (biz) => `Tu cita en <strong>${biz}</strong> ha concluido. ¡Deja una reseña!`,
      bkgCompletedCta: 'Dejar una reseña',
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
      bkgCreatedHeading: (n) => `Nouvelle réservation de ${n}`,
      bkgCreatedCta: 'Voir la réservation',
      bkgConfirmedHeading: 'Réservation confirmée ✅',
      bkgConfirmedBody: (biz) => `Votre réservation chez <strong>${biz}</strong> a été confirmée.`,
      bkgConfirmedCta: 'Voir la réservation',
      bkgCancelledHeading: 'Réservation annulée',
      bkgCancelledBody: (biz) => `Votre réservation chez <strong>${biz}</strong> a été annulée.`,
      bkgCancelledCta: 'Voir le tableau de bord',
      bkgCompletedHeading: 'Rendez-vous terminé ✅',
      bkgCompletedBody: (biz) => `Votre rendez-vous chez <strong>${biz}</strong> est terminé. Laissez un avis !`,
      bkgCompletedCta: 'Laisser un avis',
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
      bkgCreatedHeading: (n) => `Nova rezervacija od ${n}`,
      bkgCreatedCta: 'Pogledaj rezervaciju',
      bkgConfirmedHeading: 'Rezervacija potvrđena ✅',
      bkgConfirmedBody: (biz) => `Vaša rezervacija kod <strong>${biz}</strong> je potvrđena.`,
      bkgConfirmedCta: 'Pogledaj rezervaciju',
      bkgCancelledHeading: 'Rezervacija otkazana',
      bkgCancelledBody: (biz) => `Vaša rezervacija kod <strong>${biz}</strong> je otkazana.`,
      bkgCancelledCta: 'Otvori dashboard',
      bkgCompletedHeading: 'Termin završen ✅',
      bkgCompletedBody: (biz) => `Vaš termin kod <strong>${biz}</strong> je završen. Ostavite recenziju!`,
      bkgCompletedCta: 'Ostavi recenziju',
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

  // Email for booking notifications (booking_created / booking_confirmed / booking_cancelled)
  if (notifType === 'booking' && meta?.booking_id) {
    const { data: recipientProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user_id).maybeSingle();

    if (recipientProfile?.email) {
      const bizName    = meta.business_name || eL.fb;
      const clientName = meta.client_name   || eL.fb;
      const svcName    = meta.service_name  || '';
      const dtStr      = meta.starts_at
        ? new Date(meta.starts_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
        : '';
      const dashUrl = 'https://www.gigzone.app/dashboard';

      let subject = translated.title || '';
      let heading = '';
      let bodyHtml = '';
      let ctaText  = '';
      let ctaUrl   = dashUrl;

      if (action_type === 'booking_created') {
        subject  = subject || eL.bkgCreatedHeading(clientName);
        heading  = eL.bkgCreatedHeading(clientName);
        bodyHtml = `<p style="color:#555;margin:0 0 8px">${svcName ? `<strong>${svcName}</strong>` : ''}</p>
                    ${dtStr ? `<p style="color:#888;margin:0 0 20px;font-size:14px">📅 ${dtStr}</p>` : '<div style="margin-bottom:20px"></div>'}`;
        ctaText  = eL.bkgCreatedCta;
      } else if (action_type === 'booking_confirmed') {
        subject  = subject || eL.bkgConfirmedHeading;
        heading  = eL.bkgConfirmedHeading;
        bodyHtml = `<p style="color:#555;margin:0 0 8px">${eL.bkgConfirmedBody(bizName)}</p>
                    ${svcName ? `<p style="color:#333;font-weight:600;margin:0 0 4px">${svcName}</p>` : ''}
                    ${dtStr ? `<p style="color:#888;margin:0 0 20px;font-size:14px">📅 ${dtStr}</p>` : '<div style="margin-bottom:20px"></div>'}`;
        ctaText  = eL.bkgConfirmedCta;
      } else if (action_type === 'booking_cancelled') {
        subject  = subject || eL.bkgCancelledHeading;
        heading  = eL.bkgCancelledHeading;
        bodyHtml = `<p style="color:#555;margin:0 0 8px">${eL.bkgCancelledBody(bizName)}</p>
                    ${svcName ? `<p style="color:#333;font-weight:600;margin:0 0 4px">${svcName}</p>` : ''}
                    ${dtStr ? `<p style="color:#888;margin:0 0 20px;font-size:14px">📅 ${dtStr}</p>` : '<div style="margin-bottom:20px"></div>'}`;
        ctaText  = eL.bkgCancelledCta;
      } else if (action_type === 'booking_completed') {
        subject  = subject || eL.bkgCompletedHeading;
        heading  = eL.bkgCompletedHeading;
        bodyHtml = `<p style="color:#555;margin:0 0 8px">${eL.bkgCompletedBody(bizName)}</p>
                    ${svcName ? `<p style="color:#333;font-weight:600;margin:0 0 4px">${svcName}</p>` : ''}
                    ${dtStr ? `<p style="color:#888;margin:0 0 20px;font-size:14px">📅 ${dtStr}</p>` : '<div style="margin-bottom:20px"></div>'}`;
        ctaText  = eL.bkgCompletedCta;
        ctaUrl   = `https://www.gigzone.app/dashboard/bookings`;
      }

      if (heading && ctaText) {
        await sendEmail({
          to: recipientProfile.email,
          replyTo: 'support@gigzone.app',
          subject,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              ${emailLogo}
              <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px">
                <h2 style="margin:0 0 12px;color:#1a1a1a">${heading}</h2>
                ${bodyHtml}
                <a href="${ctaUrl}"
                   style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
                  ${ctaText}
                </a>
              </div>
              ${emailFooter}
            </div>
          `,
        }).catch(() => {});
      }
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
