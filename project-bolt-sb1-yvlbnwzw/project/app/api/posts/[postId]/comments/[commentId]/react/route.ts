import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const supabase = createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emoji } = await request.json();

    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
    }

    const { commentId } = params;

    const { data: existingReaction } = await supabase
      .from('comment_reactions')
      .select('id, emoji')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        const { error: deleteError } = await supabase
          .from('comment_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (deleteError) throw deleteError;

        return NextResponse.json({ removed: true });
      } else {
        const { data, error: updateError } = await supabase
          .from('comment_reactions')
          .update({ emoji })
          .eq('id', existingReaction.id)
          .select()
          .single();

        if (updateError) throw updateError;

        return NextResponse.json({ reaction: data });
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('comment_reactions')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          emoji
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return NextResponse.json({ reaction: data });
    }
  } catch (error: any) {
    console.error('Error handling comment reaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to handle reaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const supabase = createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = params;

    const { error: deleteError } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', user.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ removed: true });
  } catch (error: any) {
    console.error('Error removing comment reaction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove reaction' },
      { status: 500 }
    );
  }
}
