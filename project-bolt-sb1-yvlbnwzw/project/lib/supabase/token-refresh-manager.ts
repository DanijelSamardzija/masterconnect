import { supabase } from './client';
import { isInRateLimitCooldown } from '../rate-limit-handler';

let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefreshManager() {
  if (refreshInterval) {
    return;
  }

  refreshInterval = setInterval(async () => {
    if (isInRateLimitCooldown()) {
      console.log('[TokenRefreshManager] Skipping refresh due to cooldown');
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[TokenRefreshManager] Error getting session:', error);
        return;
      }

      if (!session) {
        console.log('[TokenRefreshManager] No active session');
        return;
      }

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

      if (timeUntilExpiry < 300) {
        console.log('[TokenRefreshManager] Token expiring soon, refreshing...', {
          timeUntilExpiry,
          expiresAt,
          now
        });

        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('[TokenRefreshManager] Refresh failed:', refreshError);
        } else if (data?.session) {
          console.log('[TokenRefreshManager] Token refreshed successfully', {
            newExpiresAt: data.session.expires_at
          });
        } else {
          console.warn('[TokenRefreshManager] Refresh returned no session');
        }
      } else {
        console.log('[TokenRefreshManager] Token still valid', {
          timeUntilExpiry,
          minutesRemaining: Math.floor(timeUntilExpiry / 60)
        });
      }
    } catch (error) {
      console.error('[TokenRefreshManager] Unexpected error:', error);
    }
  }, 60000);

  console.log('[TokenRefreshManager] Started');
}

export function stopTokenRefreshManager() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[TokenRefreshManager] Stopped');
  }
}
