import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: blocks, error } = await supabase
      .from('blocks')
      .select(`
        id,
        blocked_user_id,
        created_at,
        blocked_user:blocked_user_id (
          id,
          name,
          email
        )
      `)
      .eq('blocker_user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blocks:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: blocks });
  } catch (error: any) {
    console.error('Error in block list endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
