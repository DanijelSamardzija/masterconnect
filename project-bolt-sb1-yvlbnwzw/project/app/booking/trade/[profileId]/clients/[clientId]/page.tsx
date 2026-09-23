'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/contexts/language-context';
import { useAuth } from '@/lib/contexts/auth-context';
import { useBookingProfile } from '@/lib/contexts/booking-profile-context';
import { TradeDashboardLayout } from '@/components/trade/TradeDashboardLayout';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Trash2,
  Plus,
  X,
  Loader2,
  Wrench,
  Briefcase,
  Package,
  Link,
  Unlink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Asset = {
  id: string;
  name: string;
  asset_type: string | null;
  description: string | null;
  location: string | null;
  created_at: string;
};

type TradeClient = {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  viber: string | null;
  address: string | null;
  notes: string | null;
  tags: string[];
  linked_user_id: string | null;
  linked_user_name: string | null;
  created_at: string;
  updated_at: string;
  assets: Asset[];
};

type HistoryJob = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_start: string | null;
  invoice_amount: number | null;
  is_invoiced: boolean;
  created_at: string;
};

// ─── Asset types ──────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  'property', 'vehicle', 'hvac', 'boiler',
  'electrical', 'plumbing', 'appliance', 'equipment', 'other',
] as const;

// ─── Asset Form ───────────────────────────────────────────────────────────────

