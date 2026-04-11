import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { applicationId, status, callerId } = await request.json();

    if (!applicationId || !status || !callerId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    if (status !== 'accepted' && status !== 'declined') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify caller is the post owner
    const { data: app } = await supabase
      .from('job_applications')
      .select('id, post_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', app.post_id)
      .maybeSingle();

    if (!post || post.user_id !== callerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('job_applications')
      .update({ status })
      .eq('id', applicationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
