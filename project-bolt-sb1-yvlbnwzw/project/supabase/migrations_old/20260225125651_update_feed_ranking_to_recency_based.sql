/*
  # Update Feed Ranking to Recency-Based Formula

  1. Changes
    - Replace epoch-based ranking with recency decay formula
    - New formula: effective_rank = (1 / (1 + age_minutes)) * rank_penalty
    - Ensures newer posts stay on top, but penalized posts sink faster over time

  2. Logic
    - age_minutes = minutes since post creation
    - Newer posts have higher base rank (1/smaller_denominator)
    - rank_penalty multiplier (0.4 vs 1.0) makes penalized posts sink faster
    - Example: 1 min old with 0.4 penalty beats 10 min old with 1.0 penalty
    - But as time passes, penalized posts decay faster

  3. Sorting
    - is_pinned DESC (pinned always first)
    - effective_rank DESC (recency * penalty)
    - created_at DESC (fallback for ties)
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
    -- Calculate effective rank: recency decay * penalty (lower penalty = sinks faster)
    (
      (1.0 / (1.0 + (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 60.0)))
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
    -- Then by effective rank (recency * penalty = newer posts higher, but penalty makes them sink faster)
    (
      (1.0 / (1.0 + (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 60.0)))
      * COALESCE(p.rank_penalty, 1.0)
    ) DESC,
    -- Fallback to created_at for ties
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;