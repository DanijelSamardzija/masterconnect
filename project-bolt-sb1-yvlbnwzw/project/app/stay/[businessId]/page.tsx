'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ArrowLeft, Check, Users, ChevronLeft, ChevronRight, Moon, Wifi, Car, Tv, UtensilsCrossed, Wind } from 'lucide-react';

type Business = { id: string; name: string; avatar_url: string | null; city: string | null };
type AccUnit = {
  id: string;
  name: string;
  unit_type: string;
  capacity: number;
  price_per_night: number;
  price_currency: string;
  description: string | null;
  amenities: string[] | null;
};
type Photo = { id: string; unit_id: string; url: string; caption: string | null; sort_order: number };
type AccSettings = { check_in_time: string; check_out_time: string; min_nights: number; breakfast_included: boolean };

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi className="w-3.5 h-3.5" />,
  Klima: <Wind className="w-3.5 h-3.5" />,
  Parking: <Car className="w-3.5 h-3.5" />,
  TV: <Tv className="w-3.5 h-3.5" />,
  Kuhinja: <UtensilsCrossed className="w-3.5 h-3.5" />,
};

export default function StayPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [units, setUnits] = useState<AccUnit[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [settings, setSettings] = useState<AccSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedUnit, setSelectedUnit] = useState<AccUnit | null>(null);
  const [photoIdx, setPhotoIdx] = useState<Record<string, number>>({});

  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bizRes, unitRes, photoRes, settingsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, city').eq('id', businessId).single(),
        (supabase as any).from('accommodation_units').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
        (supabase as any).from('accommodation_photos').select('*').eq('business_id', businessId).order('sort_order'),
        (supabase as any).from('accommodation_settings').select('*').eq('business_id', businessId).maybeSingle(),
      ]);
      setBusiness(bizRes.data);
      setUnits(unitRes.data ?? []);
      setPhotos(photoRes.data ?? []);
      setSettings(settingsRes.data);
      setLoading(false);
    })();
    if (user) {
      supabase.from('profiles').select('name').eq('id', user.id).single().then(({ data }) => {
        if (data?.name) setClientName(data.name);
      });
    }
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    setCheckIn(tomorrow.toISOString().split('T')[0]);
    setCheckOut(dayAfter.toISOString().split('T')[0]);
  }, [businessId, user]);

  function unitPhotos(unitId: string) {
    return photos.filter((p) => p.unit_id === unitId).sort((a, b) => a.sort_order - b.sort_order);
  }

  function calcNights() {
    if (!checkIn || !checkOut) return 0;
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  }

  const nights = calcNights();
  const totalAmount = selectedUnit ? nights * selectedUnit.price_per_night : 0;
  const currency = selectedUnit?.price_currency ?? 'BAM';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUnit || nights <= 0 || !clientName.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from('accommodation_bookings').insert({
      business_id: businessId,
      unit_id: selectedUnit.id,
      client_id: user?.id ?? null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || null,
      client_email: clientEmail.trim() || null,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      total_amount: totalAmount,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error('Greška. Pokušajte ponovo.'); return; }
    setSuccess(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Smještaj nije pronađen.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-center">{t('acc.book.success')}</h1>
        <p className="text-sm text-muted-foreground">{business.name}</p>
        <button onClick={() => router.push('/')}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          Nazad na početnu
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{business.name}</h1>
            {business.city && <p className="text-xs text-muted-foreground">{business.city}</p>}
          </div>
        </div>

        {/* Units list (if no unit selected) */}
        {!selectedUnit ? (
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">{t('acc.setup.title')}</h2>
            {units.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('acc.unit.empty')}</p>
            )}
            {units.map((unit) => {
              const uphotos = unitPhotos(unit.id);
              const idx = photoIdx[unit.id] ?? 0;
              return (
                <div key={unit.id} className="border border-border rounded-2xl overflow-hidden bg-card">
                  {/* Photo carousel */}
                  {uphotos.length > 0 && (
                    <div className="relative h-48">
                      <img
                        src={uphotos[idx % uphotos.length].url}
                        alt={unit.name}
                        className="w-full h-full object-cover"
                      />
                      {uphotos.length > 1 && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPhotoIdx((p) => ({ ...p, [unit.id]: ((idx - 1 + uphotos.length) % uphotos.length) })); }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPhotoIdx((p) => ({ ...p, [unit.id]: ((idx + 1) % uphotos.length) })); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {uphotos.map((_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === idx % uphotos.length ? 'bg-white' : 'bg-white/50'}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold">{unit.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                            {t(`acc.unit.type.${unit.unit_type}` as Parameters<typeof t>[0])}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Users className="w-3 h-3" /> {unit.capacity}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{unit.price_per_night}</p>
                        <p className="text-xs text-muted-foreground">{unit.price_currency}/{t('acc.book.nights').replace(' ', '')}</p>
                      </div>
                    </div>

                    {unit.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{unit.description}</p>
                    )}

                    {unit.amenities && unit.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {unit.amenities.map((a) => (
                          <span key={a} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
                            {AMENITY_ICONS[a]}
                            {t(`acc.amenity.${a}` as Parameters<typeof t>[0])}
                          </span>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedUnit(unit)}
                      className="w-full mt-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      {t('acc.book.submit')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Booking form
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSelectedUnit(null)} className="text-primary text-sm hover:underline">
                ← Nazad
              </button>
              <h2 className="text-base font-semibold">{selectedUnit.name}</h2>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('acc.book.checkin')}</label>
                <input type="date" value={checkIn} min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCheckIn(e.target.value)} required
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('acc.book.checkout')}</label>
                <input type="date" value={checkOut} min={checkIn || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCheckOut(e.target.value)} required
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
            </div>

            {/* Guests */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('acc.book.guests')}</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setGuests(Math.max(1, guests - 1))}
                  className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                  −
                </button>
                <span className="text-base font-semibold w-6 text-center">{guests}</span>
                <button type="button" onClick={() => setGuests(Math.min(selectedUnit.capacity, guests + 1))}
                  className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                  +
                </button>
                <span className="text-xs text-muted-foreground">max {selectedUnit.capacity}</span>
              </div>
            </div>

            {/* Price summary */}
            {nights > 0 && (
              <div className="bg-muted/30 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Moon className="w-4 h-4" />
                  {nights} {t('acc.book.nights')} × {selectedUnit.price_per_night} {currency}
                </div>
                <span className="text-base font-bold text-primary">{totalAmount.toFixed(2)} {currency}</span>
              </div>
            )}

            {/* Contact */}
            <div className="border-t border-border pt-3 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('acc.book.name')}</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} required
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">{t('acc.book.phone')}</label>
                  <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('acc.book.email')}</label>
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('acc.book.notes')}</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
            </div>

            {settings && (
              <p className="text-xs text-muted-foreground">
                Check-in: {settings.check_in_time} • Check-out: {settings.check_out_time}
                {settings.breakfast_included && ' • Doručak uključen'}
              </p>
            )}

            <button type="submit" disabled={submitting || nights <= 0 || !clientName.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mt-1">
              {submitting ? '...' : `${t('acc.book.submit')} — ${totalAmount.toFixed(2)} ${currency}`}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
