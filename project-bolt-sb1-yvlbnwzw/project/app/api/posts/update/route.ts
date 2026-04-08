import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { analyzeSpam } from '@/lib/antiSpam';

// Debug mode - disable verbose logs in production
const DEBUG = process.env.NODE_ENV !== 'production';

export async function PUT(request: NextRequest) {
  let body;

  try {
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const postId = body.postId;

    // Validate postId is a valid UUID
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json(
        { error: 'Valid post ID is required (postId must be a string)' },
        { status: 400 }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(postId)) {
      console.error('Invalid UUID format:', postId);
      return NextResponse.json(
        { error: 'Invalid postId format - must be a valid UUID' },
        { status: 400 }
      );
    }

    // PRIORITY: x-access-token first (most reliable), then Authorization fallback
    const xAccessToken = request.headers.get('x-access-token');
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');

    if (DEBUG) {
      console.log('[UPDATE ENDPOINT] x-access-token:', xAccessToken);
      console.log('[UPDATE ENDPOINT] authorization:', authHeader);
    }

    let token: string | null = null;

    // Try x-access-token first (most reliable across proxies/edge)
    if (xAccessToken) {
      token = xAccessToken.trim();
    }

    // Fallback to Authorization header
    if (!token && authHeader) {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match) {
        token = match[1].trim();
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authorization token' },
        { status: 401 }
      );
    }

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication failed', details: authError.message },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // STEP 1: WHITELIST USER-CONTROLLED FIELDS
    // SECURITY: Only allow text, city, category - prevent manipulation of status, rank_penalty, etc.
    if (DEBUG) {
      console.log('[UPDATE] Request body keys:', Object.keys(body));
    }

    const updateData: any = {};

    // TEXT field
    if (body.text !== undefined && body.text !== null) {
      if (typeof body.text !== 'string') {
        return NextResponse.json(
          { error: 'Text must be a string' },
          { status: 400 }
        );
      }
      updateData.text = body.text.trim();
    }

    // CITY field (optional)
    if (body.city !== undefined && body.city !== null) {
      if (typeof body.city !== 'string') {
        return NextResponse.json(
          { error: 'City must be a string' },
          { status: 400 }
        );
      }
      const cityTrimmed = body.city.trim();
      if (cityTrimmed.length > 0) {
        updateData.city = cityTrimmed;
      } else {
        updateData.city = null;
      }
    }

    // CATEGORY field (optional)
    if (body.category !== undefined && body.category !== null) {
      if (typeof body.category !== 'string') {
        return NextResponse.json(
          { error: 'Category must be a string' },
          { status: 400 }
        );
      }
      const categoryTrimmed = body.category.trim();
      if (categoryTrimmed.length > 0) {
        updateData.category = categoryTrimmed;
      } else {
        updateData.category = null;
      }
    }

    // SECURITY: Whitelist filter - only allow user-controlled fields
    const allowedFields = ['text', 'city', 'category'];
    Object.keys(updateData).forEach((key) => {
      if (!allowedFields.includes(key)) {
        if (DEBUG) console.log(`[SECURITY] Removing disallowed field: ${key}`);
        delete updateData[key];
      }
    });

    // SERVER-SIDE COMPUTED: category_normalized from category
    if (updateData.category) {
      updateData.category_normalized = updateData.category.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    } else if (updateData.category === null) {
      updateData.category_normalized = null;
    }

    const { data: existingPost, error: fetchError } = await supabase
      .from('posts')
      .select('user_id, text, post_type')
      .eq('id', postId)
      .single();

    if (fetchError) {
      console.error('Fetch post error:', fetchError);
      return NextResponse.json(
        { error: 'Post not found', details: fetchError.message },
        { status: 404 }
      );
    }

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (existingPost.user_id !== user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this post' },
        { status: 403 }
      );
    }

    // STEP 3: CALCULATE SPAM (but don't add to update yet)
    const { data: profile } = await supabase
      .from('profiles')
      .select('average_rating, review_count, created_at')
      .eq('id', user.id)
      .maybeSingle();

    const { data: recentPosts } = await supabase
      .from('posts')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const newText = updateData.text || existingPost.text;

    const spamAnalysis = analyzeSpam({
      text: newText,
      user_created_at: profile?.created_at || new Date().toISOString(),
      phone_verified: false,
      average_rating: profile?.average_rating || 0,
      review_count: profile?.review_count || 0,
      recent_posts: recentPosts || [],
    });

    if (DEBUG) {
      console.log('[SPAM] Analysis:', {
        spam_score: spamAnalysis.spam_score,
        status: spamAnalysis.status,
        rank_penalty: spamAnalysis.rank_penalty,
        link_count: spamAnalysis.link_count,
        phone_count: spamAnalysis.phone_count,
      });
    }

    // STEP 4: ADD SPAM FIELDS WITH STRICT TYPE VALIDATION
    const finalUpdateData: any = { ...updateData };

    // Ensure spam_score is a valid number
    if (typeof spamAnalysis.spam_score === 'number' && isFinite(spamAnalysis.spam_score)) {
      finalUpdateData.spam_score = spamAnalysis.spam_score;
    } else {
      console.error('Invalid spam_score:', spamAnalysis.spam_score);
      finalUpdateData.spam_score = 0;
    }

    // Ensure rank_penalty is a valid number
    if (typeof spamAnalysis.rank_penalty === 'number' && isFinite(spamAnalysis.rank_penalty)) {
      finalUpdateData.rank_penalty = spamAnalysis.rank_penalty;
    } else {
      console.error('Invalid rank_penalty:', spamAnalysis.rank_penalty);
      finalUpdateData.rank_penalty = 0;
    }

    // Ensure status is a valid string
    if (typeof spamAnalysis.status === 'string' && spamAnalysis.status.trim().length > 0) {
      finalUpdateData.status = spamAnalysis.status;
    } else {
      console.error('Invalid status:', spamAnalysis.status);
      finalUpdateData.status = 'published';
    }

    // Add other spam fields
    finalUpdateData.duplicate_hash = spamAnalysis.duplicate_hash;
    finalUpdateData.link_count = typeof spamAnalysis.link_count === 'number' ? spamAnalysis.link_count : 0;
    finalUpdateData.phone_count = typeof spamAnalysis.phone_count === 'number' ? spamAnalysis.phone_count : 0;
    finalUpdateData.hashtag_count = typeof spamAnalysis.hashtag_count === 'number' ? spamAnalysis.hashtag_count : 0;
    finalUpdateData.caps_ratio = typeof spamAnalysis.caps_ratio === 'number' ? spamAnalysis.caps_ratio : 0;
    finalUpdateData.moderation_reasons = spamAnalysis.moderation_reasons || [];

    if (DEBUG) {
      console.log('[UPDATE] Final DB data:', Object.keys(finalUpdateData));
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(finalUpdateData)
      .eq('id', postId)
      .select()
      .single();

    if (updateError) {
      // ALWAYS log DB errors (production safe)
      console.error('DB UPDATE ERROR:', updateError.code);
      console.error('ERROR MESSAGE:', updateError.message);
      console.error('ERROR DETAILS:', updateError.details);

      if (DEBUG) {
        console.error('Full error:', JSON.stringify(updateError, null, 2));
        console.error('Update data sent:', finalUpdateData);
        console.error('Post ID:', postId);
      }

      return NextResponse.json(
        {
          error: 'Failed to update post',
          message: updateError.message,
          details: updateError.details,
          code: updateError.code,
          hint: updateError.hint,
        },
        { status: 500 }
      );
    }

    if (DEBUG) {
      console.log('[UPDATE] Success - Post ID:', postId);
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
      spam_analysis: {
        status: spamAnalysis.status,
        spam_score: spamAnalysis.spam_score,
        rank_penalty: spamAnalysis.rank_penalty,
        link_count: spamAnalysis.link_count,
        phone_count: spamAnalysis.phone_count,
        moderation_reasons: spamAnalysis.moderation_reasons,
      },
    });
  } catch (error: any) {
    console.error('Unexpected error in update route:', error);
    console.error('Error stack:', error.stack);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message || 'Unknown error',
        type: error.name || 'Error',
      },
      { status: 500 }
    );
  }
}
