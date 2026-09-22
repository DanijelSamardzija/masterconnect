import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

async function getAuthUser(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user }, error } = await anonClient.auth.getUser();
  return error || !user ? null : user;
}

const BALKAN  = ['Serbia','Srbija','Croatia','Hrvatska','Bosnia and Herzegovina','Bosna i Hercegovina','Montenegro','Crna Gora','Slovenia','Slovenija','North Macedonia','Sjeverna Makedonija'];
const GERMAN  = ['Germany','Deutschland','Austria','Österreich','Switzerland','Schweiz'];
const SPANISH = ['Spain','España','Mexico','México','Argentina','Colombia','Chile','Peru','Perú','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay'];
const FRENCH  = ['France','Belgium','Belgique','Canada','Luxembourg'];

type Lang = 'sr' | 'de' | 'en' | 'es' | 'fr';
// confirmation / cancellation / reschedule = client emails
// new_booking  = business owner/staff email when new booking arrives
// reminder     = client reminder email (called from cron)
type EmailType = 'confirmation' | 'cancellation' | 'reschedule' | 'new_booking' | 'reminder' | 'client_rescheduled';

function getLang(country: string | null | undefined): Lang {
  if (BALKAN.includes(country ?? ''))  return 'sr';
  if (GERMAN.includes(country ?? ''))  return 'de';
  if (SPANISH.includes(country ?? '')) return 'es';
  if (FRENCH.includes(country ?? ''))  return 'fr';
  return 'en';
}

function fmtDt(iso: string, tz: string, lang: Lang): string {
  const locale = { sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' }[lang];
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: tz,
  }).format(new Date(iso));
}

type ContentParams = { firstName: string; service: string; business: string; dt: string; clientName?: string; reason?: string };
type ContentResult = { subject: string; title: string; body: string; dateLabel: string; locationLabel: string; cta: string; footer: string };

