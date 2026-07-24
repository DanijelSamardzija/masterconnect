-- search_posts: server-side filtered, paginated post search
-- Scoring is inlined as pure SQL CASE expressions — no dependency on
-- calculate_post_score, no per-row subqueries.
--
-- Improvements over get_posts_with_score:
--   * Optional filters: FTS (p_search), city, country, category
--   * Server-side pagination: p_limit / p_offset
--   * total_count via COUNT(*) OVER() — single DB round-trip
--   * is_premium, user.country, is_promoted, promoted_until returned directly
--     (eliminates the two extra queries jobs-client used to make)

CREATE OR REPLACE FUNCTION search_posts(
  p_post_types text[],
  p_search     text DEFAULT NULL,
  p_city       text DEFAULT NULL,
  p_country    text DEFAULT NULL,
  p_category   text DEFAULT NULL,
  p_limit      int  DEFAULT 25,
  p_offset     int  DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  user_id          uuid,
  text             text,
  post_type        text,
  job_title        text,
  profession       text,
  category         text,
  city             text,
  country          text,
  experience_level text,
  location         text,
  availability     text,
  price_type       text,
  price_value      numeric,
  currency         text,
  created_at       timestamptz,
  promoted_until   timestamptz,
  is_promoted      boolean,
  user_data        jsonb,
  score            numeric,
  total_count      bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.user_id,
      p.text,
      p.post_type,
      p.job_title,
      p.profession,
      p.category,
      p.city,
      p.country,
      p.experience_level,
      p.location,
      p.availability,
      p.price_type,
      p.price_value,
      p.currency,
      p.created_at,
      p.promoted_until,
      COALESCE(p.is_promoted, false) AS is_promoted,
      jsonb_build_object(
        'name',         prof.name,
        'email',        prof.email,
        'account_type', prof.account_type,
        'avatar_url',   prof.avatar_url,
        'is_premium',   COALESCE(prof.is_premium, false),
        'country',      prof.country
      ) AS user_data,
      EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400 AS age_days
    FROM posts p
    INNER JOIN profiles prof ON prof.id = p.user_id
    WHERE
      p.post_type = ANY(p_post_types)
      AND p.is_active = true
      AND (p.status IS NULL OR p.status = 'published')
      AND (p_search   IS NULL OR p.search_vector @@ to_tsquery('simple', p_search))
      AND (p_city     IS NULL OR lower(p.city) LIKE '%' || lower(p_city) || '%')
      AND (p_country  IS NULL OR p.country = p_country)
      AND (p_category IS NULL OR p.category = p_category)
  ),
  scored AS (
    SELECT
      b.*,
      CASE
        WHEN b.post_type = 'job_seeker_post' THEN
          -- Recency tiers (5-50) + completeness bonuses (0-30)
          CASE
            WHEN b.age_days <= 1 THEN 50
            WHEN b.age_days <= 3 THEN 30
            WHEN b.age_days <= 7 THEN 15
            ELSE 5
          END
          + CASE WHEN length(coalesce(b.text, '')) > 100 THEN 10 ELSE 0 END
          + CASE WHEN b.experience_level IS NOT NULL AND b.experience_level != '' THEN 10 ELSE 0 END
          + CASE WHEN b.availability IS NOT NULL AND b.availability != '' THEN 10 ELSE 0 END
        ELSE
          -- service_request / hiring_post: decay from base 100
          GREATEST(5::numeric, LEAST(110::numeric,
            100 - CASE
              WHEN b.age_days <= 2  THEN b.age_days * 5
              WHEN b.age_days <= 7  THEN 10 + (b.age_days - 2)  * 4
              WHEN b.age_days <= 14 THEN 30 + (b.age_days - 7)  * 2.86
              WHEN b.age_days <= 30 THEN 50 + (b.age_days - 14) * 1.88
              ELSE 80 + LEAST((b.age_days - 30) * 0.5, 15)
            END
          ))
      END AS computed_score
    FROM base b
  )
  SELECT
    s.id,
    s.user_id,
    s.text,
    s.post_type,
    s.job_title,
    s.profession,
    s.category,
    s.city,
    s.country,
    s.experience_level,
    s.location,
    s.availability,
    s.price_type,
    s.price_value,
    s.currency,
    s.created_at,
    s.promoted_until,
    s.is_promoted,
    s.user_data,
    s.computed_score AS score,
    COUNT(*) OVER()  AS total_count
  FROM scored s
  ORDER BY
    (s.is_promoted OR (s.promoted_until IS NOT NULL AND s.promoted_until > now())) DESC,
    s.computed_score DESC,
    s.created_at     DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION search_posts(text[], text, text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_posts(text[], text, text, text, text, int, int) TO anon;
