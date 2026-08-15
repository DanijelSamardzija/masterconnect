-- search_feed_posts: server-side search for social_post rows
--
-- Searches by BOTH post content (search_vector FTS) AND author name (ILIKE).
-- This means typing a person's name returns their posts even if the post text
-- does not contain the name — fixing the client-side "only searches loaded batch" bug.
--
-- Returns the same column shape as get_feed_with_engagement_score so the
-- existing /api/posts assembly code (media, reviews, is_premium, etc.) works
-- without modification.
--
-- Called via /api/posts?search=<query> — the route switches from
-- get_feed_with_engagement_score to this function when the param is present.

CREATE OR REPLACE FUNCTION search_feed_posts(
  p_search  text,
  p_user_id uuid DEFAULT NULL,
  p_limit   int  DEFAULT 10
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  text              text,
  post_type         text,
  created_at        timestamptz,
  updated_at        timestamptz,
  is_pinned         boolean,
  pinned_at         timestamptz,
  status            text,
  spam_score        int,
  rank_penalty      numeric,
  moderation_reasons text[],
  phone_count       int,
  link_count        int,
  hashtag_count     int,
  city              text,
  category          text,
  hashtags          text[],
  reactions_count   bigint,
  comments_count    bigint,
  views_count       bigint,
  feed_score        numeric,
  is_promoted       boolean,
  user_name         text,
  user_email        text,
  user_account_type text,
  user_avatar_url   text,
  user_country      text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tsquery text;
BEGIN
  -- Sanitise input: strip non-alphanumeric chars, build prefix tsquery
  -- (same pattern as search_profiles to avoid invalid tsquery errors)
  SELECT string_agg(clean_word || ':*', ' & ')
    INTO v_tsquery
    FROM (
      SELECT regexp_replace(lower(trim(word)), '[^[:alnum:]]', '', 'g') AS clean_word
      FROM regexp_split_to_table(trim(p_search), '\s+') AS word
      WHERE regexp_replace(lower(trim(word)), '[^[:alnum:]]', '', 'g') <> ''
    ) AS words;

  RETURN QUERY
  WITH counts AS (
    SELECT
      p.id                                          AS post_id,
      COALESCE(COUNT(DISTINCT pr.id), 0)::bigint    AS reactions_count,
      COALESCE(COUNT(DISTINCT pc.id), 0)::bigint    AS comments_count
    FROM posts p
    LEFT JOIN post_reactions pr ON pr.post_id = p.id
    LEFT JOIN post_comments  pc ON pc.post_id = p.id
    INNER JOIN profiles prof ON prof.id = p.user_id
    WHERE
      p.post_type = 'social_post'
      AND p.is_active = true
      AND (p.status IS NULL OR p.status = 'published')
      AND prof.is_banned IS NOT TRUE
      AND (
        (v_tsquery IS NOT NULL AND p.search_vector @@ to_tsquery('simple', v_tsquery))
        OR lower(prof.name) LIKE '%' || lower(p_search) || '%'
      )
    GROUP BY p.id
  )
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
    COALESCE(p.hashtags, '{}')           AS hashtags,
    c.reactions_count,
    c.comments_count,
    COALESCE(p.views_count, 0)::bigint   AS views_count,
    -- simplified feed score: engagement - age decay
    (
      (c.reactions_count * 2 + c.comments_count * 5)::numeric
      - LEAST(60.0, EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 * 0.6)
    ) * COALESCE(p.rank_penalty, 1.0)    AS feed_score,
    COALESCE(p.is_promoted, false)       AS is_promoted,
    prof.name                            AS user_name,
    prof.email                           AS user_email,
    prof.account_type                    AS user_account_type,
    prof.avatar_url                      AS user_avatar_url,
    prof.country                         AS user_country
  FROM posts p
  INNER JOIN profiles prof ON prof.id = p.user_id
  INNER JOIN counts  c    ON c.post_id = p.id
  ORDER BY
    COALESCE(p.is_promoted, false) DESC,
    feed_score                     DESC,
    p.created_at                   DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_feed_posts(text, uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_feed_posts(text, uuid, int) TO anon;