function content(type: EmailType, lang: Lang, p: ContentParams): ContentResult {
  const map: Record<Lang, Record<EmailType, ContentResult>> = {
    sr: {
      confirmation: {
        subject: `Rezervacija potvrđena — ${p.service}`,
        title: 'Rezervacija kreirana ✅',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je uspješno kreirana.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj rezervacije',
        footer: 'Za izmjene ili otkazivanje, posjeti GigZone.',
      },
      cancellation: {
        subject: `Rezervacija otkazana — ${p.service}`,
        title: 'Rezervacija otkazana',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je otkazana.`,
        dateLabel: 'Otkazani termin',
        locationLabel: 'Lokacija',
        cta: 'Zakaži novi termin',
        footer: 'Žao nam je! Slobodno zakaži novi termin kada ti odgovara.',
      },
      reschedule: {
        subject: `Termin premješten — ${p.service}`,
        title: 'Termin premješten 🗓️',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong> je premještena.`,
        dateLabel: 'Novi termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj rezervacije',
        footer: 'Ako imaš pitanja, slobodno nas kontaktuj.',
      },
      new_booking: {
        subject: `Nova rezervacija — ${p.service}`,
        title: 'Nova rezervacija 📅',
        body: `<strong>${p.clientName ?? 'Klijent'}</strong> je zakazao/la termin za <strong>${p.service}</strong>.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termine',
        footer: 'Prijavite se na GigZone da vidite detalje i upravljate rezervacijama.',
      },
      client_rescheduled: {
        subject: `Termin premješten — ${p.service}`,
        title: 'Klijent premjestio/la termin 🗓️',
        body: `<strong>${p.clientName ?? 'Klijent'}</strong> je premjestio/la termin za <strong>${p.service}</strong>.${p.reason ? `<br/><em>Razlog: ${p.reason}</em>` : ''}`,
        dateLabel: 'Novi termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termine',
        footer: 'Prijavite se na GigZone da vidite detalje i upravljate rezervacijama.',
      },
      reminder: {
        subject: `Podsjetnik — termin sutra: ${p.service}`,
        title: 'Termin sutra ⏰',
        body: `Podsjećamo te da imaš termin za <strong>${p.service}</strong> kod <strong>${p.business}</strong>.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj rezervacije',
        footer: 'Ako nisi u mogućnosti doći, otkaži termin u aplikaciji.',
      },
    },
    en: {
      confirmation: {
        subject: `Booking confirmed — ${p.service}`,
        title: 'Booking confirmed ✅',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been created.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'To change or cancel, visit GigZone.',
      },
      cancellation: {
        subject: `Booking cancelled — ${p.service}`,
        title: 'Booking cancelled',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been cancelled.`,
        dateLabel: 'Cancelled appointment',
        locationLabel: 'Location',
        cta: 'Book again',
        footer: "We're sorry! Feel free to book a new appointment at any time.",
      },
      reschedule: {
        subject: `Appointment rescheduled — ${p.service}`,
        title: 'Appointment rescheduled 🗓️',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong> has been moved.`,
        dateLabel: 'New appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'If you have any questions, feel free to contact us.',
      },
      new_booking: {
        subject: `New booking — ${p.service}`,
        title: 'New booking 📅',
        body: `<strong>${p.clientName ?? 'A client'}</strong> has booked <strong>${p.service}</strong>.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'Log in to GigZone to view details and manage your bookings.',
      },
      client_rescheduled: {
        subject: `Appointment rescheduled — ${p.service}`,
        title: 'Client rescheduled 🗓️',
        body: `<strong>${p.clientName ?? 'A client'}</strong> rescheduled their appointment for <strong>${p.service}</strong>.${p.reason ? `<br/><em>Reason: ${p.reason}</em>` : ''}`,
        dateLabel: 'New appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'Log in to GigZone to view details and manage your bookings.',
      },
      reminder: {
        subject: `Reminder — appointment tomorrow: ${p.service}`,
        title: 'Appointment tomorrow ⏰',
        body: `This is a reminder that you have an appointment for <strong>${p.service}</strong> at <strong>${p.business}</strong>.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: "If you can't make it, please cancel in the app.",
      },
    },
    de: {
      confirmation: {
        subject: `Buchung bestätigt — ${p.service}`,
        title: 'Buchung bestätigt ✅',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde erfolgreich erstellt.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Zum Ändern oder Stornieren besuche GigZone.',
      },
      cancellation: {
        subject: `Buchung storniert — ${p.service}`,
        title: 'Buchung storniert',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde storniert.`,
        dateLabel: 'Stornierter Termin',
        locationLabel: 'Standort',
        cta: 'Neu buchen',
        footer: 'Es tut uns leid! Du kannst jederzeit einen neuen Termin buchen.',
      },
      reschedule: {
        subject: `Termin verschoben — ${p.service}`,
        title: 'Termin verschoben 🗓️',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong> wurde verschoben.`,
        dateLabel: 'Neuer Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Bei Fragen stehen wir gerne zur Verfügung.',
      },
      new_booking: {
        subject: `Neue Buchung — ${p.service}`,
        title: 'Neue Buchung 📅',
        body: `<strong>${p.clientName ?? 'Ein Kunde'}</strong> hat einen Termin für <strong>${p.service}</strong> gebucht.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Melde dich bei GigZone an, um Details zu sehen und Buchungen zu verwalten.',
      },
      client_rescheduled: {
        subject: `Termin verschoben — ${p.service}`,
        title: 'Kunde hat Termin verschoben 🗓️',
        body: `<strong>${p.clientName ?? 'Ein Kunde'}</strong> hat den Termin für <strong>${p.service}</strong> verschoben.${p.reason ? `<br/><em>Grund: ${p.reason}</em>` : ''}`,
        dateLabel: 'Neuer Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Melde dich bei GigZone an, um Details zu sehen und Buchungen zu verwalten.',
      },
      reminder: {
        subject: `Erinnerung — Termin morgen: ${p.service}`,
        title: 'Termin morgen ⏰',
        body: `Erinnerung: Du hast morgen einen Termin für <strong>${p.service}</strong> bei <strong>${p.business}</strong>.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Falls du nicht kommen kannst, storniere bitte in der App.',
      },
    },
    es: {
      confirmation: {
        subject: `Reserva confirmada — ${p.service}`,
        title: 'Reserva confirmada ✅',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido creada con éxito.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mis reservas',
        footer: 'Para cambiar o cancelar, visita GigZone.',
      },
      cancellation: {
        subject: `Reserva cancelada — ${p.service}`,
        title: 'Reserva cancelada',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido cancelada.`,
        dateLabel: 'Cita cancelada',
        locationLabel: 'Ubicación',
        cta: 'Reservar de nuevo',
        footer: '¡Lo sentimos! Puedes reservar una nueva cita cuando quieras.',
      },
      reschedule: {
        subject: `Cita reprogramada — ${p.service}`,
        title: 'Cita reprogramada 🗓️',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong> ha sido reprogramada.`,
        dateLabel: 'Nueva cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mis reservas',
        footer: 'Si tienes alguna pregunta, no dudes en contactarnos.',
      },
      new_booking: {
        subject: `Nueva reserva — ${p.service}`,
        title: 'Nueva reserva 📅',
        body: `<strong>${p.clientName ?? 'Un cliente'}</strong> ha reservado <strong>${p.service}</strong>.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver reservas',
        footer: 'Inicia sesión en GigZone para ver los detalles y gestionar tus reservas.',
      },
      client_rescheduled: {
        subject: `Cita reprogramada — ${p.service}`,
        title: 'Cliente reprogramó la cita 🗓️',
        body: `<strong>${p.clientName ?? 'Un cliente'}</strong> ha reprogramado su cita para <strong>${p.service}</strong>.${p.reason ? `<br/><em>Motivo: ${p.reason}</em>` : ''}`,
        dateLabel: 'Nueva cita',
        locationLabel: 'Ubicación',
        cta: 'Ver reservas',
        footer: 'Inicia sesión en GigZone para ver los detalles y gestionar tus reservas.',
      },
      reminder: {
        subject: `Recordatorio — cita mañana: ${p.service}`,
        title: 'Cita mañana ⏰',
        body: `Recordatorio: tienes una cita para <strong>${p.service}</strong> en <strong>${p.business}</strong>.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mis reservas',
        footer: 'Si no puedes asistir, por favor cancela en la aplicación.',
      },
    },
    fr: {
      confirmation: {
        subject: `Réservation confirmée — ${p.service}`,
        title: 'Réservation confirmée ✅',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a bien été créée.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mes réservations',
        footer: 'Pour modifier ou annuler, rendez-vous sur GigZone.',
      },
      cancellation: {
        subject: `Réservation annulée — ${p.service}`,
        title: 'Réservation annulée',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a été annulée.`,
        dateLabel: 'Rendez-vous annulé',
        locationLabel: 'Lieu',
        cta: 'Prendre un nouveau rendez-vous',
        footer: 'Nous sommes désolés ! Vous pouvez réserver à tout moment.',
      },
      reschedule: {
        subject: `Rendez-vous déplacé — ${p.service}`,
        title: 'Rendez-vous déplacé 🗓️',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong> a été déplacée.`,
        dateLabel: 'Nouveau rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mes réservations',
        footer: "Pour toute question, n'hésitez pas à nous contacter.",
      },
      new_booking: {
        subject: `Nouvelle réservation — ${p.service}`,
        title: 'Nouvelle réservation 📅',
        body: `<strong>${p.clientName ?? 'Un client'}</strong> a réservé <strong>${p.service}</strong>.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir les réservations',
        footer: 'Connectez-vous à GigZone pour voir les détails et gérer vos réservations.',
      },
      client_rescheduled: {
        subject: `Rendez-vous déplacé — ${p.service}`,
        title: 'Le client a déplacé le rendez-vous 🗓️',
        body: `<strong>${p.clientName ?? 'Un client'}</strong> a déplacé son rendez-vous pour <strong>${p.service}</strong>.${p.reason ? `<br/><em>Motif : ${p.reason}</em>` : ''}`,
        dateLabel: 'Nouveau rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir les réservations',
        footer: 'Connectez-vous à GigZone pour voir les détails et gérer vos réservations.',
      },
      reminder: {
        subject: `Rappel — rendez-vous demain : ${p.service}`,
        title: 'Rendez-vous demain ⏰',
        body: `Rappel : vous avez un rendez-vous pour <strong>${p.service}</strong> chez <strong>${p.business}</strong>.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mes réservations',
        footer: "Si vous ne pouvez pas venir, veuillez annuler dans l'application.",
      },
    },
  };

  return map[lang][type];
}

