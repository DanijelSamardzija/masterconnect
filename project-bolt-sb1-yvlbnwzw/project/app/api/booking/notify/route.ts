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
// new_booking     = business notification when client self-books
// staff_assigned  = staff notification when owner assigns a booking to them
// reminder        = client reminder email (called from cron)
type EmailType = 'confirmation' | 'cancellation' | 'reschedule' | 'new_booking' | 'staff_assigned' | 'staff_added_booking' | 'owner_cancelled_staff' | 'reminder' | 'client_rescheduled' | 'client_cancelled';

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

type ContentParams = { firstName: string; service: string; business: string; dt: string; clientName?: string; reason?: string; staffName?: string };
type ContentResult = { subject: string; title: string; body: string; dateLabel: string; locationLabel: string; cta: string; footer: string };

function content(type: EmailType, lang: Lang, p: ContentParams): ContentResult {
  const map: Record<Lang, Record<EmailType, ContentResult>> = {
    sr: {
      confirmation: {
        subject: `Rezervacija potvrđena — ${p.service}`,
        title: 'Rezervacija kreirana ✅',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong>${p.staffName ? ` sa radnikom <strong>${p.staffName}</strong>` : ''} je uspješno kreirana.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termin',
        footer: 'Za izmjene ili otkazivanje, klikni na dugme iznad.',
      },
      cancellation: {
        subject: `Rezervacija otkazana — ${p.service}`,
        title: 'Rezervacija otkazana',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong>${p.staffName ? `, radnik: <strong>${p.staffName}</strong>,` : ''} je otkazana.${p.reason ? `<br/><em>Napomena: ${p.reason}</em>` : ''}`,
        dateLabel: 'Otkazani termin',
        locationLabel: 'Lokacija',
        cta: 'Zakaži novi termin',
        footer: 'Žao nam je! Slobodno zakaži novi termin kada ti odgovara.',
      },
      owner_cancelled_staff: {
        subject: `Vlasnik otkazao termin — ${p.service}`,
        title: 'Vlasnik je otkazao vaš termin',
        body: `<strong>${p.business}</strong> je otkazao/la vaš termin za <strong>${p.service}</strong>${p.clientName ? `. Klijent: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Otkazani termin',
        locationLabel: 'Lokacija',
        cta: 'Otvori raspored',
        footer: 'Za pitanja kontaktirajte vlasnika.',
      },
      reschedule: {
        subject: `Termin premješten — ${p.service}`,
        title: 'Termin premješten 🗓️',
        body: `Tvoja rezervacija za <strong>${p.service}</strong> kod <strong>${p.business}</strong>${p.staffName ? ` sa radnikom <strong>${p.staffName}</strong>` : ''} je premještena.`,
        dateLabel: 'Novi termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termin',
        footer: 'Ako imaš pitanja, slobodno nas kontaktuj.',
      },
      new_booking: {
        subject: `Nova rezervacija — ${p.service}`,
        title: 'Nova rezervacija 📅',
        body: `<strong>${p.clientName ?? 'Klijent'}</strong> je zakazao/la termin za <strong>${p.service}</strong>${p.staffName ? ` · radnik: <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termine',
        footer: 'Prijavite se na GigZone da vidite detalje i upravljate rezervacijama.',
      },
      client_rescheduled: {
        subject: `Termin premješten — ${p.service}`,
        title: 'Klijent premjestio/la termin 🗓️',
        body: `<strong>${p.clientName ?? 'Klijent'}</strong> je premjestio/la termin za <strong>${p.service}</strong>${p.staffName ? ` · radnik: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Razlog: ${p.reason}</em>` : ''}`,
        dateLabel: 'Novi termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termine',
        footer: 'Prijavite se na GigZone da vidite detalje i upravljate rezervacijama.',
      },
      reminder: {
        subject: `Podsjetnik — termin sutra: ${p.service}`,
        title: 'Termin sutra ⏰',
        body: `Podsjećamo te da imaš termin za <strong>${p.service}</strong> kod <strong>${p.business}</strong>${p.staffName ? ` sa radnikom <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj termin',
        footer: 'Ako nisi u mogućnosti doći, možeš otkazati putem linka iznad.',
      },
      staff_assigned: {
        subject: `Novi termin od vlasnika — ${p.service}`,
        title: 'Vlasnik vam je zakazao termin 📋',
        body: `<strong>${p.business}</strong> vam je zakazao termin za <strong>${p.service}</strong>${p.clientName ? `. Klijent: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Otvori raspored',
        footer: 'Prijavite se na GigZone da vidite detalje termina.',
      },
      client_cancelled: {
        subject: `Otkazivanje termina — ${p.service}`,
        title: 'Klijent otkazao/la termin',
        body: `<strong>${p.clientName ?? 'Klijent'}</strong> je otkazao/la termin za <strong>${p.service}</strong>${p.staffName ? ` · radnik: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Napomena: ${p.reason}</em>` : ''}`,
        dateLabel: 'Otkazani termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj kalendar',
        footer: 'Termin je slobodan i može se ponovo zakazati.',
      },
      staff_added_booking: {
        subject: `Radnik je zakazao termin — ${p.service}`,
        title: `${p.staffName ?? 'Radnik'} je zakazao termin`,
        body: `<strong>${p.staffName ?? 'Radnik'}</strong> je zakazao termin za <strong>${p.service}</strong>${p.clientName ? `. Klijent: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Lokacija',
        cta: 'Pregledaj kalendar',
        footer: 'Prijavite se na GigZone da vidite detalje i upravljate rezervacijama.',
      },
    },
    en: {
      confirmation: {
        subject: `Booking confirmed — ${p.service}`,
        title: 'Booking confirmed ✅',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong>${p.staffName ? ` with <strong>${p.staffName}</strong>` : ''} has been created.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View appointment',
        footer: 'To change or cancel, use the button above.',
      },
      cancellation: {
        subject: `Booking cancelled — ${p.service}`,
        title: 'Booking cancelled',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong>${p.staffName ? `, staff: <strong>${p.staffName}</strong>,` : ''} has been cancelled.${p.reason ? `<br/><em>Note: ${p.reason}</em>` : ''}`,
        dateLabel: 'Cancelled appointment',
        locationLabel: 'Location',
        cta: 'Book again',
        footer: "We're sorry! Feel free to book a new appointment at any time.",
      },
      owner_cancelled_staff: {
        subject: `Owner cancelled your appointment — ${p.service}`,
        title: 'Owner cancelled your appointment',
        body: `<strong>${p.business}</strong> has cancelled your appointment for <strong>${p.service}</strong>${p.clientName ? `. Client: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Cancelled appointment',
        locationLabel: 'Location',
        cta: 'View schedule',
        footer: 'If you have any questions, contact the owner.',
      },
      reschedule: {
        subject: `Appointment rescheduled — ${p.service}`,
        title: 'Appointment rescheduled 🗓️',
        body: `Your booking for <strong>${p.service}</strong> at <strong>${p.business}</strong>${p.staffName ? ` with <strong>${p.staffName}</strong>` : ''} has been moved.`,
        dateLabel: 'New appointment',
        locationLabel: 'Location',
        cta: 'View appointment',
        footer: 'If you have any questions, feel free to contact us.',
      },
      new_booking: {
        subject: `New booking — ${p.service}`,
        title: 'New booking 📅',
        body: `<strong>${p.clientName ?? 'A client'}</strong> has booked <strong>${p.service}</strong>${p.staffName ? ` · staff: <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'Log in to GigZone to view details and manage your bookings.',
      },
      client_rescheduled: {
        subject: `Appointment rescheduled — ${p.service}`,
        title: 'Client rescheduled 🗓️',
        body: `<strong>${p.clientName ?? 'A client'}</strong> rescheduled their appointment for <strong>${p.service}</strong>${p.staffName ? ` · staff: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Reason: ${p.reason}</em>` : ''}`,
        dateLabel: 'New appointment',
        locationLabel: 'Location',
        cta: 'View bookings',
        footer: 'Log in to GigZone to view details and manage your bookings.',
      },
      reminder: {
        subject: `Reminder — appointment tomorrow: ${p.service}`,
        title: 'Appointment tomorrow ⏰',
        body: `This is a reminder that you have an appointment for <strong>${p.service}</strong> at <strong>${p.business}</strong>${p.staffName ? ` with <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View appointment',
        footer: "If you can't make it, use the button above to cancel.",
      },
      staff_assigned: {
        subject: `New appointment from owner — ${p.service}`,
        title: 'Owner scheduled an appointment for you 📋',
        body: `<strong>${p.business}</strong> has scheduled an appointment for you: <strong>${p.service}</strong>${p.clientName ? `. Client: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View schedule',
        footer: 'Log in to GigZone to see appointment details.',
      },
      client_cancelled: {
        subject: `Booking cancelled by client — ${p.service}`,
        title: 'Client cancelled booking',
        body: `<strong>${p.clientName ?? 'A client'}</strong> has cancelled their booking for <strong>${p.service}</strong>${p.staffName ? ` · staff: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Note: ${p.reason}</em>` : ''}`,
        dateLabel: 'Cancelled appointment',
        locationLabel: 'Location',
        cta: 'View calendar',
        footer: 'The slot is now free and can be rebooked.',
      },
      staff_added_booking: {
        subject: `Staff added a booking — ${p.service}`,
        title: `${p.staffName ?? 'Staff'} added a booking`,
        body: `<strong>${p.staffName ?? 'A staff member'}</strong> added a booking for <strong>${p.service}</strong>${p.clientName ? `. Client: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Appointment',
        locationLabel: 'Location',
        cta: 'View calendar',
        footer: 'Log in to GigZone to view details and manage your bookings.',
      },
    },
    de: {
      confirmation: {
        subject: `Buchung bestätigt — ${p.service}`,
        title: 'Buchung bestätigt ✅',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong>${p.staffName ? ` mit <strong>${p.staffName}</strong>` : ''} wurde erfolgreich erstellt.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Termin ansehen',
        footer: 'Zum Ändern oder Stornieren, nutze den Button oben.',
      },
      cancellation: {
        subject: `Buchung storniert — ${p.service}`,
        title: 'Buchung storniert',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong>${p.staffName ? `, Mitarbeiter: <strong>${p.staffName}</strong>,` : ''} wurde storniert.${p.reason ? `<br/><em>Hinweis: ${p.reason}</em>` : ''}`,
        dateLabel: 'Stornierter Termin',
        locationLabel: 'Standort',
        cta: 'Neu buchen',
        footer: 'Es tut uns leid! Du kannst jederzeit einen neuen Termin buchen.',
      },
      owner_cancelled_staff: {
        subject: `Inhaber hat Termin storniert — ${p.service}`,
        title: 'Inhaber hat Ihren Termin storniert',
        body: `<strong>${p.business}</strong> hat Ihren Termin für <strong>${p.service}</strong>${p.clientName ? ` storniert. Kunde: <strong>${p.clientName}</strong>` : ' storniert'}.`,
        dateLabel: 'Stornierter Termin',
        locationLabel: 'Standort',
        cta: 'Kalender ansehen',
        footer: 'Bei Fragen wenden Sie sich bitte an den Inhaber.',
      },
      reschedule: {
        subject: `Termin verschoben — ${p.service}`,
        title: 'Termin verschoben 🗓️',
        body: `Deine Buchung für <strong>${p.service}</strong> bei <strong>${p.business}</strong>${p.staffName ? ` mit <strong>${p.staffName}</strong>` : ''} wurde verschoben.`,
        dateLabel: 'Neuer Termin',
        locationLabel: 'Standort',
        cta: 'Termin ansehen',
        footer: 'Bei Fragen stehen wir gerne zur Verfügung.',
      },
      new_booking: {
        subject: `Neue Buchung — ${p.service}`,
        title: 'Neue Buchung 📅',
        body: `<strong>${p.clientName ?? 'Ein Kunde'}</strong> hat einen Termin für <strong>${p.service}</strong>${p.staffName ? ` · Mitarbeiter: <strong>${p.staffName}</strong>` : ''} gebucht.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Melde dich bei GigZone an, um Details zu sehen und Buchungen zu verwalten.',
      },
      client_rescheduled: {
        subject: `Termin verschoben — ${p.service}`,
        title: 'Kunde hat Termin verschoben 🗓️',
        body: `<strong>${p.clientName ?? 'Ein Kunde'}</strong> hat den Termin für <strong>${p.service}</strong>${p.staffName ? ` · Mitarbeiter: <strong>${p.staffName}</strong>` : ''} verschoben.${p.reason ? `<br/><em>Grund: ${p.reason}</em>` : ''}`,
        dateLabel: 'Neuer Termin',
        locationLabel: 'Standort',
        cta: 'Buchungen ansehen',
        footer: 'Melde dich bei GigZone an, um Details zu sehen und Buchungen zu verwalten.',
      },
      reminder: {
        subject: `Erinnerung — Termin morgen: ${p.service}`,
        title: 'Termin morgen ⏰',
        body: `Erinnerung: Du hast morgen einen Termin für <strong>${p.service}</strong> bei <strong>${p.business}</strong>${p.staffName ? ` mit <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Termin ansehen',
        footer: 'Falls du nicht kommen kannst, nutze den Button oben zum Stornieren.',
      },
      client_cancelled: {
        subject: `Stornierung durch Kunden — ${p.service}`,
        title: 'Kunde hat storniert',
        body: `<strong>${p.clientName ?? 'Ein Kunde'}</strong> hat die Buchung für <strong>${p.service}</strong>${p.staffName ? ` · Mitarbeiter: <strong>${p.staffName}</strong>` : ''} storniert.${p.reason ? `<br/><em>Hinweis: ${p.reason}</em>` : ''}`,
        dateLabel: 'Stornierter Termin',
        locationLabel: 'Standort',
        cta: 'Kalender ansehen',
        footer: 'Der Termin ist frei und kann neu gebucht werden.',
      },
      staff_added_booking: {
        subject: `Mitarbeiter hat einen Termin gebucht — ${p.service}`,
        title: `${p.staffName ?? 'Mitarbeiter'} hat einen Termin gebucht`,
        body: `<strong>${p.staffName ?? 'Ein Mitarbeiter'}</strong> hat einen Termin für <strong>${p.service}</strong>${p.clientName ? ` gebucht. Kunde: <strong>${p.clientName}</strong>` : ' gebucht'}.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Kalender ansehen',
        footer: 'Melde dich bei GigZone an, um Details zu sehen und Buchungen zu verwalten.',
      },
      staff_assigned: {
        subject: `Neuer Termin vom Inhaber — ${p.service}`,
        title: 'Inhaber hat einen Termin für Sie gebucht 📋',
        body: `<strong>${p.business}</strong> hat einen Termin für Sie gebucht: <strong>${p.service}</strong>${p.clientName ? `. Kunde: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Termin',
        locationLabel: 'Standort',
        cta: 'Kalender ansehen',
        footer: 'Melde dich bei GigZone an, um die Termindetails zu sehen.',
      },
    },
    es: {
      confirmation: {
        subject: `Reserva confirmada — ${p.service}`,
        title: 'Reserva confirmada ✅',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong>${p.staffName ? ` con <strong>${p.staffName}</strong>` : ''} ha sido creada con éxito.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mi cita',
        footer: 'Para cambiar o cancelar, usa el botón de arriba.',
      },
      cancellation: {
        subject: `Reserva cancelada — ${p.service}`,
        title: 'Reserva cancelada',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong>${p.staffName ? `, empleado: <strong>${p.staffName}</strong>,` : ''} ha sido cancelada.${p.reason ? `<br/><em>Nota: ${p.reason}</em>` : ''}`,
        dateLabel: 'Cita cancelada',
        locationLabel: 'Ubicación',
        cta: 'Reservar de nuevo',
        footer: '¡Lo sentimos! Puedes reservar una nueva cita cuando quieras.',
      },
      owner_cancelled_staff: {
        subject: `El propietario canceló tu cita — ${p.service}`,
        title: 'El propietario canceló tu cita',
        body: `<strong>${p.business}</strong> ha cancelado tu cita para <strong>${p.service}</strong>${p.clientName ? `. Cliente: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Cita cancelada',
        locationLabel: 'Ubicación',
        cta: 'Ver agenda',
        footer: 'Si tienes alguna pregunta, contacta al propietario.',
      },
      reschedule: {
        subject: `Cita reprogramada — ${p.service}`,
        title: 'Cita reprogramada 🗓️',
        body: `Tu reserva para <strong>${p.service}</strong> en <strong>${p.business}</strong>${p.staffName ? ` con <strong>${p.staffName}</strong>` : ''} ha sido reprogramada.`,
        dateLabel: 'Nueva cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mi cita',
        footer: 'Si tienes alguna pregunta, no dudes en contactarnos.',
      },
      new_booking: {
        subject: `Nueva reserva — ${p.service}`,
        title: 'Nueva reserva 📅',
        body: `<strong>${p.clientName ?? 'Un cliente'}</strong> ha reservado <strong>${p.service}</strong>${p.staffName ? ` · empleado: <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver reservas',
        footer: 'Inicia sesión en GigZone para ver los detalles y gestionar tus reservas.',
      },
      client_rescheduled: {
        subject: `Cita reprogramada — ${p.service}`,
        title: 'Cliente reprogramó la cita 🗓️',
        body: `<strong>${p.clientName ?? 'Un cliente'}</strong> ha reprogramado su cita para <strong>${p.service}</strong>${p.staffName ? ` · empleado: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Motivo: ${p.reason}</em>` : ''}`,
        dateLabel: 'Nueva cita',
        locationLabel: 'Ubicación',
        cta: 'Ver reservas',
        footer: 'Inicia sesión en GigZone para ver los detalles y gestionar tus reservas.',
      },
      reminder: {
        subject: `Recordatorio — cita mañana: ${p.service}`,
        title: 'Cita mañana ⏰',
        body: `Recordatorio: tienes una cita para <strong>${p.service}</strong> en <strong>${p.business}</strong>${p.staffName ? ` con <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver mi cita',
        footer: 'Si no puedes asistir, usa el botón de arriba para cancelar.',
      },
      staff_assigned: {
        subject: `Nueva cita del propietario — ${p.service}`,
        title: 'El propietario agendó una cita para ti 📋',
        body: `<strong>${p.business}</strong> ha agendado una cita para ti: <strong>${p.service}</strong>${p.clientName ? `. Cliente: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver agenda',
        footer: 'Inicia sesión en GigZone para ver los detalles de la cita.',
      },
      client_cancelled: {
        subject: `Cancelación por el cliente — ${p.service}`,
        title: 'El cliente canceló',
        body: `<strong>${p.clientName ?? 'Un cliente'}</strong> ha cancelado su reserva para <strong>${p.service}</strong>${p.staffName ? ` · empleado: <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Nota: ${p.reason}</em>` : ''}`,
        dateLabel: 'Cita cancelada',
        locationLabel: 'Ubicación',
        cta: 'Ver calendario',
        footer: 'El horario está disponible y puede volver a reservarse.',
      },
      staff_added_booking: {
        subject: `El empleado agendó una cita — ${p.service}`,
        title: `${p.staffName ?? 'El empleado'} agendó una cita`,
        body: `<strong>${p.staffName ?? 'Un empleado'}</strong> agendó una cita para <strong>${p.service}</strong>${p.clientName ? `. Cliente: <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Cita',
        locationLabel: 'Ubicación',
        cta: 'Ver calendario',
        footer: 'Inicia sesión en GigZone para ver los detalles y gestionar tus reservas.',
      },
    },
    fr: {
      confirmation: {
        subject: `Réservation confirmée — ${p.service}`,
        title: 'Réservation confirmée ✅',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong>${p.staffName ? ` avec <strong>${p.staffName}</strong>` : ''} a bien été créée.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mon rendez-vous',
        footer: 'Pour modifier ou annuler, utilisez le bouton ci-dessus.',
      },
      cancellation: {
        subject: `Réservation annulée — ${p.service}`,
        title: 'Réservation annulée',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong>${p.staffName ? `, employé : <strong>${p.staffName}</strong>,` : ''} a été annulée.${p.reason ? `<br/><em>Note : ${p.reason}</em>` : ''}`,
        dateLabel: 'Rendez-vous annulé',
        locationLabel: 'Lieu',
        cta: 'Prendre un nouveau rendez-vous',
        footer: 'Nous sommes désolés ! Vous pouvez réserver à tout moment.',
      },
      owner_cancelled_staff: {
        subject: `Le propriétaire a annulé votre rendez-vous — ${p.service}`,
        title: 'Le propriétaire a annulé votre rendez-vous',
        body: `<strong>${p.business}</strong> a annulé votre rendez-vous pour <strong>${p.service}</strong>${p.clientName ? `. Client : <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Rendez-vous annulé',
        locationLabel: 'Lieu',
        cta: 'Voir le planning',
        footer: 'Pour toute question, contactez le propriétaire.',
      },
      reschedule: {
        subject: `Rendez-vous déplacé — ${p.service}`,
        title: 'Rendez-vous déplacé 🗓️',
        body: `Votre réservation pour <strong>${p.service}</strong> chez <strong>${p.business}</strong>${p.staffName ? ` avec <strong>${p.staffName}</strong>` : ''} a été déplacée.`,
        dateLabel: 'Nouveau rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mon rendez-vous',
        footer: "Pour toute question, n'hésitez pas à nous contacter.",
      },
      new_booking: {
        subject: `Nouvelle réservation — ${p.service}`,
        title: 'Nouvelle réservation 📅',
        body: `<strong>${p.clientName ?? 'Un client'}</strong> a réservé <strong>${p.service}</strong>${p.staffName ? ` · employé : <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir les réservations',
        footer: 'Connectez-vous à GigZone pour voir les détails et gérer vos réservations.',
      },
      client_rescheduled: {
        subject: `Rendez-vous déplacé — ${p.service}`,
        title: 'Le client a déplacé le rendez-vous 🗓️',
        body: `<strong>${p.clientName ?? 'Un client'}</strong> a déplacé son rendez-vous pour <strong>${p.service}</strong>${p.staffName ? ` · employé : <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Motif : ${p.reason}</em>` : ''}`,
        dateLabel: 'Nouveau rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir les réservations',
        footer: 'Connectez-vous à GigZone pour voir les détails et gérer vos réservations.',
      },
      reminder: {
        subject: `Rappel — rendez-vous demain : ${p.service}`,
        title: 'Rendez-vous demain ⏰',
        body: `Rappel : vous avez un rendez-vous pour <strong>${p.service}</strong> chez <strong>${p.business}</strong>${p.staffName ? ` avec <strong>${p.staffName}</strong>` : ''}.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir mon rendez-vous',
        footer: "Si vous ne pouvez pas venir, utilisez le bouton ci-dessus pour annuler.",
      },
      staff_assigned: {
        subject: `Nouveau rendez-vous du propriétaire — ${p.service}`,
        title: 'Le propriétaire a planifié un rdv pour vous 📋',
        body: `<strong>${p.business}</strong> a planifié un rendez-vous pour vous : <strong>${p.service}</strong>${p.clientName ? `. Client : <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir le planning',
        footer: 'Connectez-vous à GigZone pour voir les détails du rendez-vous.',
      },
      client_cancelled: {
        subject: `Annulation par le client — ${p.service}`,
        title: 'Le client a annulé',
        body: `<strong>${p.clientName ?? 'Un client'}</strong> a annulé sa réservation pour <strong>${p.service}</strong>${p.staffName ? ` · employé : <strong>${p.staffName}</strong>` : ''}.${p.reason ? `<br/><em>Note : ${p.reason}</em>` : ''}`,
        dateLabel: 'Rendez-vous annulé',
        locationLabel: 'Lieu',
        cta: 'Voir le calendrier',
        footer: 'Le créneau est libre et peut être réservé à nouveau.',
      },
      staff_added_booking: {
        subject: `L'employé a planifié un rendez-vous — ${p.service}`,
        title: `${p.staffName ?? "L'employé"} a planifié un rendez-vous`,
        body: `<strong>${p.staffName ?? 'Un employé'}</strong> a planifié un rendez-vous pour <strong>${p.service}</strong>${p.clientName ? `. Client : <strong>${p.clientName}</strong>` : ''}.`,
        dateLabel: 'Rendez-vous',
        locationLabel: 'Lieu',
        cta: 'Voir le calendrier',
        footer: 'Connectez-vous à GigZone pour voir les détails et gérer vos réservations.',
      },
    },
  };

  return map[lang][type];
}

function buildHtml(
  c: ContentResult,
  firstName: string,
  dt: string,
  locationLine?: string,
  ctaUrl?: string,
): string {
  const link = ctaUrl ?? 'https://gigzone.app/booking/my';
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
          <a href="${link}"
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
        GigZone · gigzone.app · <a href="${link}" style="color:#aaa">${c.cta}</a>
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
    if (!['confirmation', 'cancellation', 'reschedule', 'reminder', 'client_rescheduled', 'staff_assigned', 'staff_added_booking', 'owner_cancelled_staff'].includes(type)) return NextResponse.json({ ok: true });
    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: booking } = await db
      .from('bookings')
      .select('starts_at, service_name_snapshot, client_id, business_id, location_id, staff_member_id, internal_notes, guest_email, guest_name, guest_access_token, cancellation_reason')
      .eq('id', bookingId)
      .maybeSingle();

    if (!booking) return NextResponse.json({ ok: true });

    // ── Authorization ──────────────────────────────────────────────────────────
    // For guest bookings (no client_id): only business staff/owner can trigger.
    // For registered client bookings: client OR staff/owner can trigger.
    if (!booking.client_id) {
      const { data: staffCheck } = await db
        .from('staff_members')
        .select('id')
        .eq('business_id', booking.business_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!staffCheck) return NextResponse.json({ ok: true });
    } else if (user.id !== booking.client_id) {
      const { data: staffCheck } = await db
        .from('staff_members')
        .select('id')
        .eq('business_id', booking.business_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!staffCheck) return NextResponse.json({ ok: true });
    }

    // ── Resolve recipient ──────────────────────────────────────────────────────
    // Email destination is ALWAYS read from DB — never from request body.
    let recipientEmail: string | null = null;
    let recipientName:  string | null = null;
    let recipientCountry: string | null = null;
    let ctaUrl = 'https://gigzone.app/booking/my';
    let isGuest = false;

    const [bpRes, locRes] = await Promise.all([
      db.from('booking_profiles').select('name, owner_id').eq('id', booking.business_id).maybeSingle(),
      db.from('business_locations').select('timezone, name, address, city, country').eq('id', booking.location_id).maybeSingle(),
    ]);

    if (booking.client_id) {
      const { data: clientProfile } = await db
        .from('profiles')
        .select('name, email, country')
        .eq('id', booking.client_id)
        .maybeSingle();
      recipientEmail   = clientProfile?.email ?? null;
      recipientName    = clientProfile?.name  ?? null;
      recipientCountry = clientProfile?.country ?? null;
    } else {
      // Guest booking — email from bookings.guest_email only, never from request body
      recipientEmail   = booking.guest_email   ?? null;
      recipientName    = booking.guest_name    ?? null;
      recipientCountry = locRes.data?.country  ?? null; // use business location country for lang detection
      isGuest          = true;
      if (booking.guest_access_token) {
        ctaUrl = `https://gigzone.app/booking/view?token=${booking.guest_access_token}`;
      }
    }

    // Common variables used by all branches below
    const tz          = locRes.data?.timezone ?? 'UTC';
    const service     = booking.service_name_snapshot ?? '';
    const business    = bpRes.data?.name ?? '';
    const ownerId     = bpRes.data?.owner_id ?? null;
    const locData     = locRes.data;
    const locationLine = locData
      ? [locData.name, [locData.address, locData.city, locData.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
      : undefined;

    // ── staff_assigned: internal notification to staff, no client email ────────
    // Called after owner assigns (new booking) or reassigns (existing booking).
    if (type === 'staff_assigned') {
      if (!ownerId || user.id !== ownerId || !booking.staff_member_id) {
        return NextResponse.json({ ok: true });
      }
      const { data: sm } = await db
        .from('staff_members').select('user_id')
        .eq('id', booking.staff_member_id).maybeSingle();
      if (!sm?.user_id || sm.user_id === user.id) return NextResponse.json({ ok: true });
      const { data: sp } = await db
        .from('profiles').select('name, email, country')
        .eq('id', sm.user_id).maybeSingle();
      if (!sp?.email) return NextResponse.json({ ok: true });
      const clientName = recipientName ?? (isGuest ? 'Gost' : 'Klijent');
      const rLang      = getLang(sp.country);
      const rFirstName = sp.name?.split(' ')[0] || 'there';
      const rDt        = fmtDt(booking.starts_at, tz, rLang);
      const rContent   = content('staff_assigned', rLang, { firstName: rFirstName, service, business, dt: rDt, clientName });
      await sendEmail({
        to: sp.email,
        subject: rContent.subject,
        replyTo: 'support@gigzone.app',
        html: buildHtml(rContent, rFirstName, rDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
      });
      return NextResponse.json({ ok: true });
    }

    // ── staff_added_booking: staff manually created a booking → notify owner ─────
    // Called from staff new-booking page after successful staff_create_booking RPC.
    if (type === 'staff_added_booking') {
      if (!ownerId) return NextResponse.json({ ok: true });
      // Verify caller is a non-owner staff member of this business
      const { data: smCheck } = await db
        .from('staff_members').select('id, user_id')
        .eq('business_id', booking.business_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!smCheck || user.id === ownerId) return NextResponse.json({ ok: true });

      const { data: staffProfile } = await db
        .from('profiles').select('name')
        .eq('id', user.id).maybeSingle();
      const staffName = staffProfile?.name ?? undefined;
      const clientName = recipientName ?? (booking.guest_name ?? undefined);

      const { data: op } = await db
        .from('profiles').select('name, email, country, notification_prefs')
        .eq('id', ownerId).maybeSingle();
      if (!op?.email) return NextResponse.json({ ok: true });

      const prefs = (op.notification_prefs as Record<string, unknown>) || {};
      if (prefs.notify_staff_added_booking_email === false) return NextResponse.json({ ok: true });

      const oLang      = getLang(op.country);
      const oFirstName = op.name?.split(' ')[0] || 'there';
      const oDt        = fmtDt(booking.starts_at, tz, oLang);
      const oContent   = content('staff_added_booking', oLang, { firstName: oFirstName, service, business, dt: oDt, staffName, clientName });
      await sendEmail({
        to: op.email,
        subject: oContent.subject,
        replyTo: 'support@gigzone.app',
        html: buildHtml(oContent, oFirstName, oDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Client cancelled → notify owner + assigned staff (no client email) ────
    // The client already knows they cancelled; send client_cancelled email to biz.
    if (type === 'cancellation' && booking.client_id && user.id === booking.client_id) {
      const clientName = recipientName ?? 'Klijent';

      // Fetch assigned staff once
      let smUserId: string | undefined;
      let cancelStaffName: string | undefined;
      if (booking.staff_member_id) {
        const { data: smData } = await db
          .from('staff_members').select('user_id')
          .eq('id', booking.staff_member_id).maybeSingle();
        smUserId = smData?.user_id ?? undefined;
        if (smUserId) {
          const { data: spData } = await db
            .from('profiles').select('name')
            .eq('id', smUserId).maybeSingle();
          cancelStaffName = spData?.name ?? undefined;
        }
      }

      const notifyIds = new Set<string>();
      if (ownerId) notifyIds.add(ownerId);
      if (smUserId && smUserId !== ownerId) notifyIds.add(smUserId);

      for (const rid of notifyIds) {
        const { data: rp } = await db
          .from('profiles').select('name, email, country, notification_prefs')
          .eq('id', rid).maybeSingle();
        if (!rp?.email) continue;
        if (rid === ownerId) {
          const prefs = (rp.notification_prefs as Record<string, unknown>) || {};
          if (prefs.notify_cancellation_email === false) continue;
        }
        const rLang      = getLang(rp.country);
        const rFirstName = rp.name?.split(' ')[0] || 'there';
        const rDt        = fmtDt(booking.starts_at, tz, rLang);
        const rContent   = content('client_cancelled', rLang, { firstName: rFirstName, service, business, dt: rDt, clientName, staffName: cancelStaffName, reason: (booking as any).cancellation_reason ?? undefined });
        await sendEmail({
          to: rp.email,
          subject: rContent.subject,
          replyTo: 'support@gigzone.app',
          html: buildHtml(rContent, rFirstName, rDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Client / guest email ───────────────────────────────────────────────────
    if (!recipientEmail) return NextResponse.json({ ok: true });

    // Fetch staff name to include in client email body
    let staffName: string | undefined;
    if (booking.staff_member_id) {
      const { data: smForClient } = await db
        .from('staff_members').select('user_id')
        .eq('id', booking.staff_member_id).maybeSingle();
      if (smForClient?.user_id) {
        const { data: spForClient } = await db
          .from('profiles').select('name')
          .eq('id', smForClient.user_id).maybeSingle();
        staffName = spForClient?.name ?? undefined;
      }
    }

    const dt             = fmtDt(booking.starts_at, tz, getLang(recipientCountry));
    const recipientLang  = getLang(recipientCountry);
    const recipientFirstName = recipientName?.split(' ')[0] || 'there';
    const cancelReason       = (booking as any).cancellation_reason ?? undefined;
    const recipientContent   = content(type, recipientLang, { firstName: recipientFirstName, service, business, dt, staffName, reason: type === 'cancellation' ? cancelReason : undefined });

    await sendEmail({
      to: recipientEmail,
      subject: recipientContent.subject,
      replyTo: 'support@gigzone.app',
      html: buildHtml(recipientContent, recipientFirstName, dt, locationLine, ctaUrl),
    });

    // ── Owner cancelled → also email the assigned staff member ────────────────
    if (type === 'cancellation' && ownerId && user.id === ownerId && booking.staff_member_id) {
      const { data: smCan } = await db
        .from('staff_members').select('user_id')
        .eq('id', booking.staff_member_id).maybeSingle();
      if (smCan?.user_id && smCan.user_id !== ownerId) {
        const { data: spCan } = await db
          .from('profiles').select('name, email, country')
          .eq('id', smCan.user_id).maybeSingle();
        if (spCan?.email) {
          const clientName = recipientName ?? (isGuest ? 'Gost' : undefined);
          const sLang      = getLang(spCan.country);
          const sFirst     = spCan.name?.split(' ')[0] || 'there';
          const sDt        = fmtDt(booking.starts_at, tz, sLang);
          const sCont      = content('owner_cancelled_staff', sLang, { firstName: sFirst, service, business, dt: sDt, clientName });
          await sendEmail({
            to: spCan.email,
            subject: sCont.subject,
            replyTo: 'support@gigzone.app',
            html: buildHtml(sCont, sFirst, sDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
          });
        }
      }
    }

    // ── Business notification (confirmation / reschedule) ─────────────────────
    // Rules:
    //   callerIsClient  → owner + assigned staff get new_booking / client_rescheduled
    //   callerIsOwner   → assigned staff gets staff_assigned (confirmation) or client_rescheduled (reschedule)
    //   callerIsStaff   → no business email (owner sees everything in their panel)
    if (type === 'confirmation' || type === 'reschedule') {
      const clientName    = recipientName ?? (isGuest ? 'Gost' : 'Klijent');
      const callerIsClient = !!booking.client_id && user.id === booking.client_id;
      const callerIsOwner  = !!ownerId && user.id === ownerId;

      if (callerIsClient) {
        // Client self-booked or rescheduled → notify owner + assigned staff
        const bizType   = type === 'reschedule' ? 'client_rescheduled' : 'new_booking';
        const notifyIds = new Set<string>();
        if (ownerId) notifyIds.add(ownerId);
        let isStaffBooking = false;
        if (booking.staff_member_id) {
          const { data: sm } = await db
            .from('staff_members').select('user_id')
            .eq('id', booking.staff_member_id).maybeSingle();
          if (sm?.user_id && sm.user_id !== ownerId) {
            notifyIds.add(sm.user_id);
            isStaffBooking = true;
          }
        }
        for (const rid of notifyIds) {
          const { data: rp } = await db
            .from('profiles').select('name, email, country, notification_prefs')
            .eq('id', rid).maybeSingle();
          if (!rp?.email) continue;
          // Respect owner's per-event email preferences
          if (rid === ownerId) {
            const prefs = (rp.notification_prefs as Record<string, unknown>) || {};
            if (isStaffBooking && prefs.notify_staff_booking_email === false) continue;
            if (!isStaffBooking && prefs.notify_new_booking_email === false) continue;
          }
          const rLang      = getLang(rp.country);
          const rFirstName = rp.name?.split(' ')[0] || 'there';
          const rDt        = fmtDt(booking.starts_at, tz, rLang);
          const rescheduleReason = bizType === 'client_rescheduled' && (booking as any).internal_notes?.includes('[Pomjeranje termina]')
            ? (booking as any).internal_notes.replace('[Pomjeranje termina]', '').trim()
            : undefined;
          const rContent = content(bizType, rLang, { firstName: rFirstName, service, business, dt: rDt, clientName, reason: rescheduleReason, staffName });
          await sendEmail({
            to: rp.email,
            subject: rContent.subject,
            replyTo: 'support@gigzone.app',
            html: buildHtml(rContent, rFirstName, rDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
          });
        }
      } else if (callerIsOwner && booking.staff_member_id) {
        // Owner created/rescheduled → assigned staff notified
        // confirmation → staff_assigned; reschedule → client_rescheduled (time changed)
        const bizType = type === 'confirmation' ? 'staff_assigned' : 'client_rescheduled';
        const { data: sm } = await db
          .from('staff_members').select('user_id')
          .eq('id', booking.staff_member_id).maybeSingle();
        if (sm?.user_id && sm.user_id !== user.id) {
          const { data: rp } = await db
            .from('profiles').select('name, email, country')
            .eq('id', sm.user_id).maybeSingle();
          if (rp?.email) {
            const rLang      = getLang(rp.country);
            const rFirstName = rp.name?.split(' ')[0] || 'there';
            const rDt        = fmtDt(booking.starts_at, tz, rLang);
            const rContent   = content(bizType, rLang, { firstName: rFirstName, service, business, dt: rDt, clientName });
            await sendEmail({
              to: rp.email,
              subject: rContent.subject,
              replyTo: 'support@gigzone.app',
              html: buildHtml(rContent, rFirstName, rDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
            });
          }
        }
      } else if (type === 'reschedule' && !callerIsClient && !callerIsOwner) {
        // Staff rescheduled → notify client (bell) + notify owner (bell + email per prefs)
        const clientName = recipientName ?? (isGuest ? 'Gost' : 'Klijent');
        const { data: staffProfile } = await db.from('profiles').select('name').eq('id', user.id).maybeSingle();
        const staffRName = staffProfile?.name ?? 'Radnik';
        const reschedDt  = fmtDt(booking.starts_at, tz, 'sr');

        // Bell for registered client
        if (booking.client_id) {
          await db.from('notifications').insert({
            user_id:     booking.client_id,
            type:        'booking',
            action_type: 'booking_rescheduled',
            title:       'Termin premješten',
            body:        `${business} je premjestio/la tvoj termin za ${service} · ${reschedDt}`,
            meta:        { booking_id: bookingId, business_name: business, service_name: service, starts_at: booking.starts_at, skip_push_email: true },
          });
        }

        // Owner bell + email
        if (ownerId) {
          const { data: ownerP } = await db
            .from('profiles').select('name, email, country, notification_prefs')
            .eq('id', ownerId).maybeSingle();
          if (ownerP) {
            const ownerPrefs = (ownerP.notification_prefs as Record<string, unknown>) || {};

            if (ownerPrefs.notify_reschedule !== false) {
              await db.from('notifications').insert({
                user_id:     ownerId,
                type:        'booking',
                action_type: 'booking_rescheduled',
                title:       `${staffRName} je premjestio/la termin`,
                body:        `${service} · ${reschedDt}${clientName ? ' · ' + clientName : ''}`,
                meta:        { booking_id: bookingId, business_name: business, service_name: service, starts_at: booking.starts_at },
              });
            }

            if (ownerPrefs.notify_reschedule_email !== false && ownerP.email) {
              const oLang      = getLang(ownerP.country);
              const oFirst     = ownerP.name?.split(' ')[0] || 'there';
              const oDt        = fmtDt(booking.starts_at, tz, oLang);
              const oCont      = content('client_rescheduled', oLang, { firstName: oFirst, service, business, dt: oDt, clientName, staffName });
              await sendEmail({
                to:      ownerP.email,
                subject: oCont.subject,
                replyTo: 'support@gigzone.app',
                html:    buildHtml(oCont, oFirst, oDt, locationLine, 'https://gigzone.app/booking/business/bookings'),
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[booking/notify]', err);
    return NextResponse.json({ ok: true });
  }
}
