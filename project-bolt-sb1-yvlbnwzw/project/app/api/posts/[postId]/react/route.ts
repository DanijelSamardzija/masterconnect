import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const supabase = createClientFromRequest(request);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emoji } = await request.json();
    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('post_reactions')
      .upsert({
        post_id: params.postId,
        user_id: user.id,
        emoji
      }, {
        onConflict: 'post_id,user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding reaction:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error in react endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const supabase = createClientFromRequest(request);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', params.postId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing reaction:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in react endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
