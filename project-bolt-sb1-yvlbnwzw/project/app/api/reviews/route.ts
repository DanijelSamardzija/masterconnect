import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

async function processReview(supabase: any, user: any, pro_id: string, rating: number, comment: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: 'Profile not found' },
      { status: 403 }
    );
  }

  if (user.id === pro_id) {
    return NextResponse.json(
      { error: 'You cannot review yourself' },
      { status: 400 }
    );
  }

  const { data: proProfile } = await supabase
    .from('profiles')
    .select('account_type')
    .eq('id', pro_id)
    .maybeSingle();

  if (!proProfile || proProfile.account_type !== 'professional') {
    return NextResponse.json(
      { error: 'You can only review professionals' },
      { status: 400 }
    );
  }

  const { data: threadCheck } = await supabase
    .from('thread_participants')
    .select('thread_id, deleted_at')
    .eq('user_id', user.id);

  const { data: proThreadCheck } = await supabase
    .from('thread_participants')
    .select('thread_id, deleted_at')
    .eq('user_id', pro_id);

  const commonThreads = threadCheck?.filter((t1: any) =>
    proThreadCheck?.some((t2: any) => t2.thread_id === t1.thread_id)
  );

  if (!commonThreads || commonThreads.length === 0) {
    return NextResponse.json(
      { error: 'You must have a conversation with this professional before leaving a review' },
      { status: 403 }
    );
  }

  let hasValidMessages = false;

  for (const commonThread of commonThreads) {
    const customerParticipant = threadCheck?.find((t: any) => t.thread_id === commonThread.thread_id);
    const proParticipant = proThreadCheck?.find((t: any) => t.thread_id === commonThread.thread_id);

    const customerHiddenAt = customerParticipant?.deleted_at;
    const proHiddenAt = proParticipant?.deleted_at;

    let customerQuery = supabase
      .from('messages')
      .select('id')
      .eq('thread_id', commonThread.thread_id)
      .eq('sender_id', user.id)
      .eq('is_system', false)
      .eq('is_deleted', false);

    if (customerHiddenAt) {
      customerQuery = customerQuery.gt('created_at', customerHiddenAt);
    }

    const { data: customerMessages } = await customerQuery.limit(1);

    let proQuery = supabase
      .from('messages')
      .select('id')
      .eq('thread_id', commonThread.thread_id)
      .eq('sender_id', pro_id)
      .eq('is_system', false)
      .eq('is_deleted', false);

    if (proHiddenAt) {
      proQuery = proQuery.gt('created_at', proHiddenAt);
    }

    const { data: proMessages } = await proQuery.limit(1);

    if (customerMessages && customerMessages.length > 0 && proMessages && proMessages.length > 0) {
      hasValidMessages = true;
      break;
    }
  }

  if (!hasValidMessages) {
    return NextResponse.json(
      { error: 'You must exchange messages with this professional before leaving a review' },
      { status: 403 }
    );
  }

  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .insert({
      customer_id: user.id,
      pro_id,
      rating,
      comment: comment || '',
      job_id: null,
    })
    .select()
    .single();

  if (reviewError) {
    if (reviewError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already reviewed this professional' },
        { status: 400 }
      );
    }
    console.error('Review creation error:', reviewError);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, review }, { status: 201 });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClientFromRequest(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const user = authData.user;

    const body = await request.json();
    const { pro_id, rating, comment } = body;

    if (!pro_id || !rating) {
      return NextResponse.json(
        { error: 'Professional ID and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    return await processReview(supabase, user, pro_id, rating, comment);
  } catch (error) {
    console.error('Review API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClientFromRequest(request);
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized - Please log in' }, { status: 401 });
    }

    const user = authData.user;
    const body = await request.json();
    const { review_id, rating, comment } = body;

    if (!review_id || !rating) {
      return NextResponse.json(
        { error: 'Review ID and rating are required' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const { data: existingReview } = await supabase
      .from('reviews')
      .select('customer_id')
      .eq('id', review_id)
      .maybeSingle();

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    if (existingReview.customer_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only edit your own reviews' },
        { status: 403 }
      );
    }

    const { data: review, error: updateError } = await supabase
      .from('reviews')
      .update({
        rating,
        comment: comment || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', review_id)
      .select()
      .single();

    if (updateError) {
      console.error('Review update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, review }, { status: 200 });
  } catch (error) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pro_id = searchParams.get('pro_id');

    if (!pro_id) {
      return NextResponse.json(
        { error: 'Professional ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClientFromRequest(request);

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        *,
        customer:profiles!reviews_customer_id_fkey(
          id,
          name,
          avatar_url
        )
      `)
      .eq('pro_id', pro_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Reviews fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    const totalReviews = reviews?.length || 0;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    return NextResponse.json({
      reviews: reviews || [],
      stats: {
        total: totalReviews,
        average: Math.round(averageRating * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
