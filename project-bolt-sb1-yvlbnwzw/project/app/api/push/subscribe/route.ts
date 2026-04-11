import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getAuthUser(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const supabase = getServiceClient();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

// Save push subscription
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await request.json();
  const { endpoint, keys } = sub;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const supabase = getServiceClient();
  await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  }, { onConflict: 'user_id,endpoint' });

  return NextResponse.json({ success: true });
}

// Remove push subscription (disable push for this device)
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let endpoint: string | null = null;
  try {
    const body = await request.json();
    endpoint = body.endpoint ?? null;
  } catch {}

  const supabase = getServiceClient();
  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id);
  if (endpoint) query = query.eq('endpoint', endpoint);

  await query;
  return NextResponse.json({ success: true });
}
