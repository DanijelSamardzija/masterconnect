'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ArrowLeft, Users, MapPin, Calendar, Clock, Check } from 'lucide-react';
import { TimePicker24h } from '@/components/ui/time-picker-24h';

type Business = { id: string; name: string; avatar_url: string | null; city: string | null };
type TableRow = { id: string; name: string; capacity: number; location_tag: string | null };

export default function RestaurantReservationPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bizRes, tablesRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, city').eq('id', businessId).single(),
        (supabase as any).from('restaurant_tables').select('id, name, capacity, location_tag')
          .eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      ]);
      setBusiness(bizRes.data);
      setTables(tablesRes.data ?? []);
      setLoading(false);
    })();
    // Pre-fill name/phone from profile
    if (user) {
      supabase.from('profiles').select('name').eq('id', user.id).single().then(({ data }) => {
        if (data?.name) setClientName(data.name);
      });
    }
    // Default date = today
    setDate(new Date().toISOString().split('T')[0]);
  }, [businessId, user]);

  const availableTables = tables.filter((t) => t.capacity >= partySize);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTableId || !clientName.trim() || !date || !time) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from('table_reservations').insert({
      business_id: businessId,
      table_id: selectedTableId,
      client_id: user?.id ?? null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || null,
      party_size: partySize,
      reserved_date: date,
      reserved_time: time,
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
        <p className="text-muted-foreground">Restoran nije pronađen.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-center">{t('restaurant.reserve.success')}</h1>
        <p className="text-sm text-muted-foreground text-center">{business.name}</p>
        <button onClick={() => router.push('/')}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
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
            {business.city && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" /> {business.city}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">{t('restaurant.reserve.title')}</h2>

          {/* Party size */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('restaurant.reserve.party')}</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { setPartySize(n); setSelectedTableId(''); }}
                  className={`w-10 h-10 rounded-xl border text-sm font-medium transition-colors ${
                    partySize === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                <Calendar className="w-3 h-3 inline mr-1" />{t('restaurant.reserve.date')}
              </label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDate(e.target.value)}
                required
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />{t('restaurant.reserve.time')}
              </label>
              <TimePicker24h
                value={time}
                onChange={(v) => setTime(v)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Table selection */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{t('restaurant.reserve.selectTable')}</label>
            {availableTables.length === 0 ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 py-2">{t('restaurant.reserve.noTables')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {availableTables.map((tbl) => (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => setSelectedTableId(tbl.id)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      selectedTableId === tbl.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tbl.name}</span>
                      <div className="flex items-center gap-1.5">
                        {tbl.location_tag && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                            {t(`restaurant.table.location.${tbl.location_tag}` as Parameters<typeof t>[0])}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Users className="w-3 h-3" /> {t('restaurant.reserve.for')} {tbl.capacity} {t('restaurant.reserve.persons')}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('restaurant.reserve.name')}</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{t('restaurant.reserve.phone')}</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">{t('restaurant.reserve.notes')}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedTableId || !clientName.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-1"
          >
            {submitting ? '...' : t('restaurant.reserve.submit')}
          </button>
        </form>

      </div>
    </div>
  );
}
