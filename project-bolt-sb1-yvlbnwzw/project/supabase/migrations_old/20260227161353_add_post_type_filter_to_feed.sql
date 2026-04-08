/*
  # Add post_type filter to feed function

  1. Changes
    - Add p_post_type parameter to feed function (default 'social_post')
    - Filter posts by post_type to ensure feed only shows relevant posts
    - This fixes the issue where feed was returning all post types (job_listing, service_listing, etc)

  2. Rationale
    - Feed page should only show social_post type
    - Jobs and services have their own dedicated pages
    - This reduces confusion and improves pagination accuracy
*/

DROP FUNCTION IF EXISTS get_feed_with_ranking(uuid, text, text, integer, integer, timestamptz);

CREATE OR REPLACE FUNCTION get_feed_with_ranking(
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
    p.moderation_reasons,
    p.city,
    p.category,
    -- Calculate effective rank: recency decay * penalty (lower penalty = sinks faster)
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
  ORDER BY
    -- Pinned posts always first
    p.is_pinned DESC,
    -- Then by effective rank (recency * penalty = newer posts higher, but penalty makes them sink faster)
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