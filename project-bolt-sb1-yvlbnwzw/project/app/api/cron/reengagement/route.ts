import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ReengagementLang = 'sr' | 'en' | 'de' | 'es' | 'fr';

function getReengagementContent(lang: ReengagementLang, firstName: string) {
  const content: Record<ReengagementLang, { subject: string; greeting: string; body: string; bullets: string; cta: string; sign: string }> = {
    sr: {
      subject: `${firstName}, ima novih objava na GigZone 👀`,
      greeting: `Zdravo, ${firstName}! 👋`,
      body: 'Nisi nas posjetio/la već neko vrijeme — a dosta se toga promijenilo na GigZone. Novi profesionalci, nova radna mjesta i novi sadržaj čekaju te u feedu.',
      bullets: '<li>📱 <strong>Feed</strong> — Pogledaj šta su objavili profesionalci koje pratiš</li><li>🔍 <strong>Usluge</strong> — Pronađi majstore, fotografe, programere i još mnogo toga</li><li>💼 <strong>Poslovi</strong> — Novi oglasi svaki dan</li>',
      cta: 'Vrati se na GigZone',
      sign: 'Vidimo se uskoro!<br/><strong>GigZone tim</strong>',
    },
    en: {
      subject: `${firstName}, there are new listings on GigZone 👀`,
      greeting: `Hello, ${firstName}! 👋`,
      body: "You haven't visited us in a while — and a lot has changed on GigZone. New professionals, new job listings and new content are waiting for you in the feed.",
      bullets: '<li>📱 <strong>Feed</strong> — See what the professionals you follow have posted</li><li>🔍 <strong>Services</strong> — Find tradespeople, photographers, developers and much more</li><li>💼 <strong>Jobs</strong> — New listings every day</li>',
      cta: 'Return to GigZone',
      sign: 'See you soon!<br/><strong>The GigZone Team</strong>',
    },
    de: {
      subject: `${firstName}, es gibt neue Anzeigen auf GigZone 👀`,
      greeting: `Hallo, ${firstName}! 👋`,
      body: 'Sie haben uns eine Weile nicht besucht — und auf GigZone hat sich viel verändert. Neue Fachleute, neue Stellenangebote und neue Inhalte warten im Feed auf Sie.',
      bullets: '<li>📱 <strong>Feed</strong> — Sehen Sie, was die Fachleute, denen Sie folgen, gepostet haben</li><li>🔍 <strong>Dienstleistungen</strong> — Finden Sie Handwerker, Fotografen, Entwickler und vieles mehr</li><li>💼 <strong>Jobs</strong> — Täglich neue Anzeigen</li>',
      cta: 'Zurück zu GigZone',
      sign: 'Bis bald!<br/><strong>Das GigZone-Team</strong>',
    },
    es: {
      subject: `${firstName}, hay nuevos anuncios en GigZone 👀`,
      greeting: `¡Hola, ${firstName}! 👋`,
      body: 'Hace tiempo que no nos visitas — y muchas cosas han cambiado en GigZone. Nuevos profesionales, nuevos empleos y nuevo contenido te esperan en el feed.',
      bullets: '<li>📱 <strong>Feed</strong> — Ve lo que han publicado los profesionales que sigues</li><li>🔍 <strong>Servicios</strong> — Encuentra técnicos, fotógrafos, desarrolladores y mucho más</li><li>💼 <strong>Empleos</strong> — Nuevos anuncios cada día</li>',
      cta: 'Volver a GigZone',
      sign: '¡Hasta pronto!<br/><strong>El equipo de GigZone</strong>',
    },
    fr: {
      subject: `${firstName}, il y a de nouvelles annonces sur GigZone 👀`,
      greeting: `Bonjour, ${firstName} ! 👋`,
      body: "Vous ne nous avez pas rendu visite depuis un moment — et beaucoup de choses ont changé sur GigZone. De nouveaux professionnels, de nouvelles offres d'emploi et de nouveaux contenus vous attendent dans le fil d'actualité.",
      bullets: "<li>📱 <strong>Feed</strong> — Voyez ce que les professionnels que vous suivez ont publié</li><li>🔍 <strong>Services</strong> — Trouvez des artisans, photographes, développeurs et bien plus</li><li>💼 <strong>Emplois</strong> — Nouvelles annonces chaque jour</li>",
      cta: 'Retourner sur GigZone',
      sign: "À bientôt !<br/><strong>L'équipe GigZone</strong>",
    },
  };
  return content[lang];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find users inactive for 30+ days who haven't received a reengagement email
  // in the last 60 days (to avoid resending too often)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inactiveUsers, error } = await supabase
    .from('profiles')
    .select('id, name, email, last_seen, reengagement_sent_at, preferred_language')
    .not('email', 'is', null)
    .lt('last_seen', thirtyDaysAgo)
    .or(`reengagement_sent_at.is.null,reengagement_sent_at.lt.${sixtyDaysAgo}`)
    .limit(100);

  if (error) {
    console.error('Reengagement query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inactiveUsers || inactiveUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const user of inactiveUsers) {
    if (!user.email) continue;

    const rawLang = (user as any).preferred_language as string | null;
    const lang: ReengagementLang = (['sr', 'en', 'de', 'es', 'fr'].includes(rawLang ?? '') ? rawLang : 'sr') as ReengagementLang;
    const firstName = user.name?.split(' ')[0] || user.name || (lang === 'en' ? 'friend' : lang === 'de' ? 'Freund' : lang === 'es' ? 'amigo' : lang === 'fr' ? 'ami' : 'prijatelju');
    const c = getReengagementContent(lang, firstName);

    const ok = await sendEmail({
      to: user.email,
      replyTo: 'support@gigzone.app',
      subject: c.subject,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <div style="text-align:center;padding:32px 0 16px">
            <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
              Gig<span style="color:#ea580c">Zone</span>
            </span>
          </div>

          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
            <h2 style="margin:0 0 12px;font-size:20px">${c.greeting}</h2>
            <p style="color:#555;margin:0 0 20px;line-height:1.6">${c.body}</p>

            <ul style="color:#333;margin:0 0 24px;padding-left:20px;line-height:2">
              ${c.bullets}
            </ul>

            <div style="text-align:center;margin:28px 0">
              <a href="https://gigzone.app/feed"
                 style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                ${c.cta}
              </a>
            </div>

            <p style="color:#888;font-size:13px;margin:24px 0 0">
              ${c.sign}
            </p>
          </div>

          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
            GigZone · gigzone.app
          </p>
        </div>
      `,
    }).catch(() => false);

    if (ok) {
      sent++;
      await supabase
        .from('profiles')
        .update({ reengagement_sent_at: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      failed++;
    }
  }

  console.log(`Reengagement emails: ${sent} sent, ${failed} failed`);
  return NextResponse.json({ ok: true, sent, failed });
}