function AssetForm({
  businessId,
  clientId,
  editing,
  onSaved,
  onCancel,
  t,
}: {
  businessId: string;
  clientId: string;
  editing: Asset | null;
  onSaved: (asset: Asset) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [assetType, setAssetType] = useState(editing?.asset_type ?? 'other');
  const [desc, setDesc] = useState(editing?.description ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary';

  function row(label: string, children: React.ReactNode) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const { data } = await (supabase as any).rpc('upsert_trade_asset', {
      p_business_id: businessId,
      p_client_id:   clientId,
      p_name:        name.trim(),
      p_asset_type:  assetType,
      p_description: desc.trim() || null,
      p_location:    location.trim() || null,
      p_asset_id:    editing?.id ?? null,
    });
    setSaving(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.assets.saved'));
    onSaved({
      id:          data.id ?? editing!.id,
      name:        name.trim(),
      asset_type:  assetType,
      description: desc.trim() || null,
      location:    location.trim() || null,
      created_at:  editing?.created_at ?? new Date().toISOString(),
    });
  }

  return (
    <div className="border border-border rounded-xl p-4 bg-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {editing ? t('trade.assets.edit') : t('trade.assets.add')}
        </span>
        <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {row(t('trade.assets.name'),
        <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t('trade.assets.namePh')} className={inputCls} />
      )}

      {row(t('trade.assets.type'),
        <div className="flex flex-wrap gap-1">
          {ASSET_TYPES.map((at) => (
            <button key={at} type="button" onClick={() => setAssetType(at)}
              className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                assetType === at
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
              }`}>
              {t(`trade.assets.type.${at}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      )}

      {row(t('trade.assets.location'),
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder={t('trade.assets.locationPh')} className={inputCls} />
      )}

      {row(t('trade.assets.description'),
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
          placeholder={t('trade.assets.descriptionPh')}
          className={`${inputCls} resize-none`} />
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

// ─── Edit Client Form ─────────────────────────────────────────────────────────

function EditClientForm({
  client,
  onSaved,
  onCancel,
  t,
}: {
  client: TradeClient;
  onSaved: (updated: Partial<TradeClient>) => void;
  onCancel: () => void;
  t: (k: string) => string;
}) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [whatsapp, setWhatsapp] = useState(client.whatsapp ?? '');
  const [viber, setViber] = useState(client.viber ?? '');
  const [address, setAddress] = useState(client.address ?? '');
  const [notes, setNotes] = useState(client.notes ?? '');
  const [tagsRaw, setTagsRaw] = useState((client.tags ?? []).join(', '));
  const [saving, setSaving] = useState(false);

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary';

  function row(label: string, children: React.ReactNode) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const { data } = await (supabase as any).rpc('update_trade_client', {
      p_client_id: client.id,
      p_name:      name.trim(),
      p_phone:     phone.trim()    || null,
      p_email:     email.trim()    || null,
      p_whatsapp:  whatsapp.trim() || null,
      p_viber:     viber.trim()    || null,
      p_address:   address.trim()  || null,
      p_notes:     notes.trim()    || null,
      p_tags:      tags,
    });
    setSaving(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.clients.saved'));
    onSaved({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, whatsapp: whatsapp.trim() || null, viber: viber.trim() || null, address: address.trim() || null, notes: notes.trim() || null, tags });
  }

  return (
    <div className="border border-border rounded-2xl p-4 bg-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{t('trade.clients.edit')}</span>
        <button onClick={onCancel} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {row(t('trade.clients.name'),
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={t('trade.clients.namePh')} className={inputCls} />
      )}

      <div className="grid grid-cols-2 gap-2">
        {row(t('trade.clients.phone'),
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={t('trade.clients.phonePh')} className={inputCls} />
        )}
        {row(t('trade.clients.email'),
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com" className={inputCls} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {row('WhatsApp',
          <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={t('trade.clients.phonePh')} className={inputCls} />
        )}
        {row('Viber',
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
          {t('trade.clients.saveChanges')}
        </button>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const colorMap: Record<string, string> = {
    open:        'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    quoted:      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    accepted:    'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    scheduled:   'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    in_progress: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    completed:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    cancelled:   'bg-muted text-muted-foreground',
    declined:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };
  const cls = colorMap[status] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md leading-none ${cls}`}>
      {t(`trade.history.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradeClientPage({
  params,
}: {
  params: Promise<{ profileId: string; clientId: string }>;
}) {
  const { profileId, clientId } = useParams() as { profileId: string; clientId: string };
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { setActiveProfileId } = useBookingProfile();

  const [client, setClient] = useState<TradeClient | null>(null);
  const [history, setHistory] = useState<HistoryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (!user || !clientId) return;
    setActiveProfileId(profileId);
    loadClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clientId]);

  async function loadClient() {
    setLoading(true);
    const [clientRes, historyRes] = await Promise.all([
      (supabase as any).rpc('get_trade_client', { p_client_id: clientId }),
      (supabase as any).rpc('get_trade_client_history', {
        p_client_id:   clientId,
        p_business_id: profileId,
      }),
    ]);
    if (clientRes.data?.ok) {
      setClient(clientRes.data.data as TradeClient);
    }
    if (Array.isArray(historyRes.data)) {
      setHistory(historyRes.data as HistoryJob[]);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm(t('trade.clients.deleteConfirm'))) return;
    setDeletingClient(true);
    const { data } = await (supabase as any).rpc('delete_trade_client', { p_client_id: clientId });
    setDeletingClient(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.clients.deleted'));
    router.push(`/booking/trade/${profileId}/clients`);
  }

  function handleClientSaved(updated: Partial<TradeClient>) {
    setClient((prev) => prev ? { ...prev, ...updated } : prev);
    setEditing(false);
  }

  function handleAssetSaved(asset: Asset) {
    setClient((prev) => {
      if (!prev) return prev;
      const exists = prev.assets.some((a) => a.id === asset.id);
      const assets = exists
        ? prev.assets.map((a) => a.id === asset.id ? asset : a)
        : [asset, ...prev.assets];
      return { ...prev, assets };
    });
    setShowAssetForm(false);
    setEditingAsset(null);
  }

  async function deleteAsset(assetId: string) {
    if (!confirm(t('trade.assets.deleteConfirm'))) return;
    const { data } = await (supabase as any).rpc('delete_trade_asset', { p_asset_id: assetId });
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.assets.deleted'));
    setClient((prev) => prev ? { ...prev, assets: prev.assets.filter((a) => a.id !== assetId) } : prev);
  }

  async function handleLink() {
    if (!linkEmail.trim()) return;
    setLinking(true);
    const { data } = await (supabase as any).rpc('link_trade_client_to_user', {
      p_client_id: clientId,
      p_email:     linkEmail.trim(),
    });
    setLinking(false);
    if (!data?.ok) {
      const errKey = data?.error === 'user_not_found' ? 'trade.link.notFound' : 'common.error.generic';
      toast.error(t(errKey as Parameters<typeof t>[0]));
      return;
    }
    toast.success(t('trade.link.linked.success'));
    setLinkEmail('');
    setClient((prev) => prev ? { ...prev, linked_user_id: data.user_id, linked_user_name: data.name } : prev);
  }

  async function handleUnlink() {
    setUnlinking(true);
    const { data } = await (supabase as any).rpc('unlink_trade_client_from_user', {
      p_client_id: clientId,
    });
    setUnlinking(false);
    if (!data?.ok) { toast.error(data?.error ?? 'error'); return; }
    toast.success(t('trade.link.unlinked.success'));
    setClient((prev) => prev ? { ...prev, linked_user_id: null, linked_user_name: null } : prev);
  }

  if (loading) {
    return (
      <TradeDashboardLayout profileId={profileId} active="clients">
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </TradeDashboardLayout>
    );
  }

  if (!client) {
    return (
      <TradeDashboardLayout profileId={profileId} active="clients">
        <p className="text-sm text-muted-foreground text-center py-12">
          {t('trade.clients.empty')}
        </p>
      </TradeDashboardLayout>
    );
  }

  return (
    <TradeDashboardLayout profileId={profileId} active="clients">
      {/* Back button */}
      <button
        onClick={() => router.push(`/booking/trade/${profileId}/clients`)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('trade.clients.backToList')}
      </button>

      {/* Edit form */}
      {editing ? (
        <div className="mb-4">
          <EditClientForm
            client={client}
            onSaved={handleClientSaved}
            onCancel={() => setEditing(false)}
            t={t}
          />
        </div>
      ) : (
        <>
          {/* Header card */}
          <div className="border border-border rounded-2xl p-4 bg-card mb-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-blue-700 dark:text-blue-300 uppercase">
                  {client.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-foreground leading-tight">{client.name}</h1>
                {client.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {client.tags.map((tag) => (
                      <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deletingClient}
                  className="p-2 rounded-xl hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                >
                  {deletingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-col gap-2">
              {(client.phone || client.whatsapp || client.viber || client.email) ? (
                <>
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      {client.phone}
                    </a>
                  )}
                  {client.whatsapp && (
                    <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <MessageCircle className="w-4 h-4 text-green-500 shrink-0" />
                      WhatsApp: {client.whatsapp}
                    </a>
                  )}
                  {client.viber && (
                    <a href={`viber://chat?number=${client.viber.replace(/\D/g, '')}`}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <MessageCircle className="w-4 h-4 text-purple-500 shrink-0" />
                      Viber: {client.viber}
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      {client.email}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('trade.clients.noContact')}</p>
              )}
              {client.address && (
                <div className="flex items-start gap-2 text-sm text-foreground mt-1">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>{client.address}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t('trade.clients.notes')}</p>
                <p className="text-sm text-foreground whitespace-pre-line">{client.notes}</p>
              </div>
            )}

            {/* GigZone Link */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Link className="w-3 h-3" />
                {t('trade.link.title')}
              </p>
              {client.linked_user_id ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-green-700 dark:text-green-300">
                        {(client.linked_user_name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{client.linked_user_name}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">{t('trade.link.linked')}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUnlink}
                    disabled={unlinking}
                    className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={t('trade.link.unlink')}
                  >
                    {unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={linkEmail}
                    onChange={e => setLinkEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleLink(); }}
                    placeholder={t('trade.link.emailPh')}
                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    onClick={handleLink}
                    disabled={linking || !linkEmail.trim()}
                    className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    {linking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                    {t('trade.link.link')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Assets section ────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            {t('trade.assets.title')}
            {client.assets.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({client.assets.length})</span>
            )}
          </h2>
          {!showAssetForm && (
            <button
              onClick={() => { setEditingAsset(null); setShowAssetForm(true); }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('trade.assets.add')}
            </button>
          )}
        </div>

        {showAssetForm && (
          <div className="mb-3">
            <AssetForm
              businessId={profileId}
              clientId={clientId}
              editing={editingAsset}
              onSaved={handleAssetSaved}
              onCancel={() => { setShowAssetForm(false); setEditingAsset(null); }}
              t={t}
            />
          </div>
        )}

        {client.assets.length === 0 && !showAssetForm ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t('trade.assets.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {client.assets.map((asset) => (
              <div key={asset.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{asset.name}</p>
                  {asset.asset_type && (
                    <p className="text-xs text-muted-foreground">
                      {t(`trade.assets.type.${asset.asset_type}` as Parameters<typeof t>[0])}
                      {asset.location && ` · ${asset.location}`}
                    </p>
                  )}
                  {asset.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{asset.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingAsset(asset); setShowAssetForm(true); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteAsset(asset.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── History section ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-muted-foreground" />
          {t('trade.history.title')}
          {history.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({history.length})</span>
          )}
        </h2>

        {history.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl">
            <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t('trade.history.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((job) => (
              <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                  {job.scheduled_start && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.scheduled_start).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job.invoice_amount != null && (
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      {job.invoice_amount.toFixed(2)}
                    </span>
                  )}
                  <StatusBadge status={job.status} t={t} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TradeDashboardLayout>
  );
}
