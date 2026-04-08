const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export function isOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

export function formatLastSeen(lastSeen: string | null | undefined): string {
  if (!lastSeen) return 'offline';
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (diff < 120) return 'online';
  if (diff < 3600) return `last seen ${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `last seen ${Math.floor(diff / 3600)}h ago`;
  return `last seen ${Math.floor(diff / 86400)}d ago`;
}
