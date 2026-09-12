'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ChevronRight, CalendarOff, Trash2 } from 'lucide-react';

type TimeBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  note: string | null;
};

const REASONS = ['vacation', 'blocked'] as const;

function toLocalDateStr(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function StaffTimeOffPage() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const router = useRouter();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate]     = useState(tomorrowStr());
  const [reason, setReason]       = useState<typeof REASONS[number]>('vacation');
  const [note, setNote]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: sm } = await (supabase as any)
        .from('staff_members')
        .select('permissions')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .in('role', ['worker', 'manager'])
        .limit(1)
        .maybeSingle();

      if (sm?.permissions?.can_block_time) {
        setHasPermission(true);
        await loadBlocks();
      }
      setLoading(false);
    })();
  }, [profile]);

  async function loadBlocks() {
    const { data } = await (supabase as any).rpc('get_my_time_blocks');
    setBlocks((data as TimeBlock[]) ?? []);
  }

  async function handleAdd() {
    if (!startDate || !endDate) return;
    const starts = new Date(startDate + 'T00:00:00').toISOString();
    const ends   = new Date(endDate   + 'T23:59:59').toISOString();
    if (ends <= starts) {
      toast.error(t('staffTimeOff.errorRange'));
      return;
    }
    setSubmitting(true);
    const { data } = await (supabase as any).rpc('add_my_time_block', {
      p_starts_at: starts,
      p_ends_at:   ends,
      p_reason:    reason,
      p_note:      note.trim() || null,
    });
    setSubmitting(false);
    if (!data?.ok) {
      toast.error(t('staffTimeOff.errorAdd'));
      return;
    }
    toast.success(t('staffTimeOff.added'));
    setNote('');
    setStartDate(todayStr());
    setEndDate(tomorrowStr());
    await loadBlocks();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await (supabase as any).rpc('delete_my_time_block', { p_block_id: id });
    setDeletingId(null);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/dashboard/staff/bookings')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{t('staffTimeOff.title')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{t('staffTimeOff.subtitle')}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasPermission ? (
            <div className="text-center py-12">
              <CalendarOff className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t('staffTimeOff.noPermission')}</p>
            </div>
          ) : (
            <>
              {/* Add form */}
              <div className="border border-border rounded-xl p-4 mb-6 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{t('staffTimeOff.from')}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{t('staffTimeOff.to')}</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('staffTimeOff.reason')}</label>
                  <div className="flex flex-wrap gap-2">
                    {REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReason(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          reason === r
                            ? 'bg-primary text-white'
                            : 'bg-accent text-accent-foreground hover:bg-accent/80'
                        }`}
                      >
                        {t(`staffTimeOff.reason.${r}` as Parameters<typeof t>[0])}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{t('staffTimeOff.note')}</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('staffTimeOff.notePlaceholder')}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button
                  onClick={handleAdd}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? t('staffTimeOff.adding') : t('staffTimeOff.add')}
                </button>
              </div>

              {/* Existing blocks */}
              <h2 className="text-sm font-semibold mb-3">{t('staffTimeOff.upcoming')}</h2>
              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">{t('staffTimeOff.empty')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {blocks.map((b) => (
                    <div
                      key={b.id}
                      className="border border-border rounded-xl p-4 flex items-start justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {t(`staffTimeOff.reason.${b.reason}` as Parameters<typeof t>[0])}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {toLocalDateStr(b.starts_at)} → {toLocalDateStr(b.ends_at)}
                        </p>
                        {b.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{b.note}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deletingId === b.id}
                        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 shrink-0 mt-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
