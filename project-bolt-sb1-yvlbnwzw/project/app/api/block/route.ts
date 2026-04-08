import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
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

    const { blockedUserId } = await request.json();

    if (!blockedUserId) {
      return NextResponse.json({ error: 'Missing blockedUserId' }, { status: 400 });
    }

    if (blockedUserId === user.id) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    const { data: existingBlock } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_user_id', user.id)
      .eq('blocked_user_id', blockedUserId)
      .maybeSingle();

    if (existingBlock) {
      return NextResponse.json({ error: 'User already blocked' }, { status: 409 });
    }

    const { data: block, error } = await supabase
      .from('blocks')
      .insert({
        blocker_user_id: user.id,
        blocked_user_id: blockedUserId
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating block:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: block });
  } catch (error: any) {
    console.error('Error in block endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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

    const { blockedUserId } = await request.json();

    if (!blockedUserId) {
      return NextResponse.json({ error: 'Missing blockedUserId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_user_id', user.id)
      .eq('blocked_user_id', blockedUserId);

    if (error) {
      return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
  }
}
