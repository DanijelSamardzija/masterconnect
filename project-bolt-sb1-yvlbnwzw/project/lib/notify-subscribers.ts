import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

type Lang = 'sr' | 'en' | 'de';

function buildEmail(lang: Lang, category: string | null, city: string | null, postUrl: string, jobTitle: string, email: string) {
  const subject: Record<Lang, string> = {
    sr: `Novi oglas na GigZone${category ? ` — ${category}` : ''}${city ? ` u ${city}` : ''}`,
    en: `New listing on GigZone${category ? ` — ${category}` : ''}${city ? ` in ${city}` : ''}`,
    de: `Neue Anzeige auf GigZone${category ? ` — ${category}` : ''}${city ? ` in ${city}` : ''}`,
  };

  const body: Record<Lang, string> = {
    sr: `<p style="color:#374151">Pojavio se novi oglas${category ? ` u kategoriji <strong>${category}</strong>` : ''}${city ? ` u <strong>${city}</strong>` : ''} koji odgovara tvojoj pretrazi na GigZone.</p>`,
    en: `<p style="color:#374151">A new listing${category ? ` in <strong>${category}</strong>` : ''}${city ? ` in <strong>${city}</strong>` : ''} matching your GigZone search has been posted.</p>`,
    de: `<p style="color:#374151">Eine neue Anzeige${category ? ` in <strong>${category}</strong>` : ''}${city ? ` in <strong>${city}</strong>` : ''} passend zu Ihrer GigZone-Suche wurde veröffentlicht.</p>`,
  };

  const cta: Record<Lang, string> = {
    sr: 'Pogledaj oglas',
    en: 'View listing',
    de: 'Anzeige ansehen',
  };

  const unsub: Record<Lang, string> = {
    sr: 'Odjavi se od obavještenja',
    en: 'Unsubscribe from notifications',
    de: 'Von Benachrichtigungen abmelden',
  };

  const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/unsubscribe?email=${encodeURIComponent(email)}`;

  return {
    subject: subject[lang],
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb">
        <div style="background:#f97316;padding:16px 24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700">GigZone</h1>
        </div>
        <div style="background:white;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="font-size:18px;color:#111827;margin-top:0">${subject[lang]}</h2>
          ${body[lang]}
          <p style="font-size:16px;font-weight:600;color:#111827;background:#f3f4f6;padding:12px 16px;border-radius:8px;margin:16px 0">${jobTitle}</p>
          <a href="${postUrl}" style="display:inline-block;background:#f97316;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">${cta[lang]}</a>
          <hr style="margin:28px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="font-size:12px;color:#9ca3af;margin:0"><a href="${unsubUrl}" style="color:#9ca3af">${unsub[lang]}</a></p>
        </div>
      </div>
    `,
  };
}

export async function notifySubscribers(
  category: string | null,
  city: string | null,
  postId: string,
  jobTitle: string,
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const postUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/services/${postId}`;

    const { data: subscribers, error } = await supabase
      .from('search_subscriptions')
      .select('id, email, language, category, city')
      .or(`last_notified_at.is.null,last_notified_at.lt.${yesterday}`)
      .limit(50);

    if (error || !subscribers?.length) return;

    const matched = subscribers.filter(sub => {
      const catMatch = !sub.category || !category ||
        sub.category.toLowerCase() === category.toLowerCase();
      const cityMatch = !sub.city || !city ||
        city.toLowerCase().includes(sub.city.toLowerCase()) ||
        sub.city.toLowerCase().includes(city.toLowerCase());
      return catMatch && cityMatch;
    });

    const sentIds: string[] = [];

    for (const sub of matched) {
      const lang = (['sr', 'en', 'de'].includes(sub.language) ? sub.language : 'sr') as Lang;
      const { subject, html } = buildEmail(lang, category, city, postUrl, jobTitle, sub.email);
      const ok = await sendEmail({ to: sub.email, subject, html });
      if (ok) sentIds.push(sub.id);
    }

    if (sentIds.length > 0) {
      await supabase
        .from('search_subscriptions')
        .update({ last_notified_at: new Date().toISOString() })
        .in('id', sentIds);
    }
  } catch {
    // Silent fail — don't break post creation
  }
}
