let lastRateLimitTime: number | null = null;
let rateLimitCooldownSeconds = 60;

export function setRateLimitHit() {
  if (lastRateLimitTime) {
    console.log('[RateLimitHandler] Rate limit hit again, but cooldown already active');
    return;
  }

  lastRateLimitTime = Date.now();
  console.log('[RateLimitHandler] Rate limit hit, cooldown started');

  try {
    const keysToPreserve = ['sb-', 'cachedProfile', 'session'];
    const itemsToKeep: { [key: string]: string } = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const shouldKeep = keysToPreserve.some(prefix => key.startsWith(prefix));
        if (!shouldKeep) {
          const value = localStorage.getItem(key);
          if (value) {
            itemsToKeep[key] = value;
          }
        }
      }
    }

    for (const key in itemsToKeep) {
      localStorage.setItem(key, itemsToKeep[key]);
    }

    console.log('[RateLimitHandler] Cleaned up localStorage except user data');
  } catch (error) {
    console.error('[RateLimitHandler] Error cleaning localStorage:', error);
  }
}

export function isInRateLimitCooldown(): boolean {
  if (!lastRateLimitTime) return false;

  const elapsed = (Date.now() - lastRateLimitTime) / 1000;
  const remaining = rateLimitCooldownSeconds - elapsed;

  if (remaining > 0) {
    console.log(`[RateLimitHandler] Still in cooldown: ${Math.ceil(remaining)}s remaining`);
    return true;
  }

  lastRateLimitTime = null;
  return false;
}

export function getRemainingCooldownSeconds(): number {
  if (!lastRateLimitTime) return 0;

  const elapsed = (Date.now() - lastRateLimitTime) / 1000;
  const remaining = rateLimitCooldownSeconds - elapsed;

  return Math.max(0, Math.ceil(remaining));
}

export function clearRateLimitCooldown() {
  lastRateLimitTime = null;
  console.log('[RateLimitHandler] Cooldown cleared');
}
