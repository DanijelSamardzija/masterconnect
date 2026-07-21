import { supabase } from './client';
import { isInRateLimitCooldown } from '../rate-limit-handler';
import { devLog } from '../dev-log';

let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefreshManager() {
  if (refreshInterval) {
    return;
  }

  refreshInterval = setInterval(async () => {
    if (isInRateLimitCooldown()) {
      devLog('[TokenRefreshManager] Skipping refresh due to cooldown');
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[TokenRefreshManager] Error getting session:', error);
        return;
      }

      if (!session) {
        devLog('[TokenRefreshManager] No active session');
        return;
      }

      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

      if (timeUntilExpiry < 300) {
        devLog('[TokenRefreshManager] Token expiring soon, refreshing...', {
          timeUntilExpiry,
          expiresAt,
          now
        });

        const { data, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error('[TokenRefreshManager] Refresh failed:', refreshError);
        } else if (data?.session) {
          devLog('[TokenRefreshManager] Token refreshed successfully', {
            newExpiresAt: data.session.expires_at
          });
        } else {
          console.warn('[TokenRefreshManager] Refresh returned no session');
        }
      } else {
        devLog('[TokenRefreshManager] Token still valid', {
          timeUntilExpiry,
          minutesRemaining: Math.floor(timeUntilExpiry / 60)
        });
      }
    } catch (error) {
      console.error('[TokenRefreshManager] Unexpected error:', error);
    }
  }, 60000);

  devLog('[TokenRefreshManager] Started');
}

export function stopTokenRefreshManager() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    devLog('[TokenRefreshManager] Stopped');
  }
}
