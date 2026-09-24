'use client';

import { X, MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/contexts/language-context';

export type LocationOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

interface Props {
  open: boolean;
  locations: LocationOption[];
  onPick: (locationId: string) => void;
  onCancel: () => void;
}

export function LocationPickerSheet({ open, locations, onPick, onCancel }: Props) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="bg-background border border-border rounded-t-3xl overflow-hidden shadow-2xl">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-foreground font-semibold text-base">
              {t('booking.sharePickLocation')}
            </span>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-8 flex flex-col gap-2 max-h-72 overflow-y-auto">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => onPick(loc.id)}
                className="flex items-start gap-3 w-full px-4 py-3 rounded-2xl bg-muted hover:bg-accent border border-border transition-colors text-left"
              >
                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{loc.name}</p>
                  {(loc.city || loc.country) && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {[loc.city, loc.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
