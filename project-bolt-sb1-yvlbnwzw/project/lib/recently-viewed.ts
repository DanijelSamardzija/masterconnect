const KEY = 'gz_rv';
const MAX = 5;

export type RecentItem = {
  id: string;
  title: string;
  url: string;
  ts: number;
};

export function trackView(item: Omit<RecentItem, 'ts'>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing: RecentItem[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    const filtered = existing.filter((r) => r.id !== item.id);
    const updated = [{ ...item, ts: Date.now() }, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}

export function getRecentlyViewed(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
