import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

const BALKAN  = ['Serbia','Srbija','Croatia','Hrvatska','Bosnia and Herzegovina','Bosna i Hercegovina','Montenegro','Crna Gora','Slovenia','Slovenija','North Macedonia','Sjeverna Makedonija'];
const GERMAN  = ['Germany','Deutschland','Austria','Österreich','Switzerland','Schweiz'];
const SPANISH = ['Spain','España','Mexico','México','Argentina','Colombia','Chile','Peru','Perú','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay'];
const FRENCH  = ['France','Belgium','Belgique','Canada','Luxembourg'];

type Lang = 'sr' | 'de' | 'en' | 'es' | 'fr';
type EmailType = 'confirmation' | 'cancellation' | 'reschedule';

function getLang(country: string): Lang {
  if (BALKAN.includes(country))  return 'sr';
  if (GERMAN.includes(country))  return 'de';
  if (SPANISH.includes(country)) return 'es';
  if (FRENCH.includes(country))  return 'fr';
  return 'en';
}

function fmtDt(iso: string, tz: string, lang: Lang): string {
  const locale = { sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[lang];
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(iso));
}

function content(type: EmailType, lang: Lang, p: {
  firstName: string; service: string; business: string; dt: string;
}) {
  const map: Record<Lang, Record<EmailType, {subject:string;title:string;body:string;dateLabel:string;cta:string;footer:string}>> = {
    sr: {
      confirmation: {
        subject: `Rezervacija potvrđena — ${p.service}`,
        title: 'Rezervacija kreirana ✅',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je uspješno kreirana.`,
        dateLabel: 'Termin',
        cta: 'Pregledaj rezervacije',
        footer: 'Za izmjene ili otkazivanje, posjeti GigZone.',
      },
      cancellation: {
        subject: `Rezervacija otkazana — ${p.service}`,
        title: 'Rezervacija otkazana',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je otkazana.`,
        dateLabel: 'Otkazani termin',
        cta: 'Zakaži novi termin',
        footer: 'Žao nam je! Slobodno zakaži novi termin kada ti odgovara.',
      },
      reschedule: {
        subject: `Termin premješten — ${p.service}`,
        title: 'Termin premješten 🗓️',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je premještena.`,
        dateLabel: 'Novi termin',
        cta: 'Pregledaj rezervacije',
        footer: 'Ako imaš pitanja, slobodno nas kontaktuj.',
      },
    },
    en: {
      confirmation: {
        subject: `Booking confirmed — ${p.service}`,
        title: 'Booking confirmed ✅',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been created.`,
        dateLabel: 'Appointment',
        cta: 'View bookings',
        footer: 'To change or cancel, visit GigZone.',
      },
      cancellation: {
        subject: `Booking cancelled — ${p.service}`,
        title: 'Booking cancelled',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been cancelled.`,
        dateLabel: 'Cancelled appointment',
        cta: 'Book again',
        footer: "We're sorry! Feel free to book a new appointment at any time.",
      },
      reschedule: {
        subject: `Appointment rescheduled — ${p.service}`,
        title: 'Appointment rescheduled 🗓️',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been moved.`,
        dateLabel: 'New appointment',
        cta: 'View bookings',
        footer: 'If you have any questions, feel free to contact us.',
      },
    },
    de: {
      confirmation: {
        subject: `Buchung bestätigt — ${p.service}`,
        title: 'Buchung bestätigt ✅',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde erfolgreich erstellt.`,
        dateLabel: 'Termin',
        cta: 'Buchungen ansehen',
        footer: 'Zum Ändern oder Stornieren besuche GigZone.',
      },
      cancellation: {
        subject: `Buchung storniert — ${p.service}`,
        title: 'Buchung storniert',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde storniert.`,
        dateLabel: 'Stornierter Termin',
        cta: 'Neu buchen',
        footer: 'Es tut uns leid! Du kannst jederzeit einen neuen Termin buchen.',
      },
      reschedule: {
        subject: `Termin verschoben — ${p.service}`,
        title: 'Termin verschoben 🗓️',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde verschoben.`,
        dateLabel: 'Neuer Termin',
        cta: 'Buchungen ansehen',
        footer: 'Bei Fragen stehen wir gerne zur Verfügung.',
      },
    },
    es: {
      confirmation: {
        subject: `Reserva confirmada — ${p.service}`,
        title: 'Reserva confirmada ✅',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido creada con éxito.`,
        dateLabel: 'Cita',
        cta: 'Ver mis reservas',
        footer: 'Para cambiar o cancelar, visita GigZone.',
      },
      cancellation: {
        subject: `Reserva cancelada — ${p.service}`,
        title: 'Reserva cancelada',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido cancelada.`,
        dateLabel: 'Cita cancelada',
        cta: 'Reservar de nuevo',
        footer: '¡Lo sentimos! Puedes reservar una nueva cita cuando quieras.',
      },
      reschedule: {
        subject: `Cita reprogramada — ${p.service}`,
        title: 'Cita reprogramada 🗓️',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido reprogramada.`,
        dateLabel: 'Nueva cita',
        cta: 'Ver mis reservas',
        footer: 'Si tienes alguna pregunta, no dudes en contactarnos.',
      },
    },
    fr: {
      confirmation: {
        subject: `Réservation confirmée — ${p.service}`,
        title: 'Réservation confirmée ✅',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a bien été créée.`,
        dateLabel: 'Rendez-vous',
        cta: 'Voir mes réservations',
        footer: 'Pour modifier ou annuler, rendez-vous sur GigZone.',
      },
      cancellation: {
        subject: `Réservation annulée — ${p.service}`,
        title: 'Réservation annulée',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a été annulée.`,
        dateLabel: 'Rendez-vous annulé',
        cta: 'Prendre un nouveau rendez-vous',
        footer: 'Nous sommes désolés ! Vous pouvez réserver à tout moment.',
      },
      reschedule: {
        subject: `Rendez-vous déplacé — ${p.service}`,
        title: 'Rendez-vous déplacé 🗓️',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a été déplacée.`,
        dateLabel: 'Nouveau rendez-vous',
        cta: 'Voir mes réservations',
        footer: 'Pour toute question, n\'hésitez pas à nous contacter.',
      },
    },
  };

  return map[lang][type];
}

function buildHtml(c: ReturnType<typeof content>, firstName: string, dt: string): string {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <div style="text-align:center;padding:32px 0 16px">
        <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
          Gig<span style="color:#ea580c">Zone</span>
        </span>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
        <h2 style="margin:0 0 8px;font-size:22px">${c.title}</h2>
        <p style="color:#555;margin:0 0 6px">Zdravo / Hello, <strong>${firstName}</strong></p>
        <p style="color:#555;margin:0 0 20px">${c.body}</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${c.dateLabel}</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1a1a1a">${dt}</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a href="https://gigzone.app/booking/my"
             style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block">
            ${c.cta}
          </a>
        </div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">
          ${c.footer}<br/>
          <strong>GigZone tim / Team</strong>
        </p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
        GigZone · gigzone.app · <a href="https://gigzone.app/booking/my" style="color:#aaa">Moje rezervacije</a>
      </p>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type: EmailType = body.type;
    const bookingId: string = body.booking_id;

    if (!type || !bookingId) return NextResponse.json({ ok: true });
    if (!['confirmation', 'cancellation', 'reschedule'].includes(type)) return NextResponse.json({ ok: true });
    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: booking } = await db
      .from('bookings')
      .select('starts_at, service_name_snapshot, client_id, business_id, location_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking?.client_id) return NextResponse.json({ ok: true });

    const [clientRes, bizRes, locRes] = await Promise.all([
      db.from('profiles').select('name, email, country').eq('id', booking.client_id).maybeSingle(),
      db.from('profiles').select('name').eq('id', booking.business_id).maybeSingle(),
      db.from('business_locations').select('timezone').eq('id', booking.location_id).maybeSingle(),
    ]);

    const clientProfile = clientRes.data;
    if (!clientProfile?.email) return NextResponse.json({ ok: true });

    const lang      = getLang(clientProfile.country ?? '');
    const firstName = clientProfile.name?.split(' ')[0] || 'there';
    const tz        = locRes.data?.timezone ?? 'UTC';
    const dt        = fmtDt(booking.starts_at, tz, lang);
    const service   = booking.service_name_snapshot ?? '';
    const business  = bizRes.data?.name ?? '';

    const c = content(type, lang, { firstName, service, business, dt });

    await sendEmail({
      to: clientProfile.email,
      subject: c.subject,
      replyTo: 'support@gigzone.app',
      html: buildHtml(c, firstName, dt),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking/notify]', err);
    return NextResponse.json({ ok: true });
  }
}
