import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BALKAN_COUNTRIES = ['Serbia', 'Srbija', 'Croatia', 'Hrvatska', 'Bosnia and Herzegovina', 'Bosna i Hercegovina', 'Montenegro', 'Crna Gora', 'Slovenia', 'Slovenija', 'North Macedonia', 'Sjeverna Makedonija'];
const GERMAN_COUNTRIES = ['Germany', 'Deutschland', 'Austria', 'Österreich', 'Switzerland', 'Schweiz'];

function getContent(isPro: boolean, lang: 'sr' | 'de' | 'en', firstName: string) {
  if (lang === 'sr') {
    return {
      subject: `Dobrodošao na GigZone, ${firstName}!`,
      greeting: `Zdravo, ${firstName}! 👋`,
      intro: 'Dobrodošao na GigZone — platformu koja spaja profesionalce i klijente na jednom mestu. Ovde možeš ponuditi usluge, tražiti radnike, oglasiti potrebu — ili pratiti šta rade drugi.',
      bullets: isPro
        ? `<li>🔧 <strong>Stranica Usluge</strong> — Objavi svoju uslugu ili portfolio. Tu te pronalaze klijenti koji traže nekog poput tebe.<br/><span style="color:#888;font-size:13px">Npr. "Elektroinstalacije — Beograd, iskustvo 10 godina"</span></li>
           <li>👷 <strong>Stranica Poslovi → Zapošljavanje</strong> — Trebaš radnika? Objavi oglas i čekaj prijave.</li>
           <li>📱 <strong>Feed</strong> — Podeli slike svojih radova i projekata. Gradi reputaciju i privuci klijente organskim putem.</li>
           <li>🖼️ <strong>Dodaj profilnu sliku</strong> — Profili sa slikom dobijaju 3× više pažnje.</li>`
        : `<li>🔍 <strong>Stranica Poslovi → Tražim uslugu</strong> — Objavi šta ti treba i čekaj ponude majstora.<br/><span style="color:#888;font-size:13px">Npr. "Trebam molera za stan 60m², Novi Sad"</span></li>
           <li>💼 <strong>Stranica Poslovi → Tražim posao</strong> — Traži posao ili objavi da tražiš radnika.<br/><span style="color:#888;font-size:13px">Npr. "Tražim konobara za restoran, Beograd"</span></li>
           <li>🛠️ <strong>Stranica Usluge</strong> — Pregledaj profesionalce, čitaj recenzije i kontaktiraj direktno.</li>
           <li>📱 <strong>Feed</strong> — Objavljuj projekte, pitaj za savete, prati profesionalce.</li>
           <li>🖼️ <strong>Dodaj profilnu sliku</strong> — Profili sa slikom dobijaju 3× više pažnje.</li>`,
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
      intro: 'Willkommen bei GigZone — der Plattform, die Profis und Kunden verbindet. Hier kannst du Dienstleistungen anbieten, Mitarbeiter suchen oder einfach verfolgen, was andere tun.',
      bullets: isPro
        ? `<li>🔧 <strong>Seite Dienstleistungen</strong> — Veröffentliche deine Dienstleistung oder Portfolio. Hier finden dich Kunden.<br/><span style="color:#888;font-size:13px">Bsp. "Elektroinstallationen — Berlin, 10 Jahre Erfahrung"</span></li>
           <li>👷 <strong>Jobs → Stellenanzeige</strong> — Brauchst du Mitarbeiter? Schalte eine Anzeige und warte auf Bewerbungen.</li>
           <li>📱 <strong>Feed</strong> — Teile Fotos deiner Projekte. Baue deinen Ruf auf und gewinne Kunden.</li>
           <li>🖼️ <strong>Profilbild hinzufügen</strong> — Profile mit Foto erhalten 3× mehr Aufmerksamkeit.</li>`
        : `<li>🔍 <strong>Jobs → Dienstleistung suchen</strong> — Beschreibe, was du brauchst, und warte auf Angebote.<br/><span style="color:#888;font-size:13px">Bsp. "Suche Maler für 60m² Wohnung, Wien"</span></li>
           <li>💼 <strong>Jobs → Arbeit suchen</strong> — Suche einen Job oder stelle einen Mitarbeiter ein.<br/><span style="color:#888;font-size:13px">Bsp. "Suche Kellner für Restaurant, Berlin"</span></li>
           <li>🛠️ <strong>Seite Dienstleistungen</strong> — Durchsuche Profile, lies Bewertungen und kontaktiere direkt.</li>
           <li>📱 <strong>Feed</strong> — Teile Projekte, frage um Rat, folge Profis.</li>
           <li>🖼️ <strong>Profilbild hinzufügen</strong> — Profile mit Foto erhalten 3× mehr Aufmerksamkeit.</li>`,
      cta: isPro ? 'Erste Anzeige schalten' : 'GigZone entdecken',
      social: 'Wir teilen gelegentlich die besten Anzeigen auf unserem <strong>TikTok</strong> und <strong>Instagram</strong> — deine könnte dabei sein!',
      footer: 'Bei Fragen antworte einfach auf diese E-Mail.',
      team: 'Das GigZone-Team',
    };
  }

  return {
    subject: `Welcome to GigZone, ${firstName}!`,
    greeting: `Hello, ${firstName}! 👋`,
    intro: 'Welcome to GigZone — the platform connecting professionals and clients in one place. Offer services, find workers, post a job request — or just follow what others are doing.',
    bullets: isPro
      ? `<li>🔧 <strong>Services page</strong> — Post your service or portfolio. This is where clients find you.<br/><span style="color:#888;font-size:13px">E.g. "Electrical work — Belgrade, 10 years experience"</span></li>
         <li>👷 <strong>Jobs → Hiring</strong> — Need a worker? Post a job listing and wait for applications.</li>
         <li>📱 <strong>Feed</strong> — Share photos of your work and projects. Build your reputation and attract clients.</li>
         <li>🖼️ <strong>Add a profile photo</strong> — Profiles with photos get 3× more attention.</li>`
      : `<li>🔍 <strong>Jobs → Looking for a service</strong> — Post what you need and wait for offers from professionals.<br/><span style="color:#888;font-size:13px">E.g. "Need a painter for 60m² apartment, Novi Sad"</span></li>
         <li>💼 <strong>Jobs → Looking for work</strong> — Search for a job or post that you're looking for an employee.<br/><span style="color:#888;font-size:13px">E.g. "Looking for a waiter for restaurant, Belgrade"</span></li>
         <li>🛠️ <strong>Services page</strong> — Browse professionals, read reviews and contact them directly.</li>
         <li>📱 <strong>Feed</strong> — Share projects, ask for advice, follow professionals.</li>
         <li>🖼️ <strong>Add a profile photo</strong> — Profiles with photos get 3× more attention.</li>`,
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
