'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { toast } from 'sonner';
import { ChevronRight, MapPin, Calendar, X, Send } from 'lucide-react';
import { TimePicker24h } from '@/components/ui/time-picker-24h';

type TradeRequest = {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  client_phone: string | null;
  address: string | null;
  city: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  quote?: TradeQuote | null;
};

type TradeQuote = {
  id: string;
  price_amount: number;
  price_type: string;
  price_max: number | null;
  duration_estimate: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  message: string | null;
  status: string;
  currency: string;
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    open:        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    quoted:      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    accepted:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    scheduled:   'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    completed:   'bg-muted text-muted-foreground',
    cancelled:   'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    declined:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? map.open}`}>
      {t(`trade.dash.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

type QuoteForm = {
  price_amount: string;
  price_type: 'fixed' | 'hourly' | 'range';
  price_max: string;
  currency: string;
  duration_estimate: string;
  scheduled_date: string;
  scheduled_time: string;
  message: string;
};

const EMPTY_FORM: QuoteForm = {
  price_amount: '',
  price_type: 'fixed',
  price_max: '',
  currency: 'BAM',
  duration_estimate: '',
  scheduled_date: '',
  scheduled_time: '',
  message: '',
};

export default function RequestsDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [requests, setRequests] = useState<TradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quoteModal, setQuoteModal] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('tradesperson_requests')
      .select('*')
      .eq('business_id', user.id)
      .order('created_at', { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function loadQuote(requestId: string) {
    const { data } = await (supabase as any)
      .from('tradesperson_quotes')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, quote: data ?? null } : r))
    );
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const req = requests.find((r) => r.id === id);
      if (req && !('quote' in req)) loadQuote(id);
    }
  }

  function openQuoteModal(requestId: string) {
    setForm(EMPTY_FORM);
    setQuoteModal(requestId);
  }

  async function submitQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteModal || !form.price_amount) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from('tradesperson_quotes').insert({
      request_id: quoteModal,
      business_id: user?.id,
      price_amount: parseFloat(form.price_amount),
      price_type: form.price_type,
      price_max: form.price_type === 'range' && form.price_max ? parseFloat(form.price_max) : null,
      currency: form.currency,
      duration_estimate: form.duration_estimate || null,
      scheduled_date: form.scheduled_date || null,
      scheduled_time: form.scheduled_time || null,
      message: form.message.trim() || null,
    });
    if (!error) {
      await (supabase as any).from('tradesperson_requests')
        .update({ status: 'quoted' }).eq('id', quoteModal);
    }
    setSubmitting(false);
    if (error) { toast.error('Greška. Pokušajte ponovo.'); return; }
    toast.success(t('trade.dash.quoteSent'));
    setQuoteModal(null);
    load();
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await (supabase as any).from('tradesperson_requests').update({ status: newStatus }).eq('id', id);
    setUpdatingId(null);
    load();
  }

  if (!authLoading && !hasAccess) {
    return <ProtectedRoute><BookingBetaBanner /></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => router.push('/booking')} className="text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h1 className="text-xl font-semibold flex-1">{t('trade.dash.title')}</h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('trade.dash.empty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div key={req.id} className="border border-border rounded-xl bg-card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(req.id)}
                    className="w-full text-left p-4 flex items-start justify-between gap-2"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{req.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {req.client_name && <span>{req.client_name}</span>}
                        {req.city && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {req.city}
                          </span>
                        )}
                        {req.preferred_date && (
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" /> {req.preferred_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={req.status} t={t} />
                  </button>

                  {expandedId === req.id && (
                    <div className="border-t border-border bg-muted/30 px-4 pb-4 pt-3 flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">{req.description}</p>

                      {req.client_phone && (
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <a href={`tel:${req.client_phone}`} className="text-primary hover:underline">{req.client_phone}</a>
                          <a href={`https://wa.me/${req.client_phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#25D366]/15 hover:bg-[#25D366]/30 text-[#25D366] transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </a>
                          <a href={`viber://chat?number=${req.client_phone.replace(/\D/g,'')}`} title="Viber" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7B519D]/15 hover:bg-[#7B519D]/30 text-[#7B519D] transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><path d="M11.398.008C8.232.022 4.483 1.652 2.38 5.137 1.027 7.418.769 10.162.997 12.63c.218 2.27 1.144 4.5 2.804 6.083 1.62 1.547 4.082 2.61 6.376 2.47l3.906 2.825-.194-3.054c4.32-.427 7.917-3.77 8.101-8.217.14-3.428-1.41-7.108-3.78-9.213C16.437.72 13.95-.008 11.398.008zm.03 1.846c2.218-.012 4.324.625 6.042 2.164 1.987 1.8 3.234 4.993 3.117 7.84-.158 3.747-3.234 6.504-6.924 6.782l.116 1.815-2.323-1.67-.5.035c-2.015.14-4.148-.79-5.575-2.155C3.993 15.53 3.215 13.617 3.03 11.647c-.197-2.1.004-4.354 1.066-6.202C6.044 3.117 8.952 1.866 11.428 1.854zM8.42 5.597c-.24 0-.482.06-.676.212-.193.152-.426.375-.586.619-.217.334-.21.75-.049 1.21.162.462.47.95.813 1.393.537.699 1.08 1.32 1.773 1.893.693.573 1.426 1.015 2.184 1.288.448.16.916.224 1.285.073.37-.151.59-.48.735-.83.178-.426.153-.806-.046-1.047-.198-.241-.571-.434-.867-.578-.296-.146-.591-.278-.858-.226-.266.053-.433.27-.574.484-.141.215-.269.378-.44.417-.17.038-.48-.073-.74-.265-.36-.263-.757-.653-1.098-1.035-.34-.38-.636-.773-.78-1.04-.144-.267-.122-.495-.086-.598.037-.104.155-.24.316-.393.16-.153.349-.32.437-.534.087-.213.05-.51-.11-.814-.161-.305-.42-.621-.714-.816-.294-.195-.578-.213-.72-.213z"/></svg>
                          </a>
                        </p>
                      )}

                      {req.address && (
                        <p className="text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 inline mr-0.5" />
                          {req.address}{req.city ? `, ${req.city}` : ''}
                        </p>
                      )}

                      {/* Show existing quote */}
                      {req.quote && (
                        <div className="border border-border rounded-lg p-3 bg-card">
                          <p className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">{t('trade.dash.quoteLabel')}</p>
                          <p className="text-sm font-medium">
                            {req.quote.price_amount} {req.quote.price_type === 'range' && req.quote.price_max ? `– ${req.quote.price_max}` : ''} {req.quote.currency}
                            <span className="text-xs text-muted-foreground ml-1">({req.quote.price_type})</span>
                          </p>
                          {req.quote.duration_estimate && (
                            <p className="text-sm text-muted-foreground">{req.quote.duration_estimate}</p>
                          )}
                          {req.quote.message && (
                            <p className="text-sm italic text-muted-foreground mt-1">{req.quote.message}</p>
                          )}
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                            req.quote.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : req.quote.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-muted text-muted-foreground'
                          }`}>
                            {t(`trade.dash.quoteStatus.${req.quote.status}` as Parameters<typeof t>[0])}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {req.status === 'open' && (
                          <button
                            onClick={() => openQuoteModal(req.id)}
                            className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center justify-center gap-1.5"
                          >
                            <Send className="w-3 h-3" /> {t('trade.dash.sendQuote')}
                          </button>
                        )}
                        {req.status === 'accepted' && (
                          <button
                            onClick={() => updateStatus(req.id, 'in_progress')}
                            disabled={updatingId === req.id}
                            className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                          >
                            {updatingId === req.id ? '...' : t('trade.dash.start')}
                          </button>
                        )}
                        {req.status === 'in_progress' && (
                          <button
                            onClick={() => updateStatus(req.id, 'completed')}
                            disabled={updatingId === req.id}
                            className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                          >
                            {updatingId === req.id ? '...' : t('trade.dash.complete')}
                          </button>
                        )}
                        {req.status !== 'completed' && req.status !== 'cancelled' && req.status !== 'declined' && (
                          <button
                            onClick={() => updateStatus(req.id, 'declined')}
                            disabled={updatingId === req.id}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            {t('trade.dash.decline')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quote Modal */}
      {quoteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setQuoteModal(null)} />
          <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t('trade.dash.quoteModalTitle')}</h2>
              <button onClick={() => setQuoteModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitQuote} className="flex flex-col gap-3">
              {/* Price type chips */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.priceType')}</label>
                <div className="flex gap-2">
                  {(['fixed', 'hourly', 'range'] as const).map((pt) => (
                    <button key={pt} type="button"
                      onClick={() => setForm((f) => ({ ...f, price_type: pt }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.price_type === pt
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {t(`trade.quote.priceType.${pt}` as Parameters<typeof t>[0])}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price + currency */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    {form.price_type === 'range' ? t('trade.quote.priceFrom') : t('trade.quote.price')}
                  </label>
                  <input type="number" min="0" step="0.01"
                    value={form.price_amount} onChange={(e) => setForm((f) => ({ ...f, price_amount: e.target.value }))}
                    required className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.currency')}</label>
                  <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                    {['BAM', 'EUR', 'RSD', 'USD'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {form.price_type === 'range' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.priceTo')}</label>
                  <input type="number" min="0" step="0.01"
                    value={form.price_max} onChange={(e) => setForm((f) => ({ ...f, price_max: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}

              {/* Duration + scheduled */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.duration')}</label>
                <input type="text" placeholder={t('trade.quote.durationPh')}
                  value={form.duration_estimate} onChange={(e) => setForm((f) => ({ ...f, duration_estimate: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.scheduledDate')}</label>
                  <input type="date" min={new Date().toISOString().split('T')[0]}
                    value={form.scheduled_date} onChange={(e) => setForm((f) => ({ ...f, scheduled_date: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.scheduledTime')}</label>
                  <TimePicker24h
                    value={form.scheduled_time} onChange={(v) => setForm((f) => ({ ...f, scheduled_time: v }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-muted-foreground">{t('trade.quote.message')}</label>
                <textarea rows={3} placeholder={t('trade.quote.messagePh')}
                  value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>

              <button type="submit" disabled={submitting || !form.price_amount}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                {submitting ? '...' : t('trade.dash.sendQuote')}
              </button>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
