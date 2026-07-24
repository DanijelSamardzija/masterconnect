-- Profile Full Text Search
--
-- Adds a computed search_vector to profiles (same pattern as posts).
-- Weights:
--   A = name            (what users search for first)
--   B = category, city, country (profession + location context)
--   C = bio             (longer description, lowest priority)
--
-- Uses 'simple' dictionary: lowercases + accent-strips, works for SR/EN/DE.
-- GENERATED ALWAYS AS STORED means no trigger needed — Postgres keeps it current.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name,     '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city,     '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(country,  '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(bio,      '')), 'C')
  ) STORED;

-- GIN index: O(log N) FTS lookups
CREATE INDEX IF NOT EXISTS idx_profiles_search_vector
  ON profiles USING gin(search_vector);

-- search_profiles RPC
--
-- p_search: raw user input (e.g. "nikola" or "barber novi sad")
-- The function builds a prefix tsquery internally so partial words match.
-- Falls back to ILIKE on name/category/city for resilience.

CREATE OR REPLACE FUNCTION search_profiles(
  p_search text,
  p_limit  int DEFAULT 8
)
RETURNS TABLE (
  id             uuid,
  name           text,
  category       text,
  city           text,
  country        text,
  account_type   text,
  is_premium     boolean,
  average_rating numeric,
  review_count   integer,
  avatar_url     text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_tsquery text;
BEGIN
  -- Build "word1:* & word2:* ..." from raw input (safe, strips non-alphanumerics)
  SELECT string_agg(clean_word || ':*', ' & ')
    INTO v_tsquery
    FROM (
      SELECT regexp_replace(lower(trim(word)), '[^[:alnum:]]', '', 'g') AS clean_word
      FROM regexp_split_to_table(trim(p_search), '\s+') AS word
      WHERE regexp_replace(lower(trim(word)), '[^[:alnum:]]', '', 'g') <> ''
    ) AS words;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category,
    p.city,
    p.country,
    p.account_type,
    p.is_premium,
    p.average_rating,
    p.review_count,
    p.avatar_url
  FROM profiles p
  WHERE
    p.is_banned IS NOT TRUE
    AND (
      (v_tsquery IS NOT NULL AND p.search_vector @@ to_tsquery('simple', v_tsquery))
      OR lower(p.name)     LIKE '%' || lower(p_search) || '%'
      OR lower(p.category) LIKE '%' || lower(p_search) || '%'
      OR lower(p.city)     LIKE '%' || lower(p_search) || '%'
    )
  ORDER BY
    p.is_premium       DESC,
    p.average_rating   DESC NULLS LAST,
    p.review_count     DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_profiles(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_profiles(text, int) TO anon;
