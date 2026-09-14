'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingCart, Plus, Minus, X, Check, Truck, Package } from 'lucide-react';

type Business = { id: string; name: string; avatar_url: string | null; city: string | null };
type OrderSettings = {
  offers_delivery: boolean;
  offers_pickup: boolean;
  delivery_fee: number;
  min_order_amount: number;
  estimated_prep_minutes: number;
  currency: string;
  is_accepting_orders: boolean;
};
type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
};
type ModGroup = { id: string; item_id: string; name: string; selection_type: string; is_required: boolean };
type ModOption = { id: string; group_id: string; name: string; price_delta: number };

type CartItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: { group_name: string; option_name: string; price_delta: number }[];
  lineTotal: number;
};

export default function FoodOrderPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<OrderSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<ModGroup[]>([]);
  const [options, setOptions] = useState<ModOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modifier modal
  const [modItem, setModItem] = useState<MenuItem | null>(null);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({});

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Checkout
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bizRes, settingsRes, catRes, itemRes, groupRes, optRes] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url, city').eq('id', businessId).single(),
        (supabase as any).from('food_order_settings').select('*').eq('business_id', businessId).maybeSingle(),
        (supabase as any).from('menu_categories').select('id, name').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
        (supabase as any).from('menu_items').select('id, category_id, name, description, price, image_url').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
        (supabase as any).from('menu_modifier_groups').select('*').order('sort_order'),
        (supabase as any).from('menu_modifier_options').select('*').eq('is_active', true).order('sort_order'),
      ]);
      setBusiness(bizRes.data);
      setSettings(settingsRes.data);
      setCategories(catRes.data ?? []);
      setItems(itemRes.data ?? []);
      setGroups(groupRes.data ?? []);
      setOptions(optRes.data ?? []);
      setLoading(false);
    })();
    if (user) {
      supabase.from('profiles').select('name').eq('id', user.id).single().then(({ data }) => {
        if (data?.name) setClientName(data.name);
      });
    }
  }, [businessId, user]);

  function getItemGroups(itemId: string) {
    return groups.filter((g) => g.item_id === itemId);
  }

  function getGroupOptions(groupId: string) {
    return options.filter((o) => o.group_id === groupId);
  }

  function openItem(item: MenuItem) {
    const itemGroups = getItemGroups(item.id);
    if (itemGroups.length === 0) {
      // No modifiers — add directly
      addToCart(item, []);
    } else {
      setModItem(item);
      setSelectedMods({});
    }
  }

  function toggleMod(groupId: string, optionId: string, isSingle: boolean) {
    setSelectedMods((prev) => {
      const current = prev[groupId] ?? [];
      if (isSingle) return { ...prev, [groupId]: [optionId] };
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      };
    });
  }

  function confirmModifiers() {
    if (!modItem) return;
    const mods: CartItem['modifiers'] = [];
    for (const group of getItemGroups(modItem.id)) {
      for (const optId of selectedMods[group.id] ?? []) {
        const opt = options.find((o) => o.id === optId);
        if (opt) mods.push({ group_name: group.name, option_name: opt.name, price_delta: opt.price_delta });
      }
    }
    addToCart(modItem, mods);
    setModItem(null);
  }

  function addToCart(item: MenuItem, mods: CartItem['modifiers']) {
    const modExtra = mods.reduce((sum, m) => sum + m.price_delta, 0);
    const lineTotal = item.price + modExtra;
    setCart((prev) => {
      // Check if same item+mods already in cart
      const key = item.id + JSON.stringify(mods);
      const existing = prev.find((ci) => ci.itemId + JSON.stringify(ci.modifiers) === key);
      if (existing) {
        return prev.map((ci) =>
          ci.itemId + JSON.stringify(ci.modifiers) === key
            ? { ...ci, quantity: ci.quantity + 1, lineTotal: lineTotal * (ci.quantity + 1) }
            : ci
        );
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price + modExtra, quantity: 1, modifiers: mods, lineTotal }];
    });
    toast.success(`${item.name} dodano u korpu`);
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function changeQty(idx: number, delta: number) {
    setCart((prev) => prev.map((ci, i) => {
      if (i !== idx) return ci;
      const qty = ci.quantity + delta;
      if (qty <= 0) return ci;
      return { ...ci, quantity: qty, lineTotal: ci.price * qty };
    }));
  }

  const subtotal = cart.reduce((s, ci) => s + ci.lineTotal, 0);
  const deliveryFee = orderType === 'delivery' ? (settings?.delivery_fee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const currency = settings?.currency ?? 'BAM';

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || !clientName.trim()) return;
    setSubmitting(true);
    const { data: order, error } = await (supabase as any).from('food_orders').insert({
      business_id: businessId,
      client_id: user?.id ?? null,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim() || null,
      client_address: orderType === 'delivery' ? clientAddress.trim() : null,
      order_type: orderType,
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: total,
      notes: notes.trim() || null,
    }).select('id').single();

    if (error || !order) { toast.error('Greška. Pokušajte ponovo.'); setSubmitting(false); return; }

    const orderItems = cart.map((ci) => ({
      order_id: order.id,
      item_id: ci.itemId,
      item_name: ci.name,
      unit_price: ci.price,
      quantity: ci.quantity,
      selected_modifiers: ci.modifiers.length > 0 ? ci.modifiers : null,
      item_total: ci.lineTotal,
    }));

    await (supabase as any).from('food_order_items').insert(orderItems);
    setSubmitting(false);
    setSuccess(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!business || !settings?.is_accepting_orders) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-lg font-semibold">{business?.name ?? 'Restoran'}</p>
        <p className="text-muted-foreground text-sm text-center">{t('order.closed')}</p>
        <button onClick={() => router.back()} className="text-primary text-sm hover:underline">Nazad</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-semibold text-center">{t('order.success')}</h1>
        <p className="text-sm text-muted-foreground">{business.name}</p>
        <button onClick={() => router.push('/')}
          className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
          Nazad na početnu
        </button>
      </div>
    );
  }

  const categoryItems = (catId: string | null) => items.filter((it) => it.category_id === catId);
  const uncategorized = items.filter((it) => !it.category_id);

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{business.name}</h1>
          </div>
          <button onClick={() => setShowCart(true)} className="relative p-2 rounded-xl border border-border hover:bg-accent">
            <ShoppingCart className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                {cart.reduce((s, ci) => s + ci.quantity, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Menu */}
        {categories.map((cat) => {
          const catItems = categoryItems(cat.id);
          if (catItems.length === 0) return null;
          return (
            <div key={cat.id} className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{cat.name}</h2>
              <div className="flex flex-col gap-2">
                {catItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} currency={currency} onAdd={() => openItem(item)} t={t} />
                ))}
              </div>
            </div>
          );
        })}

        {uncategorized.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-col gap-2">
              {uncategorized.map((item) => (
                <MenuItemCard key={item.id} item={item} currency={currency} onAdd={() => openItem(item)} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modifier modal */}
      {modItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setModItem(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80dvh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b border-border flex items-center justify-between px-4 py-3 rounded-t-2xl z-10">
              <h3 className="text-base font-semibold">{modItem.name}</h3>
              <button onClick={() => setModItem(null)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 flex flex-col gap-4">
              {getItemGroups(modItem.id).map((group) => (
                <div key={group.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{group.name}</span>
                    {group.is_required && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                        Obavezno
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {getGroupOptions(group.id).map((opt) => {
                      const isSelected = (selectedMods[group.id] ?? []).includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleMod(group.id, opt.id, group.selection_type === 'single')}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border bg-card hover:border-primary/50'
                          }`}
                        >
                          <span className="text-sm">{opt.name}</span>
                          <div className="flex items-center gap-2">
                            {opt.price_delta !== 0 && (
                              <span className="text-xs text-primary font-medium">+{opt.price_delta.toFixed(2)} {currency}</span>
                            )}
                            {isSelected && <Check className="w-4 h-4 text-primary" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={confirmModifiers}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 mt-2">
                {t('order.add')} — {(modItem.price + getItemGroups(modItem.id).reduce((s, g) => {
                  return s + (selectedMods[g.id] ?? []).reduce((gs, optId) => {
                    const opt = options.find((o) => o.id === optId);
                    return gs + (opt?.price_delta ?? 0);
                  }, 0);
                }, 0)).toFixed(2)} {currency}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart / Checkout drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowCart(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90dvh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b border-border flex items-center justify-between px-4 py-3 rounded-t-2xl z-10">
              <h3 className="text-base font-semibold">{t('order.cart')}</h3>
              <button onClick={() => setShowCart(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={placeOrder} className="px-4 py-4 flex flex-col gap-4">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('order.cart.empty')}</p>
              ) : (
                <>
                  {/* Cart items */}
                  <div className="flex flex-col gap-2">
                    {cart.map((ci, idx) => (
                      <div key={idx} className="flex items-start gap-3 border border-border rounded-xl p-3 bg-card">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{ci.name}</p>
                          {ci.modifiers.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ci.modifiers.map((m) => m.option_name).join(', ')}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-primary mt-1">{ci.lineTotal.toFixed(2)} {currency}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => changeQty(idx, -1)}
                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-medium w-5 text-center">{ci.quantity}</span>
                          <button type="button" onClick={() => changeQty(idx, 1)}
                            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <Plus className="w-3 h-3" />
                          </button>
                          <button type="button" onClick={() => removeFromCart(idx)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order type */}
                  {(settings.offers_pickup || settings.offers_delivery) && (
                    <div className="flex gap-2">
                      {settings.offers_pickup && (
                        <button type="button" onClick={() => setOrderType('pickup')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                            orderType === 'pickup' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                          }`}>
                          <Package className="w-4 h-4" /> {t('order.type.pickup')}
                        </button>
                      )}
                      {settings.offers_delivery && (
                        <button type="button" onClick={() => setOrderType('delivery')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                            orderType === 'delivery' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                          }`}>
                          <Truck className="w-4 h-4" /> {t('order.type.delivery')}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Contact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('order.name')}</label>
                      <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} required
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('order.phone')}</label>
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>

                  {orderType === 'delivery' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted-foreground">{t('order.address')}</label>
                      <input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} required
                        className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">{t('order.notes')}</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                  </div>

                  {/* Summary */}
                  <div className="border-t border-border pt-3 flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('order.subtotal')}</span>
                      <span>{subtotal.toFixed(2)} {currency}</span>
                    </div>
                    {orderType === 'delivery' && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('order.delivery_fee')}</span>
                        <span>{deliveryFee.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-semibold">
                      <span>{t('order.total')}</span>
                      <span className="text-primary">{total.toFixed(2)} {currency}</span>
                    </div>
                  </div>

                  <button type="submit" disabled={submitting || !clientName.trim()}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                    {submitting ? '...' : t('order.submit')}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Sticky cart button */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="max-w-lg mx-auto">
            <button onClick={() => setShowCart(true)}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 flex items-center justify-between px-5">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                {cart.reduce((s, ci) => s + ci.quantity, 0)} stavki
              </span>
              <span>{total.toFixed(2)} {currency}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItemCard({ item, currency, onAdd, t }: {
  item: MenuItem;
  currency: string;
  onAdd: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="border border-border rounded-xl bg-card flex items-center gap-3 p-3">
      {item.image_url && (
        <img src={item.image_url} alt={item.name}
          className="w-16 h-16 rounded-lg object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.name}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
        )}
        <p className="text-sm font-semibold text-primary mt-1">{item.price.toFixed(2)} {currency}</p>
      </div>
      <button
        onClick={onAdd}
        className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
