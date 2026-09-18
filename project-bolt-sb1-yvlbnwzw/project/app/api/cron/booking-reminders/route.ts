import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

export const runtime    = 'nodejs';
export const maxDuration = 60;

const BALKAN  = ['Serbia','Srbija','Croatia','Hrvatska','Bosnia and Herzegovina','Bosna i Hercegovina','Montenegro','Crna Gora','Slovenia','Slovenija','North Macedonia','Sjeverna Makedonija'];
const GERMAN  = ['Germany','Deutschland','Austria','Österreich','Switzerland','Schweiz'];
const SPANISH = ['Spain','España','Mexico','México','Argentina','Colombia','Chile','Peru','Perú','Venezuela','Ecuador','Bolivia','Paraguay','Uruguay'];
const FRENCH  = ['France','Belgium','Belgique','Canada','Luxembourg'];

type Lang = 'sr' | 'de' | 'en' | 'es' | 'fr';

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

type ReminderEmail = {
  subject: string; title: string; body: string; cta: string; footer: string;
};

function reminderContent(lang: Lang, service: string, business: string): ReminderEmail {
  const map: Record<Lang, ReminderEmail> = {
    sr: {
      subject: `Podsjetnik — termin sutra: ${service}`,
      title: 'Termin sutra ⏰',
      body: `Podsjećamo te da imaš termin za <strong>${service}</strong> kod <strong>${business}</strong>.`,
      cta: 'Pregledaj rezervacije',
      footer: 'Ako nisi u mogućnosti doći, otkaži termin u aplikaciji.',
    },
    en: {
      subject: `Reminder — appointment tomorrow: ${service}`,
      title: 'Appointment tomorrow ⏰',
      body: `This is a reminder that you have an appointment for <strong>${service}</strong> at <strong>${business}</strong>.`,
      cta: 'View bookings',
      footer: "If you can't make it, please cancel in the app.",
    },
    de: {
      subject: `Erinnerung — Termin morgen: ${service}`,
      title: 'Termin morgen ⏰',
      body: `Erinnerung: Du hast morgen einen Termin für <strong>${service}</strong> bei <strong>${business}</strong>.`,
      cta: 'Buchungen ansehen',
      footer: 'Falls du nicht kommen kannst, storniere bitte in der App.',
    },
    es: {
      subject: `Recordatorio — cita mañana: ${service}`,
      title: 'Cita mañana ⏰',
      body: `Recordatorio: tienes una cita para <strong>${service}</strong> en <strong>${business}</strong>.`,
      cta: 'Ver mis reservas',
      footer: 'Si no puedes asistir, por favor cancela en la aplicación.',
    },
    fr: {
      subject: `Rappel — rendez-vous demain : ${service}`,
      title: 'Rendez-vous demain ⏰',
      body: `Rappel : vous avez un rendez-vous pour <strong>${service}</strong> chez <strong>${business}</strong>.`,
      cta: 'Voir mes réservations',
      footer: "Si vous ne pouvez pas venir, veuillez annuler dans l'application.",
    },
  };
  return map[lang];
}

function buildHtml(c: ReminderEmail, firstName: string, dt: string, locationLine?: string): string {
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
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">Termin / Appointment</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1a1a1a">${dt}</p>
          ${locationLine ? `<p style="margin:8px 0 0;font-size:13px;color:#555">📍 ${locationLine}</p>` : ''}
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
        GigZone · gigzone.app
      </p>
    </div>
  `;
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

  const { data, error } = await supabase.rpc('send_booking_reminders');

  if (error) {
    console.error('send_booking_reminders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('Booking reminders:', data);

  // Send reminder emails if Brevo is configured
  let emailsSent = 0;
  if (process.env.BREVO_API_KEY && data?.bookings?.length) {
    for (const b of data.bookings as Array<{
      booking_id: string;
      starts_at: string;
      service_name: string;
      client_email: string;
      client_name: string;
      client_country: string;
      business_name: string;
      timezone: string;
      location_name: string | null;
      location_address: string | null;
      location_city: string | null;
    }>) {
      if (!b.client_email) continue;
      try {
        const lang         = getLang(b.client_country);
        const firstName    = b.client_name?.split(' ')[0] || 'there';
        const dt           = fmtDt(b.starts_at, b.timezone, lang);
        const c            = reminderContent(lang, b.service_name ?? '', b.business_name ?? '');
        const locationLine = [b.location_name, [b.location_address, b.location_city].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || undefined;
        await sendEmail({
          to: b.client_email,
          subject: c.subject,
          replyTo: 'support@gigzone.app',
          html: buildHtml(c, firstName, dt, locationLine),
        });
        emailsSent++;
      } catch (emailErr) {
        console.error('[booking-reminders] email error for', b.booking_id, emailErr);
      }
    }
  }

  return NextResponse.json({ ...data, emails_sent: emailsSent });
}
