-- ─────────────────────────────────────────────────────────────────────────────
-- Matchmaking Faza 5 — Reverse Matching: find posts for a professional profile
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_matching_posts_for_profile(
  p_profile_id  uuid,
  p_limit       int DEFAULT 50
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
      v_category IS NULL
      OR LOWER(po.category) = LOWER(v_category)
      OR (v_work_categories IS NOT NULL AND v_work_categories @> ARRAY[po.category])
    )
  ORDER BY pre_score DESC, po.created_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION find_matching_posts_for_profile(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_matching_posts_for_profile(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION find_matching_posts_for_profile(uuid, int) TO service_role;
