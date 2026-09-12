import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

const BALKAN_COUNTRIES = ['Serbia', 'Srbija', 'Croatia', 'Hrvatska', 'Bosnia and Herzegovina', 'Bosna i Hercegovina', 'Montenegro', 'Crna Gora', 'Slovenia', 'Slovenija', 'North Macedonia', 'Sjeverna Makedonija'];
const GERMAN_COUNTRIES = ['Germany', 'Deutschland', 'Austria', 'Österreich', 'Switzerland', 'Schweiz'];
const SPANISH_COUNTRIES = ['Spain', 'España', 'Mexico', 'México', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay'];
const FRENCH_COUNTRIES = ['France', 'Belgium', 'Belgique', 'Canada', 'Luxembourg'];

function getLang(country: string): 'sr' | 'de' | 'en' | 'es' | 'fr' {
  if (BALKAN_COUNTRIES.includes(country)) return 'sr';
  if (GERMAN_COUNTRIES.includes(country)) return 'de';
  if (SPANISH_COUNTRIES.includes(country)) return 'es';
  if (FRENCH_COUNTRIES.includes(country)) return 'fr';
  return 'en';
}

function getContent(lang: 'sr' | 'de' | 'en' | 'es' | 'fr', firstName: string, ownerName: string, role: string) {
  const roleLabels: Record<typeof lang, Record<string, string>> = {
    sr: { worker: 'Radnik', manager: 'Menadžer' },
    en: { worker: 'Worker', manager: 'Manager' },
    de: { worker: 'Mitarbeiter', manager: 'Manager' },
    es: { worker: 'Empleado', manager: 'Gerente' },
    fr: { worker: 'Employé', manager: 'Gérant' },
  };
  const roleLabel = roleLabels[lang][role] ?? role;

  if (lang === 'sr') return {
    subject: `${ownerName} te je dodao/la u tim na GigZone`,
    greeting: `Zdravo, ${firstName}! 👋`,
    intro: `<strong>${ownerName}</strong> te je dodao/la kao <strong>${roleLabel}</strong> u njihov tim na GigZone.`,
    body: 'Sada možeš pregledati raspored i rezervacije koje su ti dodijeljene direktno u Kontrolnoj Tabli.',
    cta: 'Pregledaj raspored',
    footer: 'Ako misliš da je ovo greška, možeš ignorisati ovu poruku ili nas kontaktirati na support@gigzone.app.',
    team: 'GigZone tim',
  };

  if (lang === 'de') return {
    subject: `${ownerName} hat dich zu ihrem Team auf GigZone hinzugefügt`,
    greeting: `Hallo, ${firstName}! 👋`,
    intro: `<strong>${ownerName}</strong> hat dich als <strong>${roleLabel}</strong> zu ihrem Team auf GigZone hinzugefügt.`,
    body: 'Du kannst jetzt deinen Zeitplan und die dir zugewiesenen Buchungen direkt im Dashboard einsehen.',
    cta: 'Zeitplan ansehen',
    footer: 'Falls du glaubst, dass dies ein Fehler ist, kannst du diese Nachricht ignorieren oder uns unter support@gigzone.app kontaktieren.',
    team: 'Das GigZone-Team',
  };

  if (lang === 'es') return {
    subject: `${ownerName} te añadió a su equipo en GigZone`,
    greeting: `¡Hola, ${firstName}! 👋`,
    intro: `<strong>${ownerName}</strong> te ha añadido como <strong>${roleLabel}</strong> a su equipo en GigZone.`,
    body: 'Ahora puedes ver tu horario y las reservas que te han asignado directamente en el Panel de Control.',
    cta: 'Ver horario',
    footer: 'Si crees que esto es un error, puedes ignorar este mensaje o contactarnos en support@gigzone.app.',
    team: 'El equipo de GigZone',
  };

  if (lang === 'fr') return {
    subject: `${ownerName} vous a ajouté à son équipe sur GigZone`,
    greeting: `Bonjour, ${firstName} ! 👋`,
    intro: `<strong>${ownerName}</strong> vous a ajouté en tant que <strong>${roleLabel}</strong> à son équipe sur GigZone.`,
    body: 'Vous pouvez désormais consulter votre planning et les réservations qui vous sont attribuées directement dans le Tableau de Bord.',
    cta: 'Voir le planning',
    footer: "Si vous pensez qu'il s'agit d'une erreur, vous pouvez ignorer ce message ou nous contacter à support@gigzone.app.",
    team: "L'équipe GigZone",
  };

  return {
    subject: `${ownerName} added you to their team on GigZone`,
    greeting: `Hello, ${firstName}! 👋`,
    intro: `<strong>${ownerName}</strong> has added you as a <strong>${roleLabel}</strong> to their team on GigZone.`,
    body: 'You can now view your schedule and assigned bookings directly in the Dashboard.',
    cta: 'View schedule',
    footer: 'If you think this is a mistake, you can ignore this message or contact us at support@gigzone.app.',
    team: 'The GigZone Team',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { staffUserId, ownerName, role } = await request.json();
    if (!staffUserId || !ownerName) return NextResponse.json({ ok: true });

    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, country')
      .eq('id', staffUserId)
      .single();

    if (!profile?.email) return NextResponse.json({ ok: true });

    const firstName = profile.name?.split(' ')[0] || profile.name || 'there';
    const lang = getLang(profile.country ?? '');
    const c = getContent(lang, firstName, ownerName, role ?? 'worker');

    await sendEmail({
      to: profile.email,
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
            <h2 style="margin:0 0 8px;font-size:22px">${c.greeting}</h2>
            <p style="color:#555;margin:0 0 16px">${c.intro}</p>
            <p style="color:#555;margin:0 0 24px">${c.body}</p>
            <div style="text-align:center;margin:28px 0">
              <a href="https://gigzone.app/dashboard/staff/bookings"
                 style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                ${c.cta}
              </a>
            </div>
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
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Staff added email error:', err);
    return NextResponse.json({ ok: true });
  }
}
