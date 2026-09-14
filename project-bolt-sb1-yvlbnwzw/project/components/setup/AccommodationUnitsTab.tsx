'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight, Image } from 'lucide-react';

type AccUnit = {
  id: string;
  name: string;
  unit_type: string;
  capacity: number;
  price_per_night: number;
  price_currency: string;
  description: string | null;
  amenities: string[] | null;
  is_active: boolean;
  sort_order: number;
};

type AccPhoto = {
  id: string;
  unit_id: string;
  url: string;
  caption: string | null;
  sort_order: number;
};

const UNIT_TYPES = ['room', 'apartment', 'suite', 'villa', 'cabin', 'studio'] as const;
const AMENITIES_OPTIONS = ['WiFi', 'Klima', 'Parking', 'TV', 'Kuhinja', 'Balkon', 'Bazen', 'Doručak'];

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function AccommodationUnitsTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage();
  const [units, setUnits] = useState<AccUnit[]>([]);
  const [photos, setPhotos] = useState<AccPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AccUnit | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('room');
  const [capacity, setCapacity] = useState('2');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('BAM');
  const [desc, setDesc] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Photo state
  const [showPhotoForm, setShowPhotoForm] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [unitRes, photoRes] = await Promise.all([
      (supabase as any).from('accommodation_units').select('*').eq('business_id', businessId).order('sort_order'),
      (supabase as any).from('accommodation_photos').select('*').eq('business_id', businessId).order('sort_order'),
    ]);
    setUnits(unitRes.data ?? []);
    setPhotos(photoRes.data ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setName(''); setUnitType('room'); setCapacity('2'); setPrice(''); setCurrency('BAM');
    setDesc(''); setAmenities([]);
    setShowForm(true);
  }

  function openEdit(u: AccUnit) {
    setEditing(u);
    setName(u.name);
    setUnitType(u.unit_type);
    setCapacity(String(u.capacity));
    setPrice(String(u.price_per_night));
    setCurrency(u.price_currency);
    setDesc(u.description ?? '');
    setAmenities(u.amenities ?? []);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  async function save() {
    if (!name.trim() || !price) return;
    setSaving(true);
    const payload = {
      business_id: businessId,
      name: name.trim(),
      unit_type: unitType,
      capacity: parseInt(capacity) || 2,
      price_per_night: parseFloat(price),
      price_currency: currency,
      description: desc.trim() || null,
      amenities: amenities.length > 0 ? amenities : null,
      sort_order: editing?.sort_order ?? units.length,
    };
    if (editing) {
      await (supabase as any).from('accommodation_units').update(payload).eq('id', editing.id);
    } else {
      await (supabase as any).from('accommodation_units').insert(payload);
    }
    setSaving(false);
    toast.success(t('acc.unit.saved'));
    closeForm();
    load();
  }

  async function remove(id: string) {
    if (!confirm('Obrisati smještajnu jedinicu?')) return;
    setDeletingId(id);
    await (supabase as any).from('accommodation_units').delete().eq('id', id);
    setDeletingId(null);
    load();
  }

  async function toggleActive(u: AccUnit) {
    await (supabase as any).from('accommodation_units').update({ is_active: !u.is_active }).eq('id', u.id);
    load();
  }

  async function addPhoto(unitId: string) {
    if (!photoUrl.trim()) return;
    setPhotoSaving(true);
    await (supabase as any).from('accommodation_photos').insert({
      unit_id: unitId,
      business_id: businessId,
      url: photoUrl.trim(),
      caption: photoCaption.trim() || null,
      sort_order: photos.filter((p) => p.unit_id === unitId).length,
    });
    setPhotoSaving(false);
    setShowPhotoForm(null);
    setPhotoUrl(''); setPhotoCaption('');
    load();
  }

  async function deletePhoto(id: string) {
    await (supabase as any).from('accommodation_photos').delete().eq('id', id);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">{t('acc.setup.title')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('acc.setup.desc')}</p>
      </div>

      {units.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-4 text-center">{t('acc.unit.empty')}</p>
      )}

      {units.map((unit) => {
        const unitPhotos = photos.filter((p) => p.unit_id === unit.id);
        return (
          <div key={unit.id} className={`border border-border rounded-xl bg-card overflow-hidden ${!unit.is_active ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3 p-3">
              {unitPhotos[0] ? (
                <img src={unitPhotos[0].url} alt={unit.name}
                  className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Image className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{unit.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                    {t(`acc.unit.type.${unit.unit_type}` as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-xs text-muted-foreground">{unit.capacity} gostiju</span>
                  <span className="text-xs font-semibold text-primary">{unit.price_per_night} {unit.price_currency}</span>
                  {unitPhotos.length > 0 && (
                    <span className="text-xs text-muted-foreground">{unitPhotos.length} foto</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setExpandedId(expandedId === unit.id ? null : unit.id)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
                {expandedId === unit.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <button onClick={() => toggleActive(unit)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  unit.is_active
                    ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                    : 'border-border text-muted-foreground'
                }`}>
                {unit.is_active ? '✓' : '—'}
              </button>
              <button onClick={() => openEdit(unit)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(unit.id)} disabled={deletingId === unit.id}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Photos panel */}
            {expandedId === unit.id && (
              <div className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-2 bg-muted/20">
                <span className="text-xs font-semibold text-muted-foreground">{t('acc.photos.title')}</span>

                <div className="flex flex-wrap gap-2">
                  {unitPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img src={photo.url} alt={photo.caption ?? ''}
                        className="w-16 h-16 rounded-lg object-cover" />
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs items-center justify-center hidden group-hover:flex">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {showPhotoForm === unit.id ? (
                  <div className="flex flex-col gap-2">
                    <input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    <input type="text" value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)}
                      placeholder={t('acc.photos.caption')}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div className="flex gap-2">
                      <button onClick={() => addPhoto(unit.id)} disabled={photoSaving || !photoUrl.trim()}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                        {photoSaving ? '...' : t('acc.photos.save')}
                      </button>
                      <button onClick={() => { setShowPhotoForm(null); setPhotoUrl(''); setPhotoCaption(''); }}
                        className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowPhotoForm(unit.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded-lg px-3 py-2 hover:border-primary transition-colors w-fit">
                    <Plus className="w-3.5 h-3.5" /> {t('acc.photos.add')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showForm && (
        <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{editing ? t('acc.unit.save') : t('acc.unit.add')}</span>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {labelInput(t('acc.unit.name'),
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t('acc.unit.namePh')}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
          )}

          {labelInput(t('acc.unit.type'),
            <div className="flex flex-wrap gap-1.5">
              {UNIT_TYPES.map((ut) => (
                <button key={ut} type="button" onClick={() => setUnitType(ut)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    unitType === ut
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground'
                  }`}>
                  {t(`acc.unit.type.${ut}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {labelInput(t('acc.unit.capacity'),
              <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
            {labelInput(t('acc.unit.price'),
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
            {labelInput(t('acc.unit.currency'),
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                {['BAM', 'EUR', 'HRK', 'RSD', 'USD', 'GBP'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {labelInput(t('acc.unit.desc'),
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
          )}

          {labelInput(t('acc.unit.amenities'),
            <div className="flex flex-wrap gap-1.5">
              {AMENITIES_OPTIONS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    amenities.includes(a)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary'
                  }`}>
                  {t(`acc.amenity.${a}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          )}

          <button onClick={save} disabled={saving || !name.trim() || !price}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mt-1">
            {saving ? '...' : t('acc.unit.save')}
          </button>
        </div>
      )}

      {!showForm && (
        <button onClick={openAdd}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Plus className="w-4 h-4" />
          {t('acc.unit.add')}
        </button>
      )}
    </div>
  );
}
