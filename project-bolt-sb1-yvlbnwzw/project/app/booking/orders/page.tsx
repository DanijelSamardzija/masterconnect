'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/protected-route';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { useLanguage } from '@/lib/contexts/language-context';
import { useBookingAccess } from '@/lib/hooks/use-booking-access';
import { BookingBetaBanner } from '@/components/booking-beta-banner';
import { ChevronRight, Calendar, ShoppingBag, MapPin, Package } from 'lucide-react';

type OrderItem = {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  selected_modifiers: { group: string; option: string; price_delta: number }[] | null;
};

type Order = {
  id: string;
  order_type: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  client_name: string | null;
  client_phone: string | null;
  delivery_address: string | null;
  notes: string | null;
  currency: string;
  created_at: string;
  items?: OrderItem[];
};

const STATUS_FLOW: Record<string, string> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    accepted:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    ready:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    delivered: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? map.pending}`}>
      {t(`order.dash.status.${status}` as Parameters<typeof t>[0])}
    </span>
  );
}

export default function OrdersDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { hasAccess, loading: authLoading } = useBookingAccess();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('food_orders')
      .select('*')
      .eq('business_id', user.id)
      .gte('created_at', filterDate + 'T00:00:00')
      .lte('created_at', filterDate + 'T23:59:59')
      .order('created_at', { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }, [user, filterDate]);

  useEffect(() => { load(); }, [load]);

  async function loadItems(orderId: string) {
    const { data } = await (supabase as any)
      .from('food_order_items')
      .select('*')
      .eq('order_id', orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, items: data ?? [] } : o))
    );
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id);
    await (supabase as any).from('food_orders').update({ status: newStatus }).eq('id', id);
    setUpdatingId(null);
    load();
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const order = orders.find((o) => o.id === id);
      if (!order?.items) loadItems(id);
    }
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
            <h1 className="text-xl font-semibold flex-1">{t('order.dash.title')}</h1>
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}
              className="text-xs text-primary hover:underline">
              Danas
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('order.dash.empty')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-border rounded-xl bg-card overflow-hidden">
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="w-full text-left p-4 flex items-start justify-between gap-2"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{order.client_name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                          order.order_type === 'delivery'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {t(`order.dash.type.${order.order_type}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {order.client_phone && <span>{order.client_phone}</span>}
                        <span className="font-medium text-foreground">
                          {order.total_amount.toFixed(2)} {order.currency}
                        </span>
                        <span>{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                      {order.delivery_address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-3 h-3" /> {order.delivery_address}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={order.status} t={t} />
                  </button>

                  {/* Expanded items */}
                  {expandedId === order.id && (
                    <div className="border-t border-border bg-muted/30 px-4 pb-4 pt-3 flex flex-col gap-3">
                      {!order.items ? (
                        <div className="flex justify-center py-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-sm">
                                  {item.quantity}× {item.item_name}
                                </span>
                                {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {item.selected_modifiers.map((m, i) => (
                                      <span key={i} className="text-xs bg-background border border-border px-1.5 py-0.5 rounded-md">
                                        {m.option}
                                        {m.price_delta > 0 && <span className="text-muted-foreground"> +{m.price_delta}</span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {(item.unit_price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                          {order.notes && (
                            <p className="text-xs text-muted-foreground italic mt-1 pt-2 border-t border-border">
                              {order.notes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div className="flex gap-2">
                          {STATUS_FLOW[order.status] && (
                            <button
                              onClick={() => updateStatus(order.id, STATUS_FLOW[order.status])}
                              disabled={updatingId === order.id}
                              className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                            >
                              {updatingId === order.id ? '...' : t(`order.dash.${STATUS_FLOW[order.status]}` as Parameters<typeof t>[0])}
                            </button>
                          )}
                          <button
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            disabled={updatingId === order.id}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                          >
                            {t('order.dash.cancel')}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
