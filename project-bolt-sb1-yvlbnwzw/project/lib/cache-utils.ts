const CACHE_PREFIX = 'app_cache_';
const CACHE_EXPIRY = 5 * 60 * 1000;

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const item: CacheItem<T> = JSON.parse(cached);
    const now = Date.now();

    if (now - item.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return item.data;
  } catch {
    return null;
  }
}

export function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;

  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch {
  }
}

export function clearCache(key?: string): void {
  if (typeof window === 'undefined') return;

  try {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key);
    } else {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch {
  }
}
