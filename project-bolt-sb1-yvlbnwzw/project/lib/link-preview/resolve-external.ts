import { supabase } from '@/lib/supabase/client';
import type { PreviewData } from './types';

/** Fetch OG metadata for any external URL via the server-side proxy. Requires an active session. */
export async function resolveExternal(url: string): Promise<PreviewData | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/api/link-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ url }),
      // AbortSignal.timeout may not exist in all envs — use a manual abort
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 5000); return c.signal; })(),
    });

    if (!res.ok) return null;
    const data = await res.json() as Partial<PreviewData>;
    return data.title ? { ...data, internalType: 'external' } as PreviewData : null;
  } catch {
    return null;
  }
}
