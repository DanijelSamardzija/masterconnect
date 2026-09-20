'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';

export type BookingProfileSummary = {
  id: string;
  profile_type: 'appointment' | 'accommodation' | 'restaurant' | 'tradespeople' | 'food_order';
  name: string;
  avatar_url: string | null;
  is_active: boolean;
  location_count: number;
  service_count: number;
  unit_count: number;
  created_at: string;
};

export type BookingProfileContextValue = {
  profiles: BookingProfileSummary[];
  activeProfileId: string | null;
  activeProfile: BookingProfileSummary | null;
  setActiveProfileId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
};

const SESSION_KEY = 'bk_active_profile';

const BookingProfileContext = createContext<BookingProfileContextValue>({
  profiles: [],
  activeProfileId: null,
  activeProfile: null,
  setActiveProfileId: () => {},
  loading: true,
  reload: async () => {},
});

function readStoredProfileId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeStoredProfileId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, id);
    }
  } catch {
    // sessionStorage unavailable (private browsing, etc.) — no-op
  }
}

function resolveActiveId(
  profiles: BookingProfileSummary[],
  candidateId: string | null,
): string | null {
  if (!profiles.length) return null;
  const active = profiles.filter((p) => p.is_active);
  if (!active.length) return null;
  // Prefer stored/requested id if it is still a valid active profile
  if (candidateId && active.some((p) => p.id === candidateId)) return candidateId;
  // Fall back to first active profile — deterministic, no user.id assumption
  return active[0].id;
}

export function BookingProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<BookingProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  const loadProfiles = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const { data, error } = await (supabase as any).rpc('get_my_booking_profiles') as {
        data: { ok: boolean; profiles?: BookingProfileSummary[] } | null;
        error: unknown;
      };

      if (error || !data?.ok) {
        setProfiles([]);
        setActiveProfileIdState(null);
        writeStoredProfileId(null);
        return;
      }

      const fetched: BookingProfileSummary[] = data.profiles ?? [];
      setProfiles(fetched);

      const storedId = readStoredProfileId();
      const resolved = resolveActiveId(fetched, storedId);
      setActiveProfileIdState(resolved);
      writeStoredProfileId(resolved);
    } catch {
      setProfiles([]);
      setActiveProfileIdState(null);
      writeStoredProfileId(null);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Reload when the authenticated user changes
  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setActiveProfileIdState(null);
      writeStoredProfileId(null);
      setLoading(false);
      return;
    }
    loadProfiles();
  }, [user, loadProfiles]);

  const setActiveProfileId = useCallback((id: string) => {
    // Only accept ids that exist in the loaded profiles
    if (!profiles.some((p) => p.id === id && p.is_active)) return;
    setActiveProfileIdState(id);
    writeStoredProfileId(id);
  }, [profiles]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <BookingProfileContext.Provider
      value={{
        profiles,
        activeProfileId,
        activeProfile,
        setActiveProfileId,
        loading,
        reload: loadProfiles,
      }}
    >
      {children}
    </BookingProfileContext.Provider>
  );
}

export function useBookingProfile(): BookingProfileContextValue {
  return useContext(BookingProfileContext);
}
