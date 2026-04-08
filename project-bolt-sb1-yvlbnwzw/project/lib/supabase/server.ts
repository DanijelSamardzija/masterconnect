import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

export function createClient(cookieStore?: ReturnType<typeof cookies>) {
  const store = cookieStore || cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            store.set({ name, value, ...options });
          } catch (error) {
            // Ignore errors from setting cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            store.set({ name, value: '', ...options });
          } catch (error) {
            // Ignore errors from removing cookies in Server Components
          }
        },
      },
    }
  );
}

export function createClientFromRequest(request: NextRequest, response?: NextResponse) {
  let responseToUse = response;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });

          if (responseToUse) {
            responseToUse.cookies.set({
              name,
              value,
              ...options,
            });
          }
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });

          if (responseToUse) {
            responseToUse.cookies.set({
              name,
              value: '',
              ...options,
            });
          }
        },
      },
    }
  );
}

export async function createClientFromAuthHeader(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const accessToken = authHeader?.replace('Bearer ', '');

  console.log('[createClientFromAuthHeader] Starting:', {
    hasAuthHeader: !!authHeader,
    tokenLength: accessToken?.length || 0,
    tokenPrefix: accessToken?.substring(0, 10) + '...'
  });

  if (!accessToken) {
    console.log('[createClientFromAuthHeader] No access token found');
    return null;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[createClientFromAuthHeader] Missing Supabase environment variables!');
    return null;
  }

  const client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  try {
    console.log('[createClientFromAuthHeader] Validating token with getUser...');

    const { data: userData, error: userError } = await client.auth.getUser();

    console.log('[createClientFromAuthHeader] getUser result:', {
      hasUser: !!userData?.user,
      userId: userData?.user?.id || 'none',
      userEmail: userData?.user?.email || 'none',
      hasError: !!userError,
      errorMessage: userError?.message || 'none'
    });

    if (userError || !userData?.user) {
      console.error('[createClientFromAuthHeader] Failed to validate token:', {
        error: userError?.message,
        fullError: JSON.stringify(userError, null, 2)
      });
      return null;
    }

    console.log('[createClientFromAuthHeader] SUCCESS - Token validated, user:', userData.user.id);

    return client;
  } catch (error) {
    console.error('[createClientFromAuthHeader] Unexpected exception:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'no stack'
    });
    return null;
  }
}
