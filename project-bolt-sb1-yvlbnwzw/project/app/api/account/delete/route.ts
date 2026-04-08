import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { confirmText } = await request.json();
    if (!confirmText || confirmText.trim() !== 'DELETE') {
      return NextResponse.json({ error: 'Invalid confirmation text' }, { status: 400 });
    }

    // Read Bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build a user-scoped client so auth.uid() works in the RPC function
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase.rpc('delete_user_account');

    if (error) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    if (!data?.success) {
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }

    const userId = data.user_id;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { error: adminError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (adminError) {
        console.error('[Delete account] Admin delete failed:', adminError.message);
        return NextResponse.json({ error: 'Failed to delete auth user: ' + adminError.message }, { status: 500 });
      }
    } else {
      console.error('[Delete account] SUPABASE_SERVICE_ROLE_KEY not set');
      return NextResponse.json({ error: 'Server misconfiguration: missing service role key' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