function buildHtml(c: ContentResult, firstName: string, dt: string, locationLine?: string): string {
  const locationBlock = locationLine ? `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${c.locationLabel}</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a1a">${locationLine}</p>
        </div>` : '';

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
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:16px">
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${c.dateLabel}</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1a1a1a">${dt}</p>
        </div>
        ${locationBlock}
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
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ ok: true });

    const body = await request.json();
    const type: EmailType = body.type;
    const bookingId: string = body.booking_id;

    if (!type || !bookingId) return NextResponse.json({ ok: true });
    if (!['confirmation', 'cancellation', 'reschedule', 'reminder', 'client_rescheduled'].includes(type)) return NextResponse.json({ ok: true });
    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: booking } = await db
      .from('bookings')
      .select('starts_at, service_name_snapshot, client_id, business_id, location_id, staff_member_id, internal_notes')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking?.client_id) return NextResponse.json({ ok: true });

    // Verify caller is the booking's client or an active staff member of the business
    if (user.id !== booking.client_id) {
      const { data: staffCheck } = await db
        .from('staff_members')
        .select('id')
        .eq('business_id', booking.business_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!staffCheck) return NextResponse.json({ ok: true });
    }

    const [clientRes, bpRes, locRes] = await Promise.all([
      db.from('profiles').select('name, email, country').eq('id', booking.client_id).maybeSingle(),
      db.from('booking_profiles').select('name, owner_id').eq('id', booking.business_id).maybeSingle(),
      db.from('business_locations').select('timezone, name, address, city, country').eq('id', booking.location_id).maybeSingle(),
    ]);

    const clientProfile = clientRes.data;
    const bpData        = bpRes.data;
    if (!clientProfile?.email) return NextResponse.json({ ok: true });

    const tz       = locRes.data?.timezone ?? 'UTC';
    const service  = booking.service_name_snapshot ?? '';
    const business = bpData?.name ?? '';
    const dt       = fmtDt(booking.starts_at, tz, getLang(clientProfile.country));

    // Build a readable location line: "Salon Beograd · Knez Mihailova 5, Beograd"
    const locData = locRes.data;
    const locationLine = locData
      ? [locData.name, [locData.address, locData.city, locData.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
      : undefined;

    // ── Email to client ────────────────────────────────────────────────────────
    const clientLang      = getLang(clientProfile.country);
    const clientFirstName = clientProfile.name?.split(' ')[0] || 'there';
    const clientContent   = content(type, clientLang, { firstName: clientFirstName, service, business, dt });

    await sendEmail({
      to: clientProfile.email,
      subject: clientContent.subject,
      replyTo: 'support@gigzone.app',
      html: buildHtml(clientContent, clientFirstName, dt, locationLine),
    });

    // ── Email to business owner + assigned staff (new booking OR client reschedule) ─
    if (type === 'confirmation' || type === 'reschedule') {
      const clientName = clientProfile.name ?? 'Klijent';

      // owner_id is the actual user UUID (booking_profiles.owner_id),
      // which may differ from booking.business_id for non-primary profiles.
      const ownerId = bpData?.owner_id ?? booking.business_id;

      // Collect unique recipient emails: owner + assigned staff
      const recipientIds = new Set<string>([ownerId]);
      if (booking.staff_member_id) {
        const { data: sm } = await db
          .from('staff_members')
          .select('user_id')
          .eq('id', booking.staff_member_id)
          .maybeSingle();
        if (sm?.user_id && sm.user_id !== ownerId) {
          recipientIds.add(sm.user_id);
        }
      }

      for (const recipientId of recipientIds) {
        const { data: recipientProfile } = await db
          .from('profiles')
          .select('name, email, country')
          .eq('id', recipientId)
          .maybeSingle();
        if (!recipientProfile?.email) continue;

        const rLang      = getLang(recipientProfile.country);
        const rFirstName = recipientProfile.name?.split(' ')[0] || 'there';
        const rDt        = fmtDt(booking.starts_at, tz, rLang);
        const bizEmailType = type === 'reschedule' ? 'client_rescheduled' : 'new_booking';
        const rescheduleReason = type === 'reschedule' && (booking as any).internal_notes?.includes('[Pomjeranje termina]')
          ? (booking as any).internal_notes.replace('[Pomjeranje termina]', '').trim()
          : undefined;
        const rContent   = content(bizEmailType, rLang, { firstName: rFirstName, service, business, dt: rDt, clientName, reason: rescheduleReason });

        await sendEmail({
          to: recipientProfile.email,
          subject: rContent.subject,
          replyTo: 'support@gigzone.app',
          html: buildHtml(rContent, rFirstName, rDt, locationLine),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking/notify]', err);
    return NextResponse.json({ ok: true });
  }
}
