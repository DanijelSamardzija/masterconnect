'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { friendlyError } from '@/lib/utils/friendly-error';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Users,
  X,
  Loader2,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientSummary = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tags: string[];
  created_at: string;
};

// ─── Add Client Form ──────────────────────────────────────────────────────────

function AddClientForm({
  businessId,
  onSaved,
  onCancel,
}: {
  businessId: string;
  onSaved: (client: ClientSummary) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [viber, setViber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  function row(label: string, children: React.ReactNode) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary';

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const { data } = await (supabase as any).rpc('create_trade_client', {
      p_business_id: businessId,
      p_name:        name.trim(),
      p_phone:       phone.trim()    || null,
      p_email:       email.trim()    || null,
      p_whatsapp:    whatsapp.trim() || null,
      p_viber:       viber.trim()    || null,
      p_address:     address.trim()  || null,
      p_notes:       notes.trim()    || null,
      p_tags:        tags,
    });
    setSaving(false);
    if (!data?.ok) {
      toast.error(friendlyError(data?.error, t));
      return;
    }
    toast.success(t('trade.clients.saved'));
    onSaved({ id: data.id, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, address: address.trim() || null, tags, created_at: new Date().toISOString() });
  }

  return (
    <div className="border border-border rounded-2xl p-4 bg-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{t('trade.clients.addNew')}</span>
        <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {row(t('trade.clients.name'),
        <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t('trade.clients.namePh')} className={inputCls} />
      )}

      <div className="grid grid-cols-2 gap-2">
        {row(t('trade.clients.phone'),
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={t('trade.clients.phonePh')} className={inputCls} />
        )}
        {row(t('trade.clients.email'),
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t('trade.clients.emailPh')} className={inputCls} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {row(t('trade.clients.whatsapp'),
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={t('trade.clients.phonePh')} className={inputCls} />
        )}
        {row(t('trade.clients.viber'),
          <input type="tel" value={viber} onChange={(e) => setViber(e.target.value)}
            placeholder={t('trade.clients.phonePh')} className={inputCls} />
        )}
      </div>

      {row(t('trade.clients.address'),
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder={t('trade.clients.addressPh')} className={inputCls} />
      )}

      {row(t('trade.clients.notes'),
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder={t('trade.clients.notesPh')}
          className={`${inputCls} resize-none`} />
      )}

      {row(t('trade.clients.tags'),
        <input type="text" value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)}
          placeholder={t('trade.clients.tagsPh')} className={inputCls} />
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors">
          {t('common.cancel')}
        </button>
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('trade.clients.save')}
        </button>
      </div>
    </div>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────────

function ClientRow({ client, onClick }: { client: ClientSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-left"
    >
      <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-blue-700 dark:text-blue-300 leading-none uppercase">
          {client.name.charAt(0)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {client.phone && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Phone className="w-3 h-3" /> {client.phone}
            </span>
          )}
          {client.address && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5 truncate max-w-[180px]">
              <MapPin className="w-3 h-3 shrink-0" /> {client.address}
            </span>
          )}
        </div>
        {client.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {client.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeClientsPage() {
  const { profileId } = useParams() as { profileId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !profileId) return;
    setActiveProfileId(profileId);
    search('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    const { data } = await (supabase as any).rpc('search_trade_clients', {
      p_business_id: profileId,
      p_query:       q || null,
      p_limit:       100,
    });
    if (Array.isArray(data)) {
      setClients(data as ClientSummary[]);
    }
    setLoading(false);
  }, [profileId]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 300);
  }

  function handleClientSaved(client: ClientSummary) {
    setClients((prev) => [client, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    setShowAdd(false);
  }

  const hasQuery = query.trim().length > 0;
  const isEmpty = !loading && clients.length === 0;

  return (
    <TradeDashboardLayout profileId={profileId} active="clients">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-foreground">{t('trade.dashboard.clients.title')}</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('trade.clients.new')}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mb-4">
          <AddClientForm
            businessId={profileId}
            onSaved={handleClientSaved}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder={t('trade.clients.search')}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); search(''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty states */}
      {!loading && isEmpty && !hasQuery && (
        <div className="text-center py-12 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-muted-foreground">{t('trade.clients.empty')}</p>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('trade.clients.addNew')}
          </button>
        </div>
      )}

      {!loading && isEmpty && hasQuery && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t('trade.clients.emptySearch')}
        </p>
      )}

      {/* Client list */}
      {!loading && clients.length > 0 && (
        <div className="flex flex-col gap-2">
          {clients.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              onClick={() => router.push(`/booking/trade/${profileId}/clients/${c.id}`)}
            />
          ))}
        </div>
      )}
    </TradeDashboardLayout>
  );
}
