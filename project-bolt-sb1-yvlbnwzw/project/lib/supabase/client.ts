import { createClient } from '@supabase/supabase-js';
import { setRateLimitHit } from '../rate-limit-handler';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: ReturnType<typeof createClient<Database>>;

function createSupabaseInstance() {
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web',
      },
      fetch: async (url, options = {}) => {
        try {
          const response = await fetch(url, options);

          if (response.status === 429) {
            setRateLimitHit();
          }

          return response;
        } catch (error) {
          console.error('[Supabase] Fetch error:', error);
          throw error;
        }
      },
    },
  });

  return client;
}

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseInstance();
  }
  return supabaseInstance;
})();
