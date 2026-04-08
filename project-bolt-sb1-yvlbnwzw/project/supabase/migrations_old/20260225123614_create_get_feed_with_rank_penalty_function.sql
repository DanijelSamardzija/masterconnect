/*
  # Create Weighted Feed Function with Rank Penalty

  1. New Function
    - `get_feed_with_ranking(p_user_id, p_city, p_category, p_limit, p_offset)`
    - Returns posts sorted by:
      1. is_pinned DESC (pinned always on top)
      2. effective_rank DESC (newer posts higher, but penalized posts sink faster)
    - effective_rank = created_at_epoch * COALESCE(rank_penalty, 1.0)
    - Only returns status='published' posts
    - Excludes blocked users

  2. Logic
    - Higher rank_penalty (closer to 1.0) = stays higher longer
    - Lower rank_penalty (0.4) = sinks faster as time passes
    - Pinned posts always appear first regardless of penalty
*/

CREATE OR REPLACE FUNCTION get_feed_with_ranking(
  p_user_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
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
    WHERE blocker_id = p_user_id;
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
    -- Calculate effective rank: timestamp * penalty (lower penalty = sinks faster)
    (EXTRACT(EPOCH FROM p.created_at) * COALESCE(p.rank_penalty, 1.0))::numeric AS effective_rank,
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
    -- Then by effective rank (newer * higher penalty = stays on top longer)
    (EXTRACT(EPOCH FROM p.created_at) * COALESCE(p.rank_penalty, 1.0)) DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;