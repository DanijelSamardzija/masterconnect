import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { devLog } from '@/lib/dev-log';

export async function POST(req: NextRequest) {
  try {
    devLog('[Offers API v4.0] ============= REQUEST RECEIVED =============');

    const authHeader = req.headers.get('authorization');
    const customHeader = req.headers.get('x-supabase-token');

    devLog('[Offers API v4.0] Standard Auth header:', authHeader ? 'Present' : 'Missing');
    devLog('[Offers API v4.0] Custom header:', customHeader ? 'Present' : 'Missing');

    let token: string | null = null;

    if (customHeader) {
      token = customHeader;
      devLog('[Offers API v4.0] Using custom header token');
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
      devLog('[Offers API v4.0] Using standard Authorization header');
    }

    if (!token) {
      devLog('[Offers API v4.0] FAIL: No authentication token found');
      return NextResponse.json({
        error: 'Missing authentication token',
        details: 'Please include token in X-Supabase-Token or Authorization header'
      }, { status: 401 });
    }

    devLog('[Offers API v4.0] Token extracted, length:', token.length);

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    devLog('[Offers API v4.0] Supabase client created with user token in headers');
    devLog('[Offers API v4.0] Calling getUser with token...');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    devLog('[Offers API v4.0] getUser result:', {
      hasUser: !!user,
      userId: user?.id,
      hasError: !!userError,
      errorMsg: userError?.message
    });

    if (userError || !user) {
      devLog('[Offers API v4.0] FAIL: User authentication failed');
      return NextResponse.json({
        error: 'Unauthorized',
        details: userError?.message || 'Invalid token'
      }, { status: 401 });
    }

    devLog('[Offers API v4.0] ✓✓✓ USER AUTHENTICATED:', user.id);

    const body = await req.json();
    const {
      receiverId,
      relatedPostId,
      price,
      currency,
      priceType,
      offerType,
      estimatedStart,
      durationDeadline,
      note
    } = body;

    if (!receiverId) {
      return NextResponse.json({ error: 'Receiver ID is required' }, { status: 400 });
    }

    if (!relatedPostId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    if (!price || price <= 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 });
    }

    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    if (!offerType) {
      return NextResponse.json({ error: 'Offer type is required' }, { status: 400 });
    }

    if (receiverId === user.id) {
      return NextResponse.json({ error: 'Cannot send offer to yourself' }, { status: 400 });
    }

    const { data: existingThread, error: threadFindError } = await supabase
      .from('threads')
      .select('id')
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${user.id})`)
      .is('post_id', null)
      .maybeSingle();

    if (threadFindError) {
      console.error('[Offers API v3.0] Error finding thread:', threadFindError);
    }

    let threadId: string;

    if (existingThread) {
      threadId = existingThread.id;
      devLog('[Offers API v4.0] Using existing thread:', threadId);
    } else {
      const { data: newThread, error: threadCreateError } = await supabase
        .from('threads')
        .insert({
          user1_id: user.id,
          user2_id: receiverId,
        })
        .select('id')
        .single();

      if (threadCreateError || !newThread) {
        console.error('[Offers API v3.0] Failed to create thread:', threadCreateError);
        return NextResponse.json({
          error: `Failed to create conversation: ${threadCreateError?.message || 'Unknown error'}`
        }, { status: 500 });
      }

      threadId = newThread.id;
      devLog('[Offers API v4.0] Created new thread:', threadId);
    }

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        conversation_id: threadId,
        sender_id: user.id,
        receiver_id: receiverId,
        related_post_id: relatedPostId,
        offer_type: offerType,
        price,
        currency,
        price_type: priceType || 'fixed',
        estimated_start: estimatedStart || null,
        duration_deadline: durationDeadline || null,
        note: note || null,
        status: 'pending'
      })
      .select('id')
      .single();

    if (offerError || !offer) {
      console.error('[Offers API v3.0] Failed to create offer:', offerError);
      return NextResponse.json({
        error: `Failed to create offer: ${offerError?.message || 'Unknown error'}`
      }, { status: 500 });
    }

    devLog('[Offers API v4.0] Offer created:', offer.id);

    const priceText = priceType === 'per_hour' ? `${price} ${currency}/h` : `${price} ${currency}`;
    const offerTypeText = offerType === 'service' ? 'service offer' : 'job offer';

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        receiver_id: receiverId,
        text: `Sent you a ${offerTypeText} for ${priceText}`,
        message_type: 'offer',
        offer_id: offer.id
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[Offers API v3.0] Failed to create message:', messageError);
    } else if (message) {
      devLog('[Offers API v4.0] Message created:', message.id);
      await supabase
        .from('offers')
        .update({ message_id: message.id })
        .eq('id', offer.id);
    }

    devLog('[Offers API v4.0] SUCCESS - Offer sent');

    return NextResponse.json({
      success: true,
      offerId: offer.id,
      threadId,
      messageId: message?.id
    }, { status: 200 });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Offers API v3.0] EXCEPTION:', errorMsg);
    return NextResponse.json({
      error: `Internal server error: ${errorMsg}`
    }, { status: 500 });
  }
}
