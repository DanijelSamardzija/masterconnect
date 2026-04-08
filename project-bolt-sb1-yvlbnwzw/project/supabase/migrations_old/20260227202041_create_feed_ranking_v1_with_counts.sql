/*
  # Feed Ranking Algorithm v1 with Engagement Counts

  ## Summary
  Creates a new feed ranking function that calculates engagement counts (reactions, comments)
  and computes a weighted score for each post based on freshness, engagement, and spam indicators.

  ## Changes
  1. **New Function**: `get_feed_with_engagement_score`
     - Returns posts with pre-calculated `reactions_count` and `comments_count`
     - Calculates a weighted `feed_score` for each post
     - Supports filtering by post_type, city, category
     - Excludes blocked users
     - Shows author's own posts regardless of status, others see only published

  ## Scoring Logic
  - **Base Score**: (reactions_count × 2) + (comments_count × 5)
  - **Fresh Boost**: +20 if ≤30 min old, +8 if ≤6 hours old
  - **Age Penalty**: min(60, age_in_hours × 0.6)
  - **Spam Penalty**: spam_score × 1.0 (direct penalty)
  - **Final Score**: (rawScore) × rank_penalty (multiplier, default 1.0)

  ## Sorting
  1. Pinned posts first (by pinned_at DESC)
  2. Regular posts by feed_score DESC
  3. Tie-breaker: created_at DESC

  ## Return Fields
  - All post fields including status, spam_score, rank_penalty
  - reactions_count (calculated)
  - comments_count (calculated)
  - feed_score (calculated)
  - User data (name, email, account_type, avatar_url)
*/

-- Drop existing function if exists
DROP FUNCTION IF EXISTS get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text);

-- Create new feed ranking function
CREATE OR REPLACE FUNCTION get_feed_with_engagement_score(
  p_user_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_as_of timestamptz DEFAULT NOW(),
  p_post_type text DEFAULT 'social_post'
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
  reactions_count bigint,
  comments_count bigint,
  feed_score numeric,
  user_name text,
  user_email text,
  user_account_type text,
  user_avatar_url text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  blocked_user_ids uuid[];
BEGIN
  -- Get list of blocked users if user_id is provided
  IF p_user_id IS NOT NULL THEN
    SELECT array_agg(blocked_user_id)
    INTO blocked_user_ids
    FROM blocks
    WHERE blocker_user_id = p_user_id;
  END IF;

  RETURN QUERY
  WITH post_counts AS (
    -- Calculate reactions and comments counts per post
    SELECT
      p.id AS post_id,
      COALESCE(COUNT(DISTINCT pr.id), 0) AS reactions_count,
      COALESCE(COUNT(DISTINCT pc.id), 0) AS comments_count
    FROM posts p
    LEFT JOIN post_reactions pr ON pr.post_id = p.id
    LEFT JOIN post_comments pc ON pc.post_id = p.id
    WHERE
      -- Filter by post_type
      (p_post_type IS NULL OR p.post_type = p_post_type)
      -- Author sees their own posts regardless of status, others only see published
      AND (
        (p.user_id = p_user_id) OR (p.status = 'published')
      )
      -- Filter by city if provided
      AND (p_city IS NULL OR p.city = p_city)
      -- Filter by category if provided
      AND (p_category IS NULL OR p.category = p_category)
      -- Exclude blocked users
      AND (blocked_user_ids IS NULL OR NOT (p.user_id = ANY(blocked_user_ids)))
    GROUP BY p.id
  ),
  scored_posts AS (
    -- Calculate feed score for each post
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
      pc.reactions_count,
      pc.comments_count,
      prof.name AS user_name,
      prof.email AS user_email,
      prof.account_type AS user_account_type,
      prof.avatar_url AS user_avatar_url,
      -- Calculate feed score
      (
        -- Base score from engagement
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
    sp.reactions_count,
    sp.comments_count,
    sp.feed_score,
    sp.user_name,
    sp.user_email,
    sp.user_account_type,
    sp.user_avatar_url
  FROM scored_posts sp
  ORDER BY
    -- Pinned posts first
    sp.is_pinned DESC,
    sp.pinned_at DESC NULLS LAST,
    -- Then by feed score
    sp.feed_score DESC,
    -- Tie-breaker
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_with_engagement_score(uuid, text, text, integer, integer, timestamptz, text) TO anon;

-- Add indexes to improve performance
CREATE INDEX IF NOT EXISTS idx_posts_type_status_created 
  ON posts(post_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_pinned 
  ON posts(is_pinned, pinned_at DESC) 
  WHERE is_pinned = true;
