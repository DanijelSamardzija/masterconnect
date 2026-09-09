-- Matchmaking Audit Fixes — P1 + P4
-- ─────────────────────────────────────────────────────────────────────────────
-- P4: Add p_exclude_ids to find_matching_posts_for_profile() so reverse
--     matching honours the same blocks system as forward matching.
--
-- P1: Add get_recent_matchmaking_runs() SECURITY DEFINER RPC so the admin
--     UI can read the last N rows from matchmaking_runs_log without an
--     open SELECT policy on that table (which is service_role-only).

-- ─── P4: drop old signature and recreate with exclude list ────────────────────

DROP FUNCTION IF EXISTS find_matching_posts_for_profile(uuid, int);

CREATE OR REPLACE FUNCTION find_matching_posts_for_profile(
  p_profile_id  uuid,
  p_limit       int     DEFAULT 50,
  p_exclude_ids uuid[]  DEFAULT '{}'
)
RETURNS TABLE (
  id               uuid,
  job_title        text,
  profession       text,
  text_snippet     text,
  post_type        text,
  category         text,
  city             text,
  country          text,
  min_price        numeric,
  max_price        numeric,
  price_type       text,
  currency         text,
  experience_level text,
  created_at       timestamptz,
  owner_id         uuid,
  owner_name       text,
  pre_score        int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_category        text;
  v_work_categories text[];
  v_city            text;
  v_country         text;
BEGIN
  SELECT p.category, p.work_categories, p.city, p.country
  INTO v_category, v_work_categories, v_city, v_country
  FROM profiles p
  WHERE p.id = p_profile_id;

  RETURN QUERY
  SELECT
    po.id,
    po.job_title,
    po.profession,
    LEFT(po.text, 300)   AS text_snippet,
    po.post_type,
    po.category,
    po.city,
    po.country,
    po.min_price,
    po.max_price,
    po.price_type,
    po.currency,
    po.experience_level,
    po.created_at::timestamptz,
    po.user_id            AS owner_id,
    pr.name               AS owner_name,
    (
      CASE WHEN v_category IS NOT NULL
                AND LOWER(po.category) = LOWER(v_category)         THEN 4 ELSE 0 END
      + CASE WHEN v_work_categories IS NOT NULL
                  AND v_work_categories @> ARRAY[po.category]      THEN 2 ELSE 0 END
      + CASE WHEN v_city IS NOT NULL
                  AND LOWER(po.city) = LOWER(v_city)               THEN 2 ELSE 0 END
      + CASE WHEN v_country IS NOT NULL
                  AND LOWER(po.country) = LOWER(v_country)         THEN 1 ELSE 0 END
      + CASE WHEN po.created_at > now() - interval '7 days'        THEN 2
             WHEN po.created_at > now() - interval '30 days'       THEN 1
             ELSE 0 END
    )::int AS pre_score
  FROM posts    po
  LEFT JOIN profiles pr ON pr.id = po.user_id
  WHERE
    po.post_type IN ('hiring_post', 'service_request')
    AND po.is_active   = true
    AND po.created_at  > now() - interval '60 days'
    AND po.user_id    != p_profile_id
    AND (
      array_length(p_exclude_ids, 1) IS NULL
      OR NOT (po.user_id = ANY(p_exclude_ids))
    )
    AND (
      v_category IS NULL
      OR LOWER(po.category) = LOWER(v_category)
      OR (v_work_categories IS NOT NULL AND v_work_categories @> ARRAY[po.category])
    )
  ORDER BY pre_score DESC, po.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION find_matching_posts_for_profile(uuid, int, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_matching_posts_for_profile(uuid, int, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION find_matching_posts_for_profile(uuid, int, uuid[]) TO service_role;

-- ─── P1: admin RPC for recent runs (bypasses RLS, admin-only) ────────────────

CREATE OR REPLACE FUNCTION get_recent_matchmaking_runs(p_limit int DEFAULT 20)
RETURNS TABLE (
  id            uuid,
  post_id       uuid,
  user_id       uuid,
  cache_hit     boolean,
  cost_usd      numeric,
  duration_ms   integer,
  post_type     text,
  category      text,
  pipeline_type text,
  created_at    timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.post_id,
    r.user_id,
    r.cache_hit,
    r.cost_usd,
    r.duration_ms,
    r.post_type,
    r.category,
    r.pipeline_type,
    r.created_at
  FROM matchmaking_runs_log r
  ORDER BY r.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION get_recent_matchmaking_runs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_recent_matchmaking_runs(int) TO authenticated;
