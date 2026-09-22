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

function getLang(country: string | null | undefined): Lang {
  if (BALKAN.includes(country ?? ''))  return 'sr';
  if (GERMAN.includes(country ?? ''))  return 'de';
  if (SPANISH.includes(country ?? '')) return 'es';
  if (FRENCH.includes(country ?? ''))  return 'fr';
  return 'en';
}

type DayEntry = { dayOfWeek: number; open: string | null; close: string | null; closed: boolean };

const DAY_LABELS: Record<Lang, string[]> = {
  sr: ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  de: ['So',  'Mo',  'Di',  'Mi',  'Do',  'Fr',  'Sa'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
};

const CLOSED_LABEL: Record<Lang, string> = {
  sr: 'Zatvoreno', en: 'Closed', de: 'Geschlossen', es: 'Cerrado', fr: 'Fermé',
};

function buildHoursRows(hours: DayEntry[], lang: Lang): string {
  const orderedDows = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
  const map = new Map(hours.map(h => [h.dayOfWeek, h]));
  return orderedDows.map(dow => {
    const label = DAY_LABELS[lang][dow];
    const entry = map.get(dow);
    const value = (!entry || entry.closed || !entry.open || !entry.close)
      ? `<span style="color:#ef4444">${CLOSED_LABEL[lang]}</span>`
      : `<span style="color:#16a34a;font-weight:600">${entry.open}–${entry.close}</span>`;
    return `<tr>
      <td style="padding:5px 12px 5px 0;color:#555;font-size:13px">${label}</td>
      <td style="padding:5px 0;font-size:13px">${value}</td>
    </tr>`;
  }).join('');
}

function buildHoursEmail(params: {
  lang: Lang;
  firstName: string;
  businessName: string;
  locationName: string;
  hours: DayEntry[];
}): { subject: string; html: string } {
  const { lang, firstName, businessName, locationName, hours } = params;

  const L: Record<Lang, { subject: string; title: string; intro: string; tableTitle: string; greeting: string; footer: string; cta: string }> = {
    sr: {
      subject:    'Radno vrijeme promijenjeno',
      title:      'Radno vrijeme promijenjeno 🕐',
      greeting:   'Zdravo',
      intro:      `<strong>${businessName}</strong> je promijenio/la radno vrijeme na lokaciji <strong>${locationName}</strong>.`,
      tableTitle: 'Novo radno vrijeme',
      cta:        'Otvori raspored',
      footer:     'Za pitanja kontaktirajte vlasnika.',
    },
    en: {
      subject:    'Working hours changed',
      title:      'Working hours updated 🕐',
      greeting:   'Hello',
      intro:      `<strong>${businessName}</strong> has updated the working hours at <strong>${locationName}</strong>.`,
      tableTitle: 'New working hours',
      cta:        'View schedule',
      footer:     'Contact the owner if you have questions.',
    },
    de: {
      subject:    'Öffnungszeiten geändert',
      title:      'Öffnungszeiten aktualisiert 🕐',
      greeting:   'Hallo',
      intro:      `<strong>${businessName}</strong> hat die Öffnungszeiten am Standort <strong>${locationName}</strong> aktualisiert.`,
      tableTitle: 'Neue Öffnungszeiten',
      cta:        'Kalender öffnen',
      footer:     'Bei Fragen wenden Sie sich an den Inhaber.',
    },
    es: {
      subject:    'Horario laboral actualizado',
      title:      'Horario actualizado 🕐',
      greeting:   'Hola',
      intro:      `<strong>${businessName}</strong> ha actualizado el horario en <strong>${locationName}</strong>.`,
      tableTitle: 'Nuevo horario laboral',
      cta:        'Ver agenda',
      footer:     'Contacta al propietario si tienes preguntas.',
    },
    fr: {
      subject:    "Horaires d'ouverture modifiés",
      title:      "Horaires mis à jour 🕐",
      greeting:   'Bonjour',
      intro:      `<strong>${businessName}</strong> a mis à jour les horaires du site <strong>${locationName}</strong>.`,
      tableTitle: "Nouveaux horaires",
      cta:        'Voir le planning',
      footer:     "Contactez le propriétaire en cas de questions.",
    },
  };

  const l = L[lang];
  const rows = buildHoursRows(hours, lang);

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <div style="text-align:center;padding:32px 0 16px">
        <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
          Gig<span style="color:#ea580c">Zone</span>
        </span>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
        <h2 style="margin:0 0 8px;font-size:22px">${l.title}</h2>
        <p style="color:#555;margin:0 0 6px">${l.greeting}, <strong>${firstName}</strong></p>
        <p style="color:#555;margin:0 0 20px">${l.intro}</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:20px">
          <p style="margin:0 0 10px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${l.tableTitle}</p>
          <table style="border-collapse:collapse;width:100%">
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="text-align:center;margin-top:24px">
          <a href="https://gigzone.app/dashboard/staff/schedule"
             style="display:inline-block;background:#ea580c;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px">
            ${l.cta}
          </a>
        </div>
        <p style="color:#999;font-size:12px;text-align:center;margin-top:24px;border-top:1px solid #f0f0f0;padding-top:16px">${l.footer}</p>
      </div>
    </div>`;

  return { subject: l.subject, html };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body = await request.json() as {
    locationId: string;
    businessId: string;
    newHours: DayEntry[];
  };
  const { locationId, businessId, newHours } = body;
  if (!locationId || !businessId || !Array.isArray(newHours)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify caller is owner/manager of this business
  const { data: callerSm } = await serviceClient
    .from('staff_members')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .in('role', ['owner', 'manager'])
    .maybeSingle();
  if (!callerSm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Business name + location name
  const { data: bizRow } = await serviceClient
    .from('booking_profiles')
    .select('name')
    .eq('id', businessId)
    .maybeSingle();
  const businessName: string = (bizRow as { name?: string } | null)?.name ?? '';

  const { data: locRow } = await serviceClient
    .from('business_locations')
    .select('name, country')
    .eq('id', locationId)
    .maybeSingle();
  const locationName: string = (locRow as { name?: string; country?: string } | null)?.name ?? '';
  const locationCountry: string | null = (locRow as { name?: string; country?: string } | null)?.country ?? null;

  // Get all active non-owner staff at this location
  const { data: staffList } = await serviceClient
    .from('staff_members')
    .select('id, user_id')
    .eq('business_id', businessId)
    .eq('primary_location_id', locationId)
    .eq('is_active', true)
    .in('role', ['worker', 'manager']);

  if (!Array.isArray(staffList) || staffList.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const userIds = staffList.map((s: { id: string; user_id: string }) => s.user_id);

  // Fetch profiles (name, email, notification_prefs, country) for all staff
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, name, email, notification_prefs, country')
    .in('id', userIds);

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; name: string; email: string | null; notification_prefs: Record<string, unknown> | null; country: string | null }[])
      .map(p => [p.id, p])
  );

  let notified = 0;
  for (const sm of staffList as { id: string; user_id: string }[]) {
    const profile = profileMap.get(sm.user_id);
    if (!profile) continue;

    const lang = getLang(profile.country ?? locationCountry);
    const prefs = profile.notification_prefs ?? {};
    const emailEnabled = prefs.email_enabled !== false;

    // Bell notification
    const bellTitle: Record<Lang, string> = {
      sr: 'Radno vrijeme promijenjeno',
      en: 'Working hours changed',
      de: 'Öffnungszeiten geändert',
      es: 'Horario actualizado',
      fr: 'Horaires modifiés',
    };
    const bellBody: Record<Lang, string> = {
      sr: `${businessName}: radno vrijeme na tvojoj lokaciji je promijenjeno`,
      en: `${businessName}: working hours at your location have been updated`,
      de: `${businessName}: die Öffnungszeiten Ihres Standorts wurden aktualisiert`,
      es: `${businessName}: el horario de tu ubicación ha sido actualizado`,
      fr: `${businessName} : les horaires de votre site ont été mis à jour`,
    };

    await serviceClient.from('notifications').insert({
      user_id:     sm.user_id,
      action_type: 'hours_changed',
      title:       bellTitle[lang],
      body:        bellBody[lang],
      is_read:     false,
    });

    // Email notification
    if (emailEnabled && profile.email) {
      const firstName = profile.name?.split(' ')[0] ?? profile.name ?? '';
      const { subject, html } = buildHoursEmail({
        lang,
        firstName,
        businessName,
        locationName,
        hours: newHours,
      });
      await sendEmail({ to: profile.email, subject, html }).catch(() => {});
    }

    notified++;
  }

  return NextResponse.json({ ok: true, notified });
}
