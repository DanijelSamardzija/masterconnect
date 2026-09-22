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

type ShiftInfo = {
  startTime: string | null;
  endTime: string | null;
  isOff: boolean;
  offReason?: string | null;
  notes?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
};

function fmtDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}.`;
}

function fmtDateLong(dateStr: string, lang: Lang): string {
  const locale: Record<Lang, string> = {
    sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR',
  };
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString(locale[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const OFF_LABELS: Record<string, Record<Lang, string>> = {
  vacation:   { sr: 'Godišnji odmor',  en: 'Vacation',   de: 'Urlaub',       es: 'Vacaciones',    fr: 'Congés'         },
  sick_leave: { sr: 'Bolovanje',        en: 'Sick leave',  de: 'Krankenstand', es: 'Baja laboral',  fr: 'Arrêt maladie'  },
  day_off:    { sr: 'Dan slobodan',     en: 'Day off',     de: 'Freier Tag',   es: 'Día libre',     fr: 'Jour libre'     },
};

function fmtShiftBell(shift: ShiftInfo): string {
  if (shift.isOff) {
    return OFF_LABELS[shift.offReason ?? 'day_off']?.sr ?? 'Dan slobodan';
  }
  let s = `${shift.startTime ?? '?'}–${shift.endTime ?? '?'}`;
  if (shift.breakStart && shift.breakEnd) s += ` · ☕ ${shift.breakStart}–${shift.breakEnd}`;
  return s;
}

function fmtShiftLong(shift: ShiftInfo | null, lang: Lang): string {
  if (!shift) {
    const notSet: Record<Lang, string> = { sr: 'nije postavljeno', en: 'not set', de: 'nicht gesetzt', es: 'no establecido', fr: 'non défini' };
    return notSet[lang];
  }
  if (shift.isOff) {
    return OFF_LABELS[shift.offReason ?? 'day_off']?.[lang] ?? OFF_LABELS.day_off[lang];
  }
  let s = `${shift.startTime ?? '?'} – ${shift.endTime ?? '?'}`;
  if (shift.breakStart && shift.breakEnd) s += ` (☕ ${shift.breakStart}–${shift.breakEnd})`;
  return s;
}

function buildShiftHtml(params: {
  lang: Lang;
  firstName: string;
  changedBy: 'owner' | 'staff';
  staffName: string;
  businessName: string;
  shiftDate: string;
  oldShift: ShiftInfo | null;
  newShift: ShiftInfo;
}): { subject: string; html: string } {
  const { lang, firstName, changedBy, staffName, businessName, shiftDate, oldShift, newShift } = params;

  const dateLong = fmtDateLong(shiftDate, lang);
  const oldStr   = fmtShiftLong(oldShift, lang);
  const newStr   = fmtShiftLong(newShift, lang);

  const L: Record<Lang, {
    subject: string; title: string; intro: string;
    dateLabel: string; oldLabel: string; newLabel: string; notesLabel: string;
    cta: string; footer: string; greeting: string;
  }> = {
    sr: {
      subject:    changedBy === 'owner' ? 'Izmjena radnog vremena' : `Izmjena radnog vremena — ${staffName}`,
      title:      changedBy === 'owner' ? 'Radno vrijeme promijenjeno 🗓️' : `${staffName} je promijenio/la radno vrijeme`,
      intro:      changedBy === 'owner'
        ? `<strong>${businessName}</strong> je promijenio/la vaše radno vrijeme.`
        : `<strong>${staffName}</strong> je promijenio/la svoje radno vrijeme.`,
      dateLabel:  'Datum', oldLabel: 'Staro radno vrijeme', newLabel: 'Novo radno vrijeme',
      notesLabel: 'Napomena',
      cta:        changedBy === 'owner' ? 'Otvori raspored' : 'Pregledaj raspored radnika',
      footer:     'Za pitanja kontaktirajte vlasnika ili radnika.',
      greeting:   'Zdravo / Hello',
    },
    en: {
      subject:    changedBy === 'owner' ? 'Working hours changed' : `Working hours changed — ${staffName}`,
      title:      changedBy === 'owner' ? 'Working hours updated 🗓️' : `${staffName} changed their hours`,
      intro:      changedBy === 'owner'
        ? `<strong>${businessName}</strong> has updated your working hours.`
        : `<strong>${staffName}</strong> has changed their working hours.`,
      dateLabel:  'Date', oldLabel: 'Old hours', newLabel: 'New hours',
      notesLabel: 'Note',
      cta:        changedBy === 'owner' ? 'View schedule' : 'View staff schedule',
      footer:     'Contact the owner or staff member if you have questions.',
      greeting:   'Hello',
    },
    de: {
      subject:    changedBy === 'owner' ? 'Arbeitszeiten geändert' : `Arbeitszeiten geändert — ${staffName}`,
      title:      changedBy === 'owner' ? 'Arbeitszeiten aktualisiert 🗓️' : `${staffName} hat Arbeitszeiten geändert`,
      intro:      changedBy === 'owner'
        ? `<strong>${businessName}</strong> hat Ihre Arbeitszeiten aktualisiert.`
        : `<strong>${staffName}</strong> hat seine/ihre Arbeitszeiten geändert.`,
      dateLabel:  'Datum', oldLabel: 'Alte Zeiten', newLabel: 'Neue Zeiten',
      notesLabel: 'Hinweis',
      cta:        changedBy === 'owner' ? 'Kalender öffnen' : 'Mitarbeiterkalender öffnen',
      footer:     'Bei Fragen wenden Sie sich an den Inhaber oder Mitarbeiter.',
      greeting:   'Hallo',
    },
    es: {
      subject:    changedBy === 'owner' ? 'Horario de trabajo modificado' : `Horario modificado — ${staffName}`,
      title:      changedBy === 'owner' ? 'Horario actualizado 🗓️' : `${staffName} cambió su horario`,
      intro:      changedBy === 'owner'
        ? `<strong>${businessName}</strong> ha actualizado tu horario de trabajo.`
        : `<strong>${staffName}</strong> ha modificado su horario de trabajo.`,
      dateLabel:  'Fecha', oldLabel: 'Horario anterior', newLabel: 'Nuevo horario',
      notesLabel: 'Nota',
      cta:        changedBy === 'owner' ? 'Ver agenda' : 'Ver agenda del empleado',
      footer:     'Contacta al propietario o empleado si tienes preguntas.',
      greeting:   'Hola',
    },
    fr: {
      subject:    changedBy === 'owner' ? 'Horaire de travail modifié' : `Horaire modifié — ${staffName}`,
      title:      changedBy === 'owner' ? 'Horaire mis à jour 🗓️' : `${staffName} a modifié son horaire`,
      intro:      changedBy === 'owner'
        ? `<strong>${businessName}</strong> a mis à jour votre horaire de travail.`
        : `<strong>${staffName}</strong> a modifié son horaire de travail.`,
      dateLabel:  'Date', oldLabel: 'Ancien horaire', newLabel: 'Nouvel horaire',
      notesLabel: 'Note',
      cta:        changedBy === 'owner' ? 'Voir le planning' : 'Voir le planning employé',
      footer:     "Contactez le propriétaire ou l'employé en cas de questions.",
      greeting:   'Bonjour',
    },
  };

  const l = L[lang];
  const ctaUrl = changedBy === 'owner'
    ? 'https://gigzone.app/dashboard/staff/schedule'
    : 'https://gigzone.app/booking/business/schedule';

  const oldBlock = oldShift
    ? `<div style="background:#fff8f3;border:1px solid #fed7aa;border-radius:12px;padding:12px 20px;margin-bottom:12px">
         <p style="margin:0;font-size:12px;color:#c2410c;text-transform:uppercase;letter-spacing:0.5px">${l.oldLabel}</p>
         <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#7c2d12;text-decoration:line-through">${oldStr}</p>
       </div>`
    : '';

  const notesBlock = newShift.notes
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 20px;margin-bottom:12px">
         <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${l.notesLabel}</p>
         <p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#1a1a1a">${newShift.notes}</p>
       </div>`
    : '';

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
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:12px 20px;margin-bottom:12px">
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px">${l.dateLabel}</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#1a1a1a">${dateLong}</p>
        </div>
        ${oldBlock}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px 20px;margin-bottom:12px">
          <p style="margin:0;font-size:12px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px">${l.newLabel}</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#14532d">${newStr}</p>
        </div>
        ${notesBlock}
        <div style="text-align:center;margin:24px 0">
          <a href="${ctaUrl}"
             style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;display:inline-block">
            ${l.cta}
          </a>
        </div>
        <p style="color:#888;font-size:13px;margin:24px 0 0">
          ${l.footer}<br/>
          <strong>GigZone tim / Team</strong>
        </p>
      </div>
      <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">GigZone · gigzone.app</p>
    </div>
  `;

  return { subject: l.subject, html };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ ok: true });

    const body = await request.json();
    const {
      changedBy,     // 'owner' | 'staff'
      staffMemberId, // UUID — the staff member whose shift changed
      businessId,    // UUID
      shiftDate,     // 'YYYY-MM-DD'
      oldShift,      // ShiftInfo | null
      newShift,      // ShiftInfo
    } = body as {
      changedBy: 'owner' | 'staff';
      staffMemberId: string;
      businessId: string;
      shiftDate: string;
      oldShift: ShiftInfo | null;
      newShift: ShiftInfo;
    };

    if (!changedBy || !staffMemberId || !businessId || !shiftDate || !newShift) {
      return NextResponse.json({ ok: true });
    }
    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Verify caller belongs to this business
    const { data: callerSm } = await db
      .from('staff_members')
      .select('id, role, permissions')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!callerSm) return NextResponse.json({ ok: true });

    // Validate permission per changedBy
    if (changedBy === 'owner' && !(['owner', 'manager'] as string[]).includes(callerSm.role)) {
      return NextResponse.json({ ok: true });
    }
    if (changedBy === 'staff' && !(callerSm.permissions as Record<string, unknown> | null)?.can_set_hours) {
      return NextResponse.json({ ok: true });
    }

    // Get target staff user_id + profile
    const { data: targetSm } = await db
      .from('staff_members')
      .select('user_id')
      .eq('id', staffMemberId)
      .eq('business_id', businessId)
      .maybeSingle();
    if (!targetSm?.user_id) return NextResponse.json({ ok: true });

    const { data: staffProfile } = await db
      .from('profiles')
      .select('name, email, country')
      .eq('id', targetSm.user_id)
      .maybeSingle();
    const staffName = staffProfile?.name ?? 'Radnik';

    // Get owner user_id + profile
    const { data: ownerSm } = await db
      .from('staff_members')
      .select('user_id')
      .eq('business_id', businessId)
      .eq('role', 'owner')
      .eq('is_active', true)
      .maybeSingle();
    const ownerUserId = ownerSm?.user_id ?? null;

    // Get business name
    const { data: bp } = await db
      .from('booking_profiles')
      .select('name')
      .eq('id', businessId)
      .maybeSingle();
    const businessName = bp?.name ?? 'Biznis';

    const dateShort = fmtDateShort(shiftDate);
    const newTimeStr = fmtShiftBell(newShift);
    const oldTimeStr = oldShift ? fmtShiftBell(oldShift) : null;

    if (changedBy === 'owner') {
      // Owner changed staff hours → notify the staff member
      const bellBody = oldTimeStr
        ? `${dateShort} · ${oldTimeStr} → ${newTimeStr}${newShift.notes ? ' · ' + newShift.notes : ''}`
        : `${dateShort} · ${newTimeStr}${newShift.notes ? ' · ' + newShift.notes : ''}`;

      await db.from('notifications').insert({
        user_id:     targetSm.user_id,
        type:        'booking',
        action_type: 'schedule_changed',
        title:       'Radno vrijeme promijenjeno',
        body:        bellBody,
        meta:        { business_id: businessId, shift_date: shiftDate },
      });

      if (staffProfile?.email) {
        const lang      = getLang(staffProfile.country);
        const firstName = staffName.split(' ')[0] || 'there';
        const { subject, html } = buildShiftHtml({ lang, firstName, changedBy: 'owner', staffName, businessName, shiftDate, oldShift, newShift });
        await sendEmail({ to: staffProfile.email, subject, replyTo: 'support@gigzone.app', html });
      }

    } else {
      // Staff changed own hours → notify owner
      if (!ownerUserId) return NextResponse.json({ ok: true });

      const { data: ownerProfile } = await db
        .from('profiles')
        .select('name, email, country')
        .eq('id', ownerUserId)
        .maybeSingle();
      if (!ownerProfile) return NextResponse.json({ ok: true });

      const bellBody = `${staffName}: ${dateShort} · ${newTimeStr}${newShift.notes ? ' · ' + newShift.notes : ''}`;

      await db.from('notifications').insert({
        user_id:     ownerUserId,
        type:        'booking',
        action_type: 'schedule_changed',
        title:       `${staffName} je promijenio/la radno vrijeme`,
        body:        bellBody,
        meta:        { business_id: businessId, shift_date: shiftDate, staff_name: staffName },
      });

      if (ownerProfile.email) {
        const lang      = getLang(ownerProfile.country);
        const firstName = ownerProfile.name?.split(' ')[0] || 'there';
        const { subject, html } = buildShiftHtml({ lang, firstName, changedBy: 'staff', staffName, businessName, shiftDate, oldShift, newShift });
        await sendEmail({ to: ownerProfile.email, subject, replyTo: 'support@gigzone.app', html });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[schedule-notify]', err);
    return NextResponse.json({ ok: true });
  }
}
