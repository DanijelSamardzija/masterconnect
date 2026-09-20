'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/contexts/language-context';
import { SharePostModal } from '@/components/share-post-modal';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  price_type: string;
  currency: string | null;
};

type Props = {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ServiceSharePicker({ businessId, open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareServiceId, setShareServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !businessId) return;
    setLoading(true);
    (supabase as any)
      .from('service_catalog')
      .select('id, name, duration_minutes, price, price_type, currency')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }: { data: Service[] | null }) => {
        setServices(data ?? []);
        setLoading(false);
      });
  }, [open, businessId]);

  if (!open && !shareServiceId) return null;

  if (shareServiceId) {
    return (
      <SharePostModal
        postId={shareServiceId}
        open={true}
        onOpenChange={(o) => {
          if (!o) {
            setShareServiceId(null);
            onOpenChange(false);
          }
        }}
        urlPath={`/booking/${businessId}/${shareServiceId}`}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl">

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-foreground font-semibold text-base">
              {t('booking.shareService')}
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Service list */}
          <div className="px-5 pb-8 flex flex-col gap-2 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : services.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t('booking.noServices')}
              </p>
            ) : (
              services.map((svc) => {
                const priceStr =
                  svc.price && svc.price > 0 && svc.price_type !== 'negotiable'
                    ? `${svc.price} ${svc.currency ?? ''}`.trim()
                    : svc.price_type === 'free'
                    ? t('setup.services.ptype.free')
                    : svc.price_type === 'negotiable'
                    ? t('setup.services.ptype.negotiable')
                    : null;

                return (
                  <button
                    key={svc.id}
                    onClick={() => setShareServiceId(svc.id)}
                    className="flex items-center justify-between gap-3 w-full px-4 py-3 rounded-2xl bg-muted hover:bg-accent border border-border transition-colors text-left"
                  >
                    <span className="text-sm font-medium text-foreground truncate">{svc.name}</span>
                    <span className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {svc.duration_minutes} min
                      {priceStr && <span className="text-foreground font-medium">{priceStr}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
