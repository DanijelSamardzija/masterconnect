'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { getCachedData, setCachedData, clearCache } from '@/lib/cache-utils';
import { setRateLimitHit, isInRateLimitCooldown } from '@/lib/rate-limit-handler';
import { startTokenRefreshManager, stopTokenRefreshManager } from '@/lib/supabase/token-refresh-manager';

type Profile = {
  id: string;
  name: string;
  email: string;
  account_type: 'professional' | 'customer';
  is_admin: boolean;
  is_banned?: boolean;
  onboarding_completed?: boolean;
  created_at: string;
  city?: string;
  country?: string;
  category?: string;
  bio?: string;
  phone?: string;
  skills?: string[];
  avatar_url?: string;
  cover_url?: string;
  website_url?: string;
  show_phone?: boolean;
  show_email?: boolean;
  last_seen?: string;
  preferred_language?: string;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const fetchProfile = async (userId: string, force = false) => {
    if (isFetching && !force) {
      return false;
    }

    const cachedProfile = getCachedData<Profile>(`profile_${userId}`);
    if (cachedProfile && !force) {
      setProfile(cachedProfile);
      return true;
    }

    try {
      setIsFetching(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error fetching profile:', error);
        return false;
      }

      if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        setCachedData(`profile_${userId}`, profileData);
        return true;
      } else {
        console.warn('[AuthContext] No profile found for user:', userId);
        return false;
      }
    } catch (err) {
      console.error('[AuthContext] Exception fetching profile:', err);
      return false;
    } finally {
      setIsFetching(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, true);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    clearCache();
    stopTokenRefreshManager();
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth...');
      try {
        const cachedSession = getCachedData<{ userId: string }>('session');
        let cachedProfile: Profile | null = null;

        if (cachedSession?.userId) {
          cachedProfile = getCachedData<Profile>(`profile_${cachedSession.userId}`);
          if (cachedProfile) {
            console.log('[AuthContext] Found cached profile:', cachedProfile.id);
            setProfile(cachedProfile);
          }
        }

        if (isInRateLimitCooldown()) {
          console.log('[AuthContext] Skipping session check due to rate limit cooldown');
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (typeof window !== 'undefined' && window.location.pathname === '/login') {
          console.log('[AuthContext] On login page, skipping session check');
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        console.log('[AuthContext] Getting session from Supabase...');
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          if (error.message.includes('rate limit') || error.status === 429) {
            console.warn('[AuthContext] Rate limit hit during session check');
            setRateLimitHit();
            if (cachedSession?.userId && cachedProfile) {
              setLoading(false);
              return;
            }
          } else {
            console.error('[AuthContext] Session error:', error);
          }
          setUser(null);
          setProfile(null);
          setSession(null);
          setLoading(false);
          return;
        }

        if (currentSession?.user) {
          console.log('[AuthContext] Session found, user ID:', currentSession.user.id);
          setUser(currentSession.user);
          setSession(currentSession);
          setCachedData('session', { userId: currentSession.user.id });
          const found = await fetchProfile(currentSession.user.id);
          // Trigger may not have run yet for brand-new users — retry once after a short delay
          if (!found) {
            await new Promise(r => setTimeout(r, 1500));
            const found2 = mounted && await fetchProfile(currentSession.user.id, true);
            // Last resort: create the profile if it still doesn't exist
            if (!found2 && mounted) {
              const u = currentSession.user;
              await supabase.from('profiles').upsert({
                id: u.id,
                email: u.email ?? '',
                name: u.user_metadata?.full_name || 'User',
                account_type: 'customer',
                role: 'customer',
              }, { onConflict: 'id' });
              if (mounted) await fetchProfile(u.id, true);
            }
          }
          startTokenRefreshManager();
        } else {
          console.log('[AuthContext] No session found');
          setUser(null);
          setProfile(null);
          setSession(null);
          clearCache('session');
          stopTokenRefreshManager();
        }
      } catch (error: any) {
        if (!mounted) return;

        if (error?.message?.includes('rate limit') || error?.status === 429) {
          console.warn('[AuthContext] Rate limit hit during initialization');
          setRateLimitHit();
        } else {
          console.error('[AuthContext] Error initializing auth:', error);
        }
        setUser(null);
        setProfile(null);
        setSession(null);
      } finally {
        if (mounted) {
          console.log('[AuthContext] Finished initialization, loading=false');
          setLoading(false);
        }
      }
    };

    console.log('[AuthContext] Calling initializeAuth...');
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, newSession: any) => {
      if (!mounted) return;

      (async () => {
        try {
          if (event === 'SIGNED_OUT' || !newSession) {
            setUser(null);
            setProfile(null);
            setSession(null);
            return;
          }

          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            if (newSession?.user) {
              setUser(newSession.user);
              setSession(newSession);
              await fetchProfile(newSession.user.id);
            }
          }
        } catch (error: any) {
          if (error?.message?.includes('rate limit') || error?.status === 429) {
            console.warn('[AuthContext] Rate limit hit in auth state change');
            setRateLimitHit();
          } else {
            console.error('[AuthContext] Error in auth state change:', error);
          }
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
