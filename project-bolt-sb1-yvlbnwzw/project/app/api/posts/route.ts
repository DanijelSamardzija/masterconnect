import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { computeSpamScore, type UserProfile, type PostingStats } from '@/lib/antiSpam';
import { notifySubscribers } from '@/lib/notify-subscribers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const xAccessToken = request.headers.get('x-access-token');

    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    } else if (xAccessToken) {
      token = xAccessToken;
    }

    // Create Supabase client with or without auth
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      token ? {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      } : undefined
    );

    // Get user if token is provided (optional)
    let user = null;
    if (token) {
      const { data: { user: authenticatedUser }, error: userError } = await supabase.auth.getUser();
      if (!userError && authenticatedUser) {
        user = authenticatedUser;
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const city = searchParams.get('city');
    const category = searchParams.get('category');
    const hashtag = searchParams.get('hashtag');
    const limit = parseInt(searchParams.get('limit') || '15');
    const offset = parseInt(searchParams.get('offset') || '0');
    const asOf = searchParams.get('as_of');
    const userCity = searchParams.get('user_city') || null;
    const userCountry = searchParams.get('user_country') || null;

    // Get total count without filters
    const { count: totalPostsCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true });

    // Count all published social posts (including demo) — used for hasMore comparison
    // against rpcFetchedCount which also counts all posts from RPC
    let countQuery = supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('post_type', 'social_post');

    if (user) {
      countQuery = countQuery.or(`user_id.eq.${user.id},status.eq.published`);
    } else {
      countQuery = countQuery.eq('status', 'published');
    }

    const { count: publishedPostsCount } = await countQuery;

    // Check for posts with specific statuses
    let statusQuery = supabase
      .from('posts')
      .select('status, post_type')
      .eq('post_type', 'social_post');

    if (user) {
      statusQuery = statusQuery.or(`user_id.eq.${user.id},status.eq.published`);
    } else {
      statusQuery = statusQuery.eq('status', 'published');
    }

    const { data: statusBreakdown } = await statusQuery;

    const statusCounts = (statusBreakdown || []).reduce((acc: any, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    // Loop fetching from RPC, tracking exact position so no posts are skipped
    let postsData: any[] = [];
    let rpcOffset = offset;
    let totalRpcFetched = 0;
    let done = false;

    outer: while (postsData.length < limit && !done) {
      const { data: batch, error } = await supabase.rpc('get_feed_with_engagement_score', {
        p_user_id: user?.id || null,
        p_city: city,
        p_category: category,
        p_limit: limit,
        p_offset: rpcOffset,
        p_as_of: asOf || new Date().toISOString(),
        p_post_type: 'social_post',
        p_hashtag: hashtag || null,
        p_user_city: userCity,
        p_user_country: userCountry,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!batch || batch.length === 0) break;

      for (const post of batch) {
        totalRpcFetched++;
        if (!post.user_id.startsWith('b1000000-') && !post.user_id.startsWith('aaaaaaaa-')) {
          postsData.push(post);
          if (postsData.length >= limit) break outer;
        }
      }

      rpcOffset += batch.length;
      if (batch.length < limit) done = true;
    }

    const error = null;

    const returnedStatusCounts = (postsData || []).reduce((acc: Record<string, number>, post: any) => {
      const status = post.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Posts GET] Feed statistics:', {
        totalPostsInDB: totalPostsCount,
        publishedOrOwnPosts: publishedPostsCount,
        allPostsStatusBreakdown: statusCounts,
        requestedLimit: limit,
        requestedOffset: offset,
        returnedPosts: postsData?.length || 0,
        returnedPostsStatusBreakdown: returnedStatusCounts,
        userId: user?.id || 'anonymous',
        isAuthenticated: !!user
      });
    }

    // Fetch promoted posts separately using service role to bypass RLS
    let promotedPostsData: any[] = [];
    let promotedQueryError: string | null = null;
    if (offset === 0) {
      const serviceSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: promoted, error: promotedError } = await serviceSupabase
        .from('posts')
        .select(`
          id, user_id, text, post_type, created_at, updated_at, is_pinned, pinned_at,
          status, spam_score, rank_penalty, phone_count, link_count, hashtag_count,
          city, category, hashtags, views_count,
          profiles!inner(name, email, account_type, avatar_url)
        `)
        .eq('is_promoted', true)
        .eq('post_type', 'social_post')
        .eq('status', 'published');
      promotedPostsData = promoted || [];
      promotedQueryError = promotedError?.message || null;
    }

    const allPostIds = [
      ...(postsData?.map(p => p.id) || []),
      ...promotedPostsData.map(p => p.id),
    ];
    const postIds = [...new Set(allPostIds)];
    const professionalUserIds = postsData?.filter(p => p.user_account_type === 'professional').map(p => p.user_id) || [];
    let mediaData: any[] = [];
    let reviewsData: any[] = [];

    if (postIds.length > 0) {
      const { data: media } = await supabase
        .from('post_media')
        .select('*')
        .in('post_id', postIds)
        .order('order', { ascending: true });

      mediaData = media || [];
    }

    if (professionalUserIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('pro_id, rating')
        .in('pro_id', professionalUserIds);

      reviewsData = reviews || [];
    }

    const reviewStats = professionalUserIds.reduce((acc, userId) => {
      const userReviews = reviewsData.filter(r => r.pro_id === userId);
      if (userReviews.length > 0) {
        const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
        acc[userId] = {
          average_rating: Math.round(avgRating * 10) / 10,
          review_count: userReviews.length
        };
      }
      return acc;
    }, {} as Record<string, { average_rating: number; review_count: number }>);

    // Fetch is_creator_premium for all post authors
    const allUserIds = [...new Set([
      ...(postsData?.map(p => p.user_id) || []),
      ...promotedPostsData.map(p => p.user_id),
    ])];
    const creatorPremiumMap: Record<string, boolean> = {};
    if (allUserIds.length > 0) {
      const { data: premiumData } = await supabase
        .from('profiles')
        .select('id, is_creator_premium')
        .in('id', allUserIds);
      for (const row of (premiumData || [])) {
        creatorPremiumMap[row.id] = row.is_creator_premium ?? false;
      }
    }

    // Fetch promoted_until for user self-boosted posts
    const promotedUntilMap: Record<string, string | null> = {};
    if (postIds.length > 0) {
      const { data: puData } = await supabase
        .from('posts')
        .select('id, promoted_until')
        .in('id', postIds)
        .gt('promoted_until', new Date().toISOString());
      for (const row of (puData || [])) {
        promotedUntilMap[row.id] = row.promoted_until;
      }
    }

    const postsWithMedia = (postsData?.map(post => ({
      id: post.id,
      user_id: post.user_id,
      text: post.text,
      post_type: post.post_type,
      created_at: post.created_at,
      updated_at: post.updated_at,
      is_pinned: post.is_pinned,
      pinned_at: post.pinned_at,
      status: post.status,
      spam_score: post.spam_score,
      rank_penalty: post.rank_penalty,
      phone_count: post.phone_count,
      link_count: post.link_count,
      hashtag_count: post.hashtag_count,
      city: post.city,
      category: post.category,
      reactions_count: post.reactions_count || 0,
      comments_count: post.comments_count || 0,
      views_count: post.views_count || 0,
      hashtags: post.hashtags || [],
      feed_score: post.feed_score,
      is_promoted: post.is_promoted || false,
      promoted_until: promotedUntilMap[post.id] || null,
      media: mediaData.filter(m => m.post_id === post.id),
      user: {
        name: post.user_name,
        email: post.user_email,
        account_type: post.user_account_type,
        avatar_url: post.user_avatar_url,
        country: post.user_country || null,
        is_creator_premium: creatorPremiumMap[post.user_id] ?? false,
        ...(reviewStats[post.user_id] || {})
      }
    })) || []).filter(post =>
      post.post_type !== 'social_post' || !!post.text?.trim() || post.media.length > 0
    );

    postsWithMedia.sort((a, b) => {
      if (a.media.length > 0 && b.media.length === 0) return -1;
      if (a.media.length === 0 && b.media.length > 0) return 1;
      return 0;
    });
    const combined = [...postsWithMedia];

    // Inject promoted posts at position 2 on first page
    // Use is_promoted from organic combined (sourced from RPC which bypasses RLS)
    // supplemented by any separately fetched promoted posts not in top N
    let postsWithMediaSorted = combined;
    if (offset === 0) {
      const promotedFromOrganic = combined.filter(p => p.is_promoted);
      const promotedFromSeparate = promotedPostsData.filter(
        p => !p.user_id.startsWith('b1000000-') && !p.user_id.startsWith('aaaaaaaa-') &&
             !combined.some(c => c.id === p.id)
      ).map(p => {
        const prof: any = p.profiles;
        return {
          id: p.id,
          user_id: p.user_id,
          text: p.text,
          post_type: p.post_type,
          created_at: p.created_at,
          updated_at: p.updated_at,
          is_pinned: p.is_pinned,
          pinned_at: p.pinned_at,
          status: p.status,
          spam_score: p.spam_score,
          rank_penalty: p.rank_penalty,
          phone_count: p.phone_count,
          link_count: p.link_count,
          hashtag_count: p.hashtag_count,
          city: p.city,
          category: p.category,
          reactions_count: p.reactions_count || 0,
          comments_count: p.comments_count || 0,
          views_count: p.views_count || 0,
          hashtags: p.hashtags || [],
          feed_score: 0,
          is_promoted: true,
          promoted_until: null,
          media: mediaData.filter(m => m.post_id === p.id),
          user: {
            name: prof?.name,
            email: prof?.email,
            account_type: prof?.account_type,
            avatar_url: prof?.avatar_url,
            ...(reviewStats[p.user_id] || {}),
          },
        };
      });

      const allPromoted = [...promotedFromOrganic, ...promotedFromSeparate];
      if (allPromoted.length > 0) {
        const promotedIds = new Set(allPromoted.map(p => p.id));
        const organic = combined.filter(p => !promotedIds.has(p.id));
        postsWithMediaSorted = [
          ...organic.slice(0, 1),
          ...allPromoted,
          ...organic.slice(1),
        ];
      }
    }

    return NextResponse.json({
      data: postsWithMediaSorted,
      meta: {
        totalPostsInDB: totalPostsCount,
        totalAvailablePosts: publishedPostsCount,
        returnedCount: postsWithMedia.length,
        rpcFetchedCount: totalRpcFetched,
        limit,
        offset
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Posts GET] Error:', error);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestId = Math.random().toString(36).substring(7);

    const auth =
      request.headers.get("authorization") ??
      request.headers.get("Authorization") ??
      "";
    const xAccessToken = request.headers.get("x-access-token");

    const match = auth.match(/^Bearer\s+(.+)$/i);
    let token = match?.[1]?.trim();

    if (!token && xAccessToken) {
      token = xAccessToken;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API POST /api/posts ${requestId}] Auth check:`, {
        hasAuthHeader: !!auth,
        authLen: auth.length,
        authPreview: auth.slice(0, 30),
        hasXToken: !!xAccessToken,
        xTokenLen: xAccessToken?.length || 0,
        hasToken: !!token,
        tokenPrefix: token ? token.slice(0, 20) + '...' : 'none'
      });
    }

    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[API POST /api/posts ${requestId}] ❌ Missing Bearer token`);
      }
      const response: any = {
        error: 'Unauthorized',
        details: 'Missing bearer token'
      };
      if (process.env.NODE_ENV !== 'production') {
        response.debug = {
          hasAuthHeader: !!auth,
          authPreview: auth.slice(0, 20),
          authLen: auth.length,
          hasXToken: !!xAccessToken,
          xTokenLen: xAccessToken?.length || 0
        };
      }
      return NextResponse.json(response, { status: 401 });
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[API POST /api/posts ${requestId}] ❌ Invalid token:`, userError?.message);
      }
      const response: any = {
        error: 'Unauthorized',
        details: userError?.message || 'Invalid token'
      };
      if (process.env.NODE_ENV !== 'production') {
        response.debug = {
          hasAuthHeader: !!auth,
          tokenPrefix: token.slice(0, 20) + '...',
          userError: userError?.message
        };
      }
      return NextResponse.json(response, { status: 401 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[API POST /api/posts ${requestId}] ✓ User authenticated:`, user.id);
    }

    const body = await request.json();
    const {
      text,
      title,
      jobTitle,
      postId,
      action,
      isPinned,
      post_type,
      city,
      category,
      hashtags,
      job_title,
      price_type,
      price_value,
      currency,
      experience_level,
      availability
    } = body;

    if (action === 'pin') {
      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .maybeSingle();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You can only pin your own posts' }, { status: 403 });
      }

      if (isPinned) {
        await supabase
          .from('posts')
          .update({ is_pinned: false, pinned_at: null })
          .eq('user_id', user.id)
          .eq('is_pinned', true);

        const { data, error } = await supabase
          .from('posts')
          .update({ is_pinned: true, pinned_at: new Date().toISOString() })
          .eq('id', postId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
      } else {
        const { data, error } = await supabase
          .from('posts')
          .update({ is_pinned: false, pinned_at: null })
          .eq('id', postId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
      }
    }

    if (action === 'update') {
      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      if (!text?.trim()) {
        return NextResponse.json({ error: 'Text is required' }, { status: 400 });
      }

      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .maybeSingle();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You can only update your own posts' }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('posts')
        .update({ text: text.trim() })
        .eq('id', postId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    if (action === 'delete') {
      if (!postId) {
        return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
      }

      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('id, user_id')
        .eq('id', postId)
        .maybeSingle();

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You can only delete your own posts' }, { status: 403 });
      }

      const { data: mediaItems } = await supabase
        .from('post_media')
        .select('url')
        .eq('post_id', postId);

      if (mediaItems && mediaItems.length > 0) {
        const bucketName = 'post-media';
        const storagePaths = mediaItems
          .map(media => {
            const bucketPath = `/storage/v1/object/public/${bucketName}/`;
            const index = media.url.indexOf(bucketPath);
            if (index === -1) return null;
            return media.url.substring(index + bucketPath.length);
          })
          .filter((path): path is string => path !== null);

        if (storagePaths.length > 0) {
          await supabase.storage.from(bucketName).remove(storagePaths);
        }
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[API POST /api/posts] Inserting post:', {
        user_id: user.id,
        text_length: text?.trim()?.length || 0,
        title_length: title?.trim()?.length || 0,
        jobTitle_length: jobTitle?.trim()?.length || 0,
        post_type: post_type || 'social_post',
        city: city || null,
        category: category || null
      });
    }

    const combinedText = [
      text,
      title,
      jobTitle
    ].filter(Boolean).join('\n');

    const postText = text?.trim() || '';

    if (process.env.NODE_ENV !== 'production') {
      console.log('[API POST /api/posts] ANTI SPAM INPUT TEXT:', combinedText);
      console.log('[API POST /api/posts] Text parts:', {
        text: text?.length || 0,
        title: title?.length || 0,
        jobTitle: jobTitle?.length || 0
      });
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[API POST /api/posts ${requestId}] Failed to fetch user profile:`, {
          userId: user.id,
          error: profileError,
          code: (profileError as any)?.code,
          details: (profileError as any)?.details,
          hint: (profileError as any)?.hint
        });
      }
      const response: any = { error: 'Failed to fetch user profile' };
      if (process.env.NODE_ENV !== 'production') {
        response.debug = {
          userId: user.id,
          errorMessage: profileError.message,
          errorCode: (profileError as any)?.code,
          errorDetails: (profileError as any)?.details
        };
      }
      return NextResponse.json(response, { status: 500 });
    }

    if (!userProfile) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[API POST /api/posts ${requestId}] No profile found for user:`, user.id);
      }
      const response: any = { error: 'Profile not found' };
      if (process.env.NODE_ENV !== 'production') {
        response.debug = {
          userId: user.id,
          message: 'No profile exists for this user'
        };
      }
      return NextResponse.json(response, { status: 404 });
    }

    const userProfileData: UserProfile = {
      created_at: userProfile?.created_at || new Date().toISOString(),
      phone_verified: !!userProfile?.phone,
      avg_rating: userProfile?.average_rating,
      review_count: userProfile?.review_count,
      bio: userProfile?.bio,
      city: userProfile?.city,
      categories: userProfile?.category ? [userProfile.category] : undefined,
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: postsLastHour } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    const { count: postsLast24h } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', twentyFourHoursAgo);

    const postingStats: PostingStats = {
      posts_last_hour: postsLastHour || 0,
      posts_last_24h: postsLast24h || 0,
    };

    const { data: existingPostsWithHash } = await supabase
      .from('posts')
      .select('duplicate_hash')
      .eq('user_id', user.id)
      .not('duplicate_hash', 'is', null);

    const existingHashes = new Set((existingPostsWithHash || []).map(p => p.duplicate_hash));

    const spamAnalysis = computeSpamScore(combinedText, userProfileData, postingStats, false, post_type);

    const isDuplicate = existingHashes.has(spamAnalysis.duplicate_hash);
    if (isDuplicate) {
      const updatedAnalysis = computeSpamScore(combinedText, userProfileData, postingStats, true, post_type);
      spamAnalysis.spam_score = updatedAnalysis.spam_score;
      spamAnalysis.status = updatedAnalysis.status;
      spamAnalysis.rank_penalty = updatedAnalysis.rank_penalty;
      spamAnalysis.features = updatedAnalysis.features;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[API POST /api/posts] Spam analysis:', {
        link_count: spamAnalysis.link_count,
        phone_count: spamAnalysis.phone_count,
        spam_score: spamAnalysis.spam_score,
        status: spamAnalysis.status,
        rank_penalty: spamAnalysis.rank_penalty,
        features: spamAnalysis.features,
      });

      if (spamAnalysis.link_count >= 8) {
        console.warn(`[API POST /api/posts] Post has ${spamAnalysis.link_count} links (≥8). Status: ${spamAnalysis.status}`);
      }
    }

    const trimmedCategory = category?.trim().replace(/\s+/g, ' ') || null;
    const trimmedCity = city?.trim().replace(/\s+/g, ' ') || null;

    // Limit service_listing to 2 per user
    if ((post_type || 'social_post') === 'service_listing') {
      const { count } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('post_type', 'service_listing')
        .neq('status', 'deleted');
      if ((count ?? 0) >= 2) {
        return NextResponse.json(
          { error: 'SERVICE_LISTING_LIMIT' },
          { status: 429 }
        );
      }
    }

    const insertData: any = {
      user_id: user.id,
      text: postText || null,
      post_type: post_type || 'social_post',
      city: trimmedCity,
      category: trimmedCategory,
      spam_score: spamAnalysis.spam_score,
      status: spamAnalysis.status === 'shadow_hidden' || spamAnalysis.status === 'shadow_limited' ? spamAnalysis.status : 'published',
      rank_penalty: spamAnalysis.rank_penalty,
      duplicate_hash: spamAnalysis.duplicate_hash,
      link_count: spamAnalysis.link_count,
      phone_count: spamAnalysis.phone_count,
      hashtag_count: spamAnalysis.hashtag_count,
      caps_ratio: spamAnalysis.caps_ratio,
      moderation_reasons: spamAnalysis.moderation_reasons,
      hashtags: Array.isArray(hashtags) ? hashtags.map((h: string) => h.toLowerCase().replace(/^#/, '')) : [],
    };

    if (trimmedCategory) {
      insertData.category_normalized = trimmedCategory.toLowerCase().trim();
    }

    if (job_title) {
      insertData.job_title = job_title;
    }

    if (price_type) {
      insertData.price_type = price_type;
    }

    if (price_value !== undefined && price_value !== null) {
      insertData.price_value = price_value;
    }

    if (currency) {
      insertData.currency = currency;
    }

    if (experience_level) {
      insertData.experience_level = experience_level;
    }

    if (availability) {
      insertData.availability = availability;
    }

    const { data, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[API POST /api/posts] DB INSERT ERROR:', {
          code: (error as any).code,
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
          full_error: error
        });
      }
      const response: any = { error: error.message };
      if (process.env.NODE_ENV !== 'production') {
        response.code = (error as any).code;
        response.details = (error as any).details;
      }
      return NextResponse.json(response, { status: 400 });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[API POST /api/posts] Post created successfully:', {
        id: data.id,
        status: data.status,
        post_type: data.post_type,
        created_at: data.created_at,
        spam_score: data.spam_score,
        rank_penalty: data.rank_penalty
      });
    }

    // Notify subscribers when a new published listing is created
    const notifiableTypes = ['service_listing', 'hiring_post', 'service_request', 'job_seeker_post'];
    if (notifiableTypes.includes(data.post_type) && data.status === 'published') {
      notifySubscribers(
        data.category || null,
        data.city || null,
        data.id,
        insertData.job_title || data.text?.slice(0, 60) || 'Novi oglas',
      ).catch(() => {});
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const response: any = {
      data,
      warnings: spamAnalysis.warnings
    };

    if (isDev) {
      response.debug = {
        hasAuthHeader: !!auth,
        tokenPrefix: token ? token.slice(0, 20) + '...' : 'none',
      };
      response.antiSpamDebug = {
        inputText: combinedText,
        textLength: combinedText.length,
        phone_count: spamAnalysis.phone_count,
        uniquePhones: spamAnalysis.uniquePhones || [],
        phoneDetails: spamAnalysis.phoneDetails || [],
        link_count: spamAnalysis.link_count,
        hashtag_count: spamAnalysis.hashtag_count,
        caps_ratio: spamAnalysis.caps_ratio,
        warnings: spamAnalysis.warnings || [],
        status: spamAnalysis.status,
        spam_score: spamAnalysis.spam_score,
        rank_penalty: spamAnalysis.rank_penalty,
        features: spamAnalysis.features
      };
      console.log('[API POST /api/posts] Debug data:', response.antiSpamDebug);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Posts POST] Error:', error);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const { data: post, error: fetchError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: mediaItems } = await supabase
      .from('post_media')
      .select('url')
      .eq('post_id', postId);

    if (mediaItems && mediaItems.length > 0) {
      const bucketName = 'post-media';
      const storagePaths = mediaItems
        .map(media => {
          const bucketPath = `/storage/v1/object/public/${bucketName}/`;
          const index = media.url.indexOf(bucketPath);
          if (index === -1) return null;
          return media.url.substring(index + bucketPath.length);
        })
        .filter((path): path is string => path !== null);

      if (storagePaths.length > 0) {
        await supabase.storage.from(bucketName).remove(storagePaths);
      }
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
