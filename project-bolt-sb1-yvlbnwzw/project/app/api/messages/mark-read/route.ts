import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = await request.json();

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('thread_participants')
      .update({ last_read_at: now })
      .eq('thread_id', threadId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating thread_participants:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: notifError } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .eq('type', 'message')
      .is('read_at', null)
      .contains('meta', { thread_id: threadId });

    if (notifError) {
      console.error('Error updating notifications:', notifError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in mark-read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
