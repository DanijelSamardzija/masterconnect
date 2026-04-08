/*
  # Rank Penalty Optimizations

  1. Changes
    - Add CHECK constraint to clamp rank_penalty between 0.1 and 1.0
    - Update SQL function to accept as_of timestamp for stable pagination
    - Add performance indexes for feed queries

  2. Constraints
    - rank_penalty MUST be between 0.1 and 1.0
    - Prevents invalid values (0, negative, or > 1.0)
    - Default remains 1.0 for non-spam posts

  3. Stable Pagination
    - Accept as_of timestamp parameter
    - Use same reference time across paginated requests
    - Prevents posts "dancing" between pages

  4. Performance Indexes
    - Index on (status, is_pinned, created_at) for feed queries
    - Index on (user_id, created_at) for rate limiting
    - Ensures fast queries as data grows
*/

-- Add CHECK constraint to clamp rank_penalty between 0.1 and 1.0
ALTER TABLE posts
DROP CONSTRAINT IF EXISTS posts_rank_penalty_range;

ALTER TABLE posts
ADD CONSTRAINT posts_rank_penalty_range
CHECK (rank_penalty >= 0.1 AND rank_penalty <= 1.0);

-- Update existing posts that might be outside the range
UPDATE posts
SET rank_penalty = GREATEST(0.1, LEAST(1.0, COALESCE(rank_penalty, 1.0)))
WHERE rank_penalty IS NULL OR rank_penalty < 0.1 OR rank_penalty > 1.0;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_posts_feed_query
ON posts (status, is_pinned, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_user_created
ON posts (user_id, created_at DESC);

-- Drop old function
DROP FUNCTION IF EXISTS get_feed_with_ranking(uuid, text, text, int, int);

-- Create updated function with as_of parameter
CREATE OR REPLACE FUNCTION get_feed_with_ranking(
  p_user_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_as_of timestamptz DEFAULT NOW()
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
  city text,
  category text,
  effective_rank numeric,
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
    p.city,
    p.category,
    -- Calculate effective rank using stable as_of timestamp: recency decay * penalty
    (
      (1.0 / (1.0 + (EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 60.0)))
      * COALESCE(p.rank_penalty, 1.0)
    )::numeric AS effective_rank,
    prof.name AS user_name,
    prof.email AS user_email,
    prof.account_type AS user_account_type,
    prof.avatar_url AS user_avatar_url
  FROM posts p
  INNER JOIN profiles prof ON p.user_id = prof.id
  WHERE
    -- Only published posts
    p.status = 'published'
    -- Filter by city if provided
    AND (p_city IS NULL OR p.city = p_city)
    -- Filter by category if provided
    AND (p_category IS NULL OR p.category = p_category)
    -- Exclude blocked users
    AND (blocked_user_ids IS NULL OR NOT (p.user_id = ANY(blocked_user_ids)))
  ORDER BY
    -- Pinned posts always first
    p.is_pinned DESC,
    -- Then by effective rank (recency * penalty)
    (
      (1.0 / (1.0 + (EXTRACT(EPOCH FROM (p_as_of - p.created_at)) / 60.0)))
      * COALESCE(p.rank_penalty, 1.0)
    ) DESC,
    -- Fallback to created_at for ties
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;