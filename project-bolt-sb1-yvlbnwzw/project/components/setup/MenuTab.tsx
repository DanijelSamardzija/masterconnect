'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { GigSelect } from '@/components/ui/gig-select';

type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};
type ModifierGroup = {
  id: string;
  item_id: string;
  name: string;
  selection_type: string;
  is_required: boolean;
};
type ModifierOption = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  is_active: boolean;
};

function labelInput(label: string, children: React.ReactNode) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function MenuTab({ businessId }: { businessId: string }) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modifierOptions, setModifierOptions] = useState<ModifierOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Item form
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  // Expanded item for modifiers
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Modifier group form
  const [showGroupForm, setShowGroupForm] = useState<string | null>(null); // item id
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('multiple');
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupSaving, setGroupSaving] = useState(false);

  // Modifier option form
  const [showOptionForm, setShowOptionForm] = useState<string | null>(null); // group id
  const [optionName, setOptionName] = useState('');
  const [optionPrice, setOptionPrice] = useState('0');
  const [optionSaving, setOptionSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [catRes, itemRes, groupRes, optRes] = await Promise.all([
      (supabase as any).from('menu_categories').select('*').eq('business_id', businessId).order('sort_order'),
      (supabase as any).from('menu_items').select('*').eq('business_id', businessId).order('sort_order'),
      (supabase as any).from('menu_modifier_groups').select('*').order('sort_order'),
      (supabase as any).from('menu_modifier_options').select('*').order('sort_order'),
    ]);
    setCategories(catRes.data ?? []);
    setItems(itemRes.data ?? []);
    setModifierGroups(groupRes.data ?? []);
    setModifierOptions(optRes.data ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  // ── Categories ──────────────────────────────────────────────────────────────
  async function saveCategory() {
    if (!catName.trim()) return;
    setCatSaving(true);
    if (editingCat) {
      await (supabase as any).from('menu_categories').update({ name: catName.trim() }).eq('id', editingCat.id);
    } else {
      await (supabase as any).from('menu_categories').insert({ business_id: businessId, name: catName.trim(), sort_order: categories.length });
    }
    setCatSaving(false);
    setShowCatForm(false);
    setEditingCat(null);
    setCatName('');
    load();
  }

  async function deleteCategory(id: string) {
    if (!confirm('Obrisati kategoriju?')) return;
    await (supabase as any).from('menu_categories').delete().eq('id', id);
    load();
  }

  // ── Items ───────────────────────────────────────────────────────────────────
  function openAddItem() {
    setEditingItem(null);
    setItemName(''); setItemDesc(''); setItemPrice(''); setItemCategoryId(''); setItemImageUrl('');
    setShowItemForm(true);
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item);
    setItemName(item.name);
    setItemDesc(item.description ?? '');
    setItemPrice(String(item.price));
    setItemCategoryId(item.category_id ?? '');
    setItemImageUrl(item.image_url ?? '');
    setShowItemForm(true);
  }

  async function saveItem() {
    if (!itemName.trim() || !itemPrice) return;
    setItemSaving(true);
    const payload = {
      business_id: businessId,
      name: itemName.trim(),
      description: itemDesc.trim() || null,
      price: parseFloat(itemPrice),
      category_id: itemCategoryId || null,
      image_url: itemImageUrl.trim() || null,
      sort_order: editingItem?.sort_order ?? items.length,
    };
    if (editingItem) {
      await (supabase as any).from('menu_items').update(payload).eq('id', editingItem.id);
    } else {
      await (supabase as any).from('menu_items').insert(payload);
    }
    setItemSaving(false);
    toast.success(t('menu.item.saved'));
    setShowItemForm(false);
    setEditingItem(null);
    load();
  }

  async function deleteItem(id: string) {
    if (!confirm('Obrisati stavku?')) return;
    await (supabase as any).from('menu_items').delete().eq('id', id);
    load();
  }

  // ── Modifier groups ─────────────────────────────────────────────────────────
  async function saveGroup(itemId: string) {
    if (!groupName.trim()) return;
    setGroupSaving(true);
    await (supabase as any).from('menu_modifier_groups').insert({
      item_id: itemId,
      name: groupName.trim(),
      selection_type: groupType,
      is_required: groupRequired,
      sort_order: modifierGroups.filter(g => g.item_id === itemId).length,
    });
    setGroupSaving(false);
    setShowGroupForm(null);
    setGroupName(''); setGroupType('multiple'); setGroupRequired(false);
    load();
  }

  async function deleteGroup(id: string) {
    await (supabase as any).from('menu_modifier_groups').delete().eq('id', id);
    load();
  }

  // ── Modifier options ─────────────────────────────────────────────────────────
  async function saveOption(groupId: string) {
    if (!optionName.trim()) return;
    setOptionSaving(true);
    await (supabase as any).from('menu_modifier_options').insert({
      group_id: groupId,
      name: optionName.trim(),
      price_delta: parseFloat(optionPrice) || 0,
      sort_order: modifierOptions.filter(o => o.group_id === groupId).length,
    });
    setOptionSaving(false);
    setShowOptionForm(null);
    setOptionName(''); setOptionPrice('0');
    load();
  }

  async function deleteOption(id: string) {
    await (supabase as any).from('menu_modifier_options').delete().eq('id', id);
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
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm font-medium">{t('menu.setup.title')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('menu.setup.desc')}</p>
      </div>

      {/* ── Categories ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('menu.category.name')}</span>
          <button
            onClick={() => { setShowCatForm(true); setEditingCat(null); setCatName(''); }}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="w-3 h-3" /> {t('menu.category.add')}
          </button>
        </div>

        {categories.length === 0 && !showCatForm && (
          <p className="text-xs text-muted-foreground">{t('menu.category.empty')}</p>
        )}

        {categories.map((cat) => (
          <div key={cat.id} className="border border-border rounded-lg px-3 py-2 flex items-center gap-2 bg-card">
            <span className="text-sm flex-1">{cat.name}</span>
            <button onClick={() => { setEditingCat(cat); setCatName(cat.name); setShowCatForm(true); }}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteCategory(cat.id)}
              className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {showCatForm && (
          <div className="border border-border rounded-xl p-3 flex gap-2 bg-card">
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder={t('menu.category.namePh')}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={saveCategory}
              disabled={catSaving || !catName.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {catSaving ? '...' : t('menu.category.save')}
            </button>
            <button onClick={() => { setShowCatForm(false); setEditingCat(null); }}
              className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* ── Menu Items ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('menu.item.add').replace('Dodaj ', '').replace('Add ', '')}</span>
          <button
            onClick={openAddItem}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="w-3 h-3" /> {t('menu.item.add')}
          </button>
        </div>

        {showItemForm && (
          <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-card">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{editingItem ? t('menu.item.save') : t('menu.item.add')}</span>
              <button onClick={() => { setShowItemForm(false); setEditingItem(null); }}
                className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {labelInput(t('menu.item.name'),
                <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)}
                  placeholder={t('menu.item.namePh')}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              )}
              {labelInput(t('menu.item.price'),
                <input type="number" min="0" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              )}
            </div>

            {labelInput(t('menu.item.desc'),
              <textarea value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} rows={2}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            )}

            <div className="grid grid-cols-2 gap-3">
              {labelInput(t('menu.item.category'),
                <GigSelect
                  value={itemCategoryId}
                  onChange={setItemCategoryId}
                  className="w-full"
                  options={[
                    { value: '', label: '—' },
                    ...categories.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />
              )}
              {labelInput(t('menu.item.image'),
                <input type="url" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              )}
            </div>

            <button onClick={saveItem} disabled={itemSaving || !itemName.trim() || !itemPrice}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 mt-1">
              {itemSaving ? '...' : t('menu.item.save')}
            </button>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              {item.image_url && (
                <img src={item.image_url} alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  {categories.find(c => c.id === item.category_id) && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground shrink-0">
                      {categories.find(c => c.id === item.category_id)?.name}
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-primary">{item.price.toFixed(2)}</span>
              </div>
              <button onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
                {expandedItemId === item.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              <button onClick={() => openEditItem(item)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => deleteItem(item.id)}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Modifier groups */}
            {expandedItemId === item.id && (
              <div className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-2 bg-muted/20">
                <span className="text-xs font-semibold text-muted-foreground">{t('menu.modifier.group.name')}</span>

                {modifierGroups.filter(g => g.item_id === item.id).map((group) => (
                  <div key={group.id} className="border border-border rounded-lg p-2.5 flex flex-col gap-1.5 bg-card">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium flex-1">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.selection_type === 'single'
                          ? t('menu.modifier.group.type.single')
                          : t('menu.modifier.group.type.multiple')}
                      </span>
                      {group.is_required && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                          {t('menu.modifier.group.required')}
                        </span>
                      )}
                      <button onClick={() => deleteGroup(group.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5 rounded-md hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Options */}
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {modifierOptions.filter(o => o.group_id === group.id).map((opt) => (
                        <div key={opt.id} className="flex items-center gap-1 bg-muted rounded-md px-2 py-0.5">
                          <span className="text-xs">{opt.name}</span>
                          {opt.price_delta !== 0 && (
                            <span className="text-xs text-primary">+{opt.price_delta.toFixed(2)}</span>
                          )}
                          <button onClick={() => deleteOption(opt.id)}
                            className="text-muted-foreground hover:text-destructive ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {showOptionForm === group.id ? (
                      <div className="flex gap-2 mt-1">
                        <input type="text" value={optionName} onChange={(e) => setOptionName(e.target.value)}
                          placeholder={t('menu.modifier.option.namePh')}
                          className="flex-1 border border-border rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                        <input type="number" min="0" step="0.01" value={optionPrice} onChange={(e) => setOptionPrice(e.target.value)}
                          placeholder="0"
                          className="w-16 border border-border rounded-md px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                        <button onClick={() => saveOption(group.id)} disabled={optionSaving || !optionName.trim()}
                          className="px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-50">
                          {optionSaving ? '...' : '+'}
                        </button>
                        <button onClick={() => { setShowOptionForm(null); setOptionName(''); setOptionPrice('0'); }}
                          className="text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setShowOptionForm(group.id)}
                        className="text-xs text-primary hover:underline text-left w-fit">
                        + {t('menu.modifier.option.add')}
                      </button>
                    )}
                  </div>
                ))}

                {showGroupForm === item.id ? (
                  <div className="border border-dashed border-border rounded-lg p-2.5 flex flex-col gap-2 bg-card">
                    <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
                      placeholder={t('menu.modifier.group.namePh')}
                      className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    <div className="flex items-center gap-3">
                      <GigSelect
                        size="sm"
                        value={groupType}
                        onChange={setGroupType}
                        className="flex-1"
                        options={[
                          { value: 'multiple', label: t('menu.modifier.group.type.multiple') },
                          { value: 'single', label: t('menu.modifier.group.type.single') },
                        ]}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={groupRequired} onChange={(e) => setGroupRequired(e.target.checked)}
                          className="rounded" />
                        {t('menu.modifier.group.required')}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveGroup(item.id)} disabled={groupSaving || !groupName.trim()}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                        {groupSaving ? '...' : t('menu.modifier.group.add')}
                      </button>
                      <button onClick={() => { setShowGroupForm(null); setGroupName(''); }}
                        className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowGroupForm(item.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded-lg px-2 py-1.5 w-fit hover:border-primary transition-colors">
                    <Plus className="w-3 h-3" /> {t('menu.modifier.group.add')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {items.length === 0 && !showItemForm && (
          <p className="text-sm text-muted-foreground py-2 text-center">{t('menu.category.empty')}</p>
        )}
      </div>
    </div>
  );
}
