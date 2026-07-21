import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { devLog } from '@/lib/dev-log';

export async function POST(request: NextRequest) {
  try {
    devLog('[Offers Respond API v2.0] ============= REQUEST RECEIVED =============');

    const authHeader = request.headers.get('authorization');
    const customHeader = request.headers.get('x-supabase-token');

    devLog('[Offers Respond API v2.0] Standard Auth header:', authHeader ? 'Present' : 'Missing');
    devLog('[Offers Respond API v2.0] Custom header:', customHeader ? 'Present' : 'Missing');

    let token: string | null = null;

    if (customHeader) {
      token = customHeader;
      devLog('[Offers Respond API v2.0] Using custom header token');
    } else if (authHeader) {
      token = authHeader.replace('Bearer ', '');
      devLog('[Offers Respond API v2.0] Using standard Authorization header');
    }

    if (!token) {
      devLog('[Offers Respond API v2.0] FAIL: No authentication token found');
      return NextResponse.json({
        error: 'Unauthorized - Please sign in to respond to offers'
      }, { status: 401 });
    }

    devLog('[Offers Respond API v2.0] Token extracted, length:', token.length);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    devLog('[Offers Respond API v2.0] Calling getUser...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Offers Respond API v2.0] Auth error:', authError);
      return NextResponse.json({
        error: 'Unauthorized - Please sign in to respond to offers'
      }, { status: 401 });
    }

    devLog('[Offers Respond API v2.0] ✓✓✓ USER AUTHENTICATED:', user.id);

    const body = await request.json();
    const { offerId, action } = body;

    if (!offerId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offerId)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    if (offer.receiver_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized to respond to this offer' }, { status: 403 });
    }

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: 'Offer already responded to' }, { status: 400 });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    devLog('[Offers Respond API v2.0] Updating offer status to:', newStatus);

    const { error: updateError } = await supabase
      .from('offers')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString()
      })
      .eq('id', offerId);

    if (updateError) {
      console.error('[Offers Respond API v2.0] Error updating offer:', updateError);
      return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 });
    }

    devLog('[Offers Respond API v2.0] Offer updated successfully');

    const systemMessageText = action === 'accept'
      ? `Offer accepted`
      : `Offer declined`;

    devLog('[Offers Respond API v2.0] Creating system message...');

    await supabase
      .from('messages')
      .insert({
        thread_id: offer.conversation_id,
        sender_id: user.id,
        receiver_id: offer.sender_id,
        text: systemMessageText,
        message_type: 'system'
      });

    devLog('[Offers Respond API v2.0] SUCCESS - Response recorded');

    return NextResponse.json({
      success: true,
      status: newStatus
    });

  } catch (error) {
    console.error('Error in offer response:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
