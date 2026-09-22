'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Calendar, MapPin, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

// Anon client — no auth token; SECURITY DEFINER RPCs handle access control
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type BookingData = {
  booking_id:       string;
  starts_at:        string;
  ends_at:          string;
  service_name:     string;
  status:           string;
  guest_name:       string | null;
  notes:            string | null;
  business_name:    string;
  location_name:    string | null;
  location_address: string | null;
  location_city:    string | null;
  timezone:         string;
  staff_name:       string | null;
};

type LoadState = 'loading' | 'not_found' | 'ok';

const STATUS_CONFIG: Record<string, { label: Record<string, string>; cls: string; icon: React.ReactNode }> = {
  confirmed: {
    label: { sr: 'Potvrđen', en: 'Confirmed', de: 'Bestätigt', es: 'Confirmado', fr: 'Confirmé' },
    cls: 'text-green-600 dark:text-green-400',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  pending: {
    label: { sr: 'Na čekanju', en: 'Pending', de: 'Ausstehend', es: 'Pendiente', fr: 'En attente' },
    cls: 'text-yellow-600 dark:text-yellow-400',
    icon: <Clock className="h-4 w-4" />,
  },
  cancelled: {
    label: { sr: 'Otkazan', en: 'Cancelled', de: 'Storniert', es: 'Cancelado', fr: 'Annulé' },
    cls: 'text-muted-foreground',
    icon: <XCircle className="h-4 w-4" />,
  },
  completed: {
    label: { sr: 'Završen', en: 'Completed', de: 'Abgeschlossen', es: 'Completado', fr: 'Terminé' },
    cls: 'text-muted-foreground',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

const COPY: Record<string, Record<string, string>> = {
  title:              { sr: 'Tvoj termin',        en: 'Your appointment',     de: 'Dein Termin',        es: 'Tu cita',            fr: 'Votre rendez-vous'     },
  service:            { sr: 'Usluga',              en: 'Service',              de: 'Leistung',           es: 'Servicio',           fr: 'Service'               },
  date:               { sr: 'Datum i vrijeme',     en: 'Date & time',          de: 'Datum & Uhrzeit',    es: 'Fecha y hora',       fr: 'Date et heure'         },
  location:           { sr: 'Lokacija',            en: 'Location',             de: 'Standort',           es: 'Ubicación',          fr: 'Lieu'                  },
  status:             { sr: 'Status',              en: 'Status',               de: 'Status',             es: 'Estado',             fr: 'Statut'                },
  staff:              { sr: 'Radnik',               en: 'Staff',                de: 'Mitarbeiter',        es: 'Empleado',           fr: 'Employé'               },
  notes:              { sr: 'Napomena',            en: 'Notes',                de: 'Notiz',              es: 'Notas',              fr: 'Notes'                 },
  cancelBtn:          { sr: 'Otkaži termin',       en: 'Cancel appointment',   de: 'Termin stornieren',  es: 'Cancelar cita',      fr: 'Annuler le rendez-vous'},
  cancelConfirm:      { sr: 'Da li si siguran da želiš otkazati termin?', en: 'Are you sure you want to cancel?', de: 'Bist du sicher, dass du stornieren möchtest?', es: '¿Estás seguro de que quieres cancelar?', fr: 'Êtes-vous sûr de vouloir annuler ?' },
  cancelYes:          { sr: 'Da, otkaži',          en: 'Yes, cancel',          de: 'Ja, stornieren',     es: 'Sí, cancelar',       fr: 'Oui, annuler'          },
  cancelNo:           { sr: 'Ne, zadrži',          en: 'No, keep it',          de: 'Nein, behalten',     es: 'No, mantener',       fr: 'Non, conserver'        },
  cancelSuccess:      { sr: 'Termin je otkazan.',  en: 'Appointment cancelled.',de: 'Termin storniert.',  es: 'Cita cancelada.',    fr: 'Rendez-vous annulé.'  },
  cancelTooLate:      { sr: 'Ne možeš otkazati termin manje od 2 sata unaprijed.', en: 'You cannot cancel within 2 hours of the appointment.', de: 'Stornierung ist weniger als 2 Stunden vor dem Termin nicht möglich.', es: 'No puedes cancelar con menos de 2 horas de antelación.', fr: 'Vous ne pouvez pas annuler moins de 2 heures avant le rendez-vous.' },
  cannotCancel:       { sr: 'Ovaj termin ne može biti otkazan.',           en: 'This appointment cannot be cancelled.',                  de: 'Dieser Termin kann nicht storniert werden.',               es: 'Esta cita no se puede cancelar.',                            fr: 'Ce rendez-vous ne peut pas être annulé.'                },
  notFound:           { sr: 'Termin nije pronađen ili je link istekao.',   en: 'Appointment not found or link has expired.',             de: 'Termin nicht gefunden oder Link ist abgelaufen.',          es: 'Cita no encontrada o el enlace ha expirado.',                fr: 'Rendez-vous introuvable ou lien expiré.'                },
  gigzoneLabel:       { sr: 'Rezervacija putem GigZone',                   en: 'Booked via GigZone',                                     de: 'Gebucht über GigZone',                                     es: 'Reservado a través de GigZone',                              fr: 'Réservé via GigZone'                                    },
};

function t(key: string, lang: string): string {
  return COPY[key]?.[lang] ?? COPY[key]?.['en'] ?? key;
}

function detectLang(): string {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.split('-')[0]?.toLowerCase();
  if (lang === 'sr' || lang === 'hr' || lang === 'bs') return 'sr';
  if (lang === 'de') return 'de';
  if (lang === 'es') return 'es';
  if (lang === 'fr') return 'fr';
  return 'en';
}

function fmtDt(iso: string, tz: string, lang: string): string {
  const locale: Record<string, string> = { sr: 'sr-Latn-RS', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
  try {
    return new Intl.DateTimeFormat(locale[lang] ?? 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function canCancel(booking: BookingData): boolean {
  if (!['pending', 'confirmed'].includes(booking.status)) return false;
  return new Date(booking.starts_at) > new Date(Date.now() + 2 * 60 * 60 * 1000);
}

export default function GuestBookingViewPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const lang  = detectLang();

  const [state, setState]             = useState<LoadState>('loading');
  const [booking, setBooking]         = useState<BookingData | null>(null);
  const [confirming, setConfirming]   = useState(false);
  const [cancelling, setCancelling]   = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled]     = useState(false);

  useEffect(() => {
    if (!token) { setState('not_found'); return; }
    (anonClient as any).rpc('get_booking_by_token', { p_token: token })
      .then(({ data }: { data: { ok: boolean; booking?: BookingData; error?: string } }) => {
        if (data?.ok && data.booking) {
          setBooking(data.booking);
          setState('ok');
        } else {
          setState('not_found');
        }
      })
      .catch(() => setState('not_found'));
  }, [token]);

  async function handleCancel() {
    if (!token || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    const { data } = await (anonClient as any).rpc('cancel_booking_as_guest', { p_token: token });
    setCancelling(false);
    if (data?.ok) {
      setConfirming(false);
      setCancelled(true);
      setBooking(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    } else {
      const errKey = data?.error === 'too_late_to_cancel' ? 'cancelTooLate'
                   : data?.error === 'cannot_cancel'     ? 'cannotCancel'
                   : 'cannotCancel';
      setCancelError(t(errKey, lang));
    }
  }

  const statusCfg = booking ? (STATUS_CONFIG[booking.status] ?? STATUS_CONFIG['confirmed']) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <span className="text-2xl font-black tracking-tight">
          Gig<span className="text-orange-500">Zone</span>
        </span>
      </div>

      <div className="w-full max-w-md">
        {state === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state === 'not_found' && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">{t('notFound', lang)}</p>
          </div>
        )}

        {state === 'ok' && booking && (
          <div className="space-y-4">
            {/* Business + title */}
            <div className="rounded-2xl border border-border bg-card px-6 py-5 space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{booking.business_name}</p>
              <h1 className="text-xl font-semibold text-foreground">{t('title', lang)}</h1>
              {booking.guest_name && (
                <p className="text-sm text-muted-foreground">{booking.guest_name}</p>
              )}
            </div>

            {/* Status */}
            <div className="rounded-2xl border border-border bg-card px-6 py-4">
              <p className="text-xs text-muted-foreground mb-1">{t('status', lang)}</p>
              {statusCfg && (
                <div className={`flex items-center gap-1.5 font-semibold text-sm ${statusCfg.cls}`}>
                  {statusCfg.icon}
                  <span>{statusCfg.label[lang] ?? statusCfg.label['en']}</span>
                </div>
              )}
            </div>

            {/* Service */}
            <div className="rounded-2xl border border-border bg-card px-6 py-4">
              <p className="text-xs text-muted-foreground mb-1">{t('service', lang)}</p>
              <p className="text-sm font-semibold text-foreground">{booking.service_name}</p>
            </div>

            {/* Staff */}
            {booking.staff_name && (
              <div className="rounded-2xl border border-border bg-card px-6 py-4">
                <p className="text-xs text-muted-foreground mb-1">{t('staff', lang)}</p>
                <p className="text-sm font-semibold text-foreground">{booking.staff_name}</p>
              </div>
            )}

            {/* Date */}
            <div className="rounded-2xl border border-border bg-card px-6 py-4">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{t('date', lang)}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {fmtDt(booking.starts_at, booking.timezone, lang)}
                  </p>
                </div>
              </div>
            </div>

            {/* Location */}
            {(booking.location_name || booking.location_address || booking.location_city) && (
              <div className="rounded-2xl border border-border bg-card px-6 py-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">{t('location', lang)}</p>
                    {booking.location_name && (
                      <p className="text-sm font-semibold text-foreground">{booking.location_name}</p>
                    )}
                    {(booking.location_address || booking.location_city) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[booking.location_address, booking.location_city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {booking.notes?.trim() && (
              <div className="rounded-2xl border border-border bg-card px-6 py-4">
                <p className="text-xs text-muted-foreground mb-1">{t('notes', lang)}</p>
                <p className="text-sm text-foreground italic">{booking.notes}</p>
              </div>
            )}

            {/* Cancel — shown if booking is cancellable */}
            {!cancelled && canCancel(booking) && (
              <div className="rounded-2xl border border-border bg-card px-6 py-5 space-y-3">
                {!confirming ? (
                  <button
                    onClick={() => setConfirming(true)}
                    className="w-full py-2.5 rounded-xl border border-destructive text-destructive text-sm font-medium hover:bg-destructive/5 transition-colors"
                  >
                    {t('cancelBtn', lang)}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground text-center">{t('cancelConfirm', lang)}</p>
                    {cancelError && (
                      <p className="text-xs text-destructive text-center">{cancelError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirming(false); setCancelError(null); }}
                        className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
                      >
                        {t('cancelNo', lang)}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 transition-colors"
                      >
                        {cancelling ? '...' : t('cancelYes', lang)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Post-cancel success message */}
            {cancelled && (
              <div className="rounded-2xl border border-border bg-card px-6 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{t('cancelSuccess', lang)}</span>
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground pt-2">{t('gigzoneLabel', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
