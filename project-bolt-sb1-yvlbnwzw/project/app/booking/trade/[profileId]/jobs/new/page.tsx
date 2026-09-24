'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

type ClientOption = { id: string; name: string };
type StaffOption  = { id: string; user_id: string; name: string };

const PRIORITY_KEYS = ['low', 'normal', 'high', 'urgent'] as const;

export default function NewTradeJobPage() {
  const { profileId } = useParams() as { profileId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [clientId, setClientId]         = useState('');
  const [assignedTo, setAssignedTo]     = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd]     = useState('');
  const [location, setLocation]         = useState('');
  const [notes, setNotes]               = useState('');
  const [priority, setPriority]         = useState<'low'|'normal'|'high'|'urgent'>('normal');
  const [saving, setSaving]             = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [staff, setStaff]     = useState<StaffOption[]>([]);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  async function loadOptions() {
    const [clientRes, staffRes] = await Promise.all([
      (supabase as any).rpc('search_trade_clients', { p_business_id: profileId, p_limit: 200 }),
      (supabase as any).rpc('get_trade_staff', { p_business_id: profileId }),
    ]);
    if (Array.isArray(clientRes.data)) setClients(clientRes.data);
    if (Array.isArray(staffRes.data))  setStaff(staffRes.data);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const { data } = await (supabase as any).rpc('create_trade_job', {
      p_business_id:     profileId,
      p_title:           title.trim(),
      p_description:     description.trim() || null,
      p_client_id:       clientId   || null,
      p_assigned_to:     assignedTo ? staff.find((s) => s.id === assignedTo)?.user_id ?? null : null,
      p_scheduled_start: scheduledStart || null,
      p_scheduled_end:   scheduledEnd   || null,
      p_location:        location.trim() || null,
      p_notes:           notes.trim()    || null,
      p_priority:        priority,
    });
    setSaving(false);
    if (!data?.ok) {
      toast.error(data?.error ?? 'error');
      return;
    }
    toast.success(t('trade.jobs.created'));
    router.replace(`/booking/trade/${profileId}/jobs/${data.id}`);
  }

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full';

  function row(label: string, children: React.ReactNode) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="jobs">
      {/* Back header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push(`/booking/trade/${profileId}/jobs`)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-foreground">{t('trade.jobs.newTitle')}</h1>
      </div>

      <div className="flex flex-col gap-4 bg-card border border-border rounded-2xl p-4">
        {/* Title */}
        {row(t('trade.jobs.title'),
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={t('trade.jobs.titlePh')} className={inputCls} autoFocus />
        )}

        {/* Description */}
        {row(t('trade.jobs.description'),
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder={t('trade.jobs.descriptionPh')} rows={3}
            className={`${inputCls} resize-none`} />
        )}

        {/* Priority */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t('trade.jobs.priority')}</label>
          <div className="flex gap-2 flex-wrap">
            {PRIORITY_KEYS.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  priority === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {t(`trade.jobs.priority${p.charAt(0).toUpperCase()}${p.slice(1)}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Client */}
        {row(t('trade.jobs.client'),
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
            <option value="">{t('trade.jobs.noClient')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Assign to */}
        {row(t('trade.jobs.assignTo'),
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputCls}>
            <option value="">{t('trade.jobs.noAssign')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {/* Scheduled */}
        <div className="grid grid-cols-2 gap-2">
          {row(t('trade.jobs.scheduledStart'),
            <input type="datetime-local" value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)} className={inputCls} />
          )}
          {row(t('trade.jobs.scheduledEnd'),
            <input type="datetime-local" value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)} className={inputCls} />
          )}
        </div>

        {/* Location */}
        {row(t('trade.jobs.location'),
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder={t('trade.jobs.locationPh')} className={inputCls} />
        )}

        {/* Notes */}
        {row(t('trade.jobs.notes'),
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder={t('trade.jobs.notesPh')} rows={2}
            className={`${inputCls} resize-none`} />
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={() => router.push(`/booking/trade/${profileId}/jobs`)}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">
            {t('common.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('trade.jobs.save')}
          </button>
        </div>
      </div>
    </TradeDashboardLayout>
  );
}
