-- Drop existing function variants
DROP FUNCTION IF EXISTS get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text, text);
DROP FUNCTION IF EXISTS get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text);

-- New version with location scoring
CREATE OR REPLACE FUNCTION get_feed_with_engagement_score(
  p_user_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_as_of timestamptz DEFAULT NOW(),
  p_post_type text DEFAULT 'social_post',
  p_hashtag text DEFAULT NULL,
  p_user_city text DEFAULT NULL,
  p_user_country text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  text text,
  post_type text,
  created_at timestamptz,
  updated_at timestamptz,
  is_pinned boolean,
  pinned_at timestamptz,
  status text,
  spam_score int,
  rank_penalty numeric,
  moderation_reasons text[],
  phone_count int,
  link_count int,
  hashtag_count int,
  city text,
  category text,
  hashtags text[],
  views_count bigint,
  reactions_count bigint,
  comments_count bigint,
  feed_score numeric,
  is_promoted boolean,
  user_name text,
  user_email text,
  user_account_type text,
  user_avatar_url text,
  user_country text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  blocked_user_ids uuid[];
BEGIN
  IF p_user_id IS NOT NULL THEN
    SELECT array_agg(blocked_user_id)
    INTO blocked_user_ids
    FROM blocks
    WHERE blocker_user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH post_counts AS (
    SELECT
      p.id AS post_id,
      COALESCE(COUNT(DISTINCT pr.id), 0) AS reactions_count,
      COALESCE(COUNT(DISTINCT pc.id) FILTER (WHERE pc.parent_id IS NULL), 0) AS comments_count
    FROM posts p
    LEFT JOIN post_reactions pr ON pr.post_id = p.id
    LEFT JOIN post_comments pc ON pc.post_id = p.id
    WHERE
      (p_post_type IS NULL OR p.post_type = p_post_type)
      AND (
        (p.user_id = p_user_id) OR (p.status = 'published')
      )
      AND (p_city IS NULL OR p.city = p_city)
      AND (p_category IS NULL OR p.category = p_category)
      AND (blocked_user_ids IS NULL OR NOT (p.user_id = ANY(blocked_user_ids)))
      AND (p_hashtag IS NULL OR p.hashtags @> ARRAY[p_hashtag])
    GROUP BY p.id
  ),
  scored_posts AS (
    SELECT
      p.id,
      p.user_id,
      p.text,
      p.post_type,
      p.created_at,
      p.updated_at,
      p.is_pinned,
      p.pinned_at,
      p.status,
      p.spam_score,
      p.rank_penalty,
      p.moderation_reasons,
      p.phone_count,
      p.link_count,
      p.hashtag_count,
      p.city,
      p.category,
      COALESCE(p.hashtags, ARRAY[]::text[]) AS hashtags,
      COALESCE(p.views_count, 0) AS views_count,
      pc.reactions_count,
      pc.comments_count,
      p.is_promoted,
      prof.name AS user_name,
      prof.email AS user_email,
      prof.account_type AS user_account_type,
      prof.avatar_url AS user_avatar_url,
      prof.country AS user_country,
      -- Feed score with location bonus
      (
        ((pc.reactions_count * 2) + (pc.comments_count * 5))::numeric
        +
        -- Fresh boost
        CASE
          WHEN EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 60 <= 30 THEN 20
          WHEN EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 3600 <= 6 THEN 8
          ELSE 0
        END
        -
        -- Age penalty (max 60 points)
        LEAST(60, (EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 3600) * 0.6)
        -
        -- Spam penalty
        (COALESCE(p.spam_score, 0) * 1.0)
        +
        -- Location bonus
        CASE
          WHEN p_user_city IS NOT NULL AND p.city IS NOT NULL
            AND lower(p.city) = lower(p_user_city) THEN 5.0
          WHEN p_user_country IS NOT NULL AND prof.country IS NOT NULL
            AND lower(prof.country) = lower(p_user_country) THEN 2.0
          ELSE 0
        END
      ) * COALESCE(p.rank_penalty, 1.0) AS feed_score
    FROM posts p
    INNER JOIN post_counts pc ON pc.post_id = p.id
    INNER JOIN profiles prof ON p.user_id = prof.id
  )
  SELECT
    sp.id,
    sp.user_id,
    sp.text,
    sp.post_type,
    sp.created_at,
    sp.updated_at,
    sp.is_pinned,
    sp.pinned_at,
    sp.status,
    sp.spam_score,
    sp.rank_penalty,
    sp.moderation_reasons,
    sp.phone_count,
    sp.link_count,
    sp.hashtag_count,
    sp.city,
    sp.category,
    sp.hashtags,
    sp.views_count,
    sp.reactions_count,
    sp.comments_count,
    sp.feed_score,
    sp.is_promoted,
    sp.user_name,
    sp.user_email,
    sp.user_account_type,
    sp.user_avatar_url,
    sp.user_country
  FROM scored_posts sp
  ORDER BY
    sp.is_pinned DESC,
    sp.pinned_at DESC NULLS LAST,
    sp.feed_score DESC,
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text, text, text, text) TO anon;
