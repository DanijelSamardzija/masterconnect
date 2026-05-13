import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BALKAN_COUNTRIES = ['Serbia', 'Srbija', 'Croatia', 'Hrvatska', 'Bosnia and Herzegovina', 'Bosna i Hercegovina', 'Montenegro', 'Crna Gora', 'Slovenia', 'Slovenija', 'North Macedonia', 'Sjeverna Makedonija'];
const GERMAN_COUNTRIES = ['Germany', 'Deutschland', 'Austria', 'Österreich', 'Switzerland', 'Schweiz'];

function getContent(isPro: boolean, lang: 'sr' | 'de' | 'en', firstName: string) {
  if (lang === 'sr') {
    return {
      subject: `Dobrodošao na GigZone, ${firstName}!`,
      greeting: `Zdravo, ${firstName}! 👋`,
      intro: 'Dobrodošao na GigZone — platformu koja spaja profesionalce i klijente.',
      bullets: isPro
        ? `<li>Objavi <strong>uslugu</strong> koju nudiš i privuci klijente</li>
           <li>Objavi <strong>oglas za posao</strong> ako tražiš radnika</li>
           <li>Predstavi se u <strong>feedu</strong> — šta radiš, kako radiš</li>`
        : `<li>Pronađi <strong>majstora ili uslugu</strong> koja ti treba</li>
           <li>Objavi šta ti treba i <strong>čekaj ponude</strong></li>
           <li>Potraži <strong>posao</strong> ili oglasi radno mesto</li>`,
      cta: isPro ? 'Objavi prvi oglas' : 'Istraži GigZone',
      social: 'Povremeno dijelimo najbolje oglase na našem <strong>TikTok</strong> i <strong>Instagram</strong> nalogu — tvoj oglas može biti jedan od njih!',
      footer: 'Ako imaš pitanja, samo odgovori na ovaj mejl.',
      team: 'GigZone tim',
    };
  }

  if (lang === 'de') {
    return {
      subject: `Willkommen bei GigZone, ${firstName}!`,
      greeting: `Hallo, ${firstName}! 👋`,
      intro: 'Willkommen bei GigZone — der Plattform, die Profis und Kunden verbindet.',
      bullets: isPro
        ? `<li>Veröffentliche deine <strong>Dienstleistung</strong> und gewinne Kunden</li>
           <li>Schalte eine <strong>Stellenanzeige</strong>, wenn du Mitarbeiter suchst</li>
           <li>Stell dich im <strong>Feed</strong> vor — was du machst, wie du arbeitest</li>`
        : `<li>Finde einen <strong>Handwerker oder eine Dienstleistung</strong></li>
           <li>Schreibe, was du brauchst, und <strong>warte auf Angebote</strong></li>
           <li>Suche einen <strong>Job</strong> oder veröffentliche eine Stelle</li>`,
      cta: isPro ? 'Erste Anzeige schalten' : 'GigZone entdecken',
      social: 'Wir teilen gelegentlich die besten Anzeigen auf unserem <strong>TikTok</strong> und <strong>Instagram</strong> — deine könnte dabei sein!',
      footer: 'Bei Fragen antworte einfach auf diese E-Mail.',
      team: 'Das GigZone-Team',
    };
  }

  return {
    subject: `Welcome to GigZone, ${firstName}!`,
    greeting: `Hello, ${firstName}! 👋`,
    intro: 'Welcome to GigZone — the platform connecting professionals and clients.',
    bullets: isPro
      ? `<li>Post your <strong>service</strong> and attract clients</li>
         <li>Post a <strong>job listing</strong> if you're looking for workers</li>
         <li>Introduce yourself in the <strong>feed</strong> — what you do, how you work</li>`
      : `<li>Find a <strong>professional or service</strong> you need</li>
         <li>Post what you need and <strong>wait for offers</strong></li>
         <li>Search for a <strong>job</strong> or post a vacancy</li>`,
    cta: isPro ? 'Post your first listing' : 'Explore GigZone',
    social: 'We occasionally share the best listings on our <strong>TikTok</strong> and <strong>Instagram</strong> — yours could be one of them!',
    footer: 'If you have any questions, just reply to this email.',
    team: 'The GigZone Team',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, account_type, country')
      .eq('id', userId)
      .single();

    if (!profile?.email) return NextResponse.json({ ok: true });

    const firstName = profile.name?.split(' ')[0] || profile.name || 'there';
    const isPro = profile.account_type === 'professional';

    let lang: 'sr' | 'de' | 'en' = 'en';
    if (BALKAN_COUNTRIES.includes(profile.country)) lang = 'sr';
    else if (GERMAN_COUNTRIES.includes(profile.country)) lang = 'de';

    const c = getContent(isPro, lang, firstName);
    const ctaUrl = isPro ? 'https://gigzone.app/create-post' : 'https://gigzone.app/feed';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'GigZone <hello@gigzone.app>',
        to: [profile.email],
        reply_to: 'gigzoneapp@gmail.com',
        subject: c.subject,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <div style="text-align:center;padding:32px 0 16px">
              <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
                Gig<span style="color:#ea580c">Zone</span>
              </span>
            </div>

            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
              <h2 style="margin:0 0 8px;font-size:22px">${c.greeting}</h2>
              <p style="color:#555;margin:0 0 20px">${c.intro}</p>

              <ul style="color:#333;margin:0 0 24px;padding-left:20px;line-height:2">
                ${c.bullets}
              </ul>

              <div style="text-align:center;margin:28px 0">
                <a href="${ctaUrl}"
                   style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                  ${c.cta}
                </a>
              </div>

              <p style="color:#555;font-size:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin:0 0 20px">
                📱 ${c.social}
              </p>

              <p style="color:#888;font-size:13px;margin:24px 0 0">
                ${c.footer}<br/>
                <strong>${c.team}</strong>
              </p>
            </div>

            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
              GigZone · gigzone.app
            </p>
          </div>
        `,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ ok: true });
  }
}
