-- matchmaking_results: cache per post (24h TTL)
CREATE TABLE matchmaking_results (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     uuid        UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  extraction  jsonb       NOT NULL,
  ranked_profiles jsonb   NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX idx_mr_post_id    ON matchmaking_results(post_id);
CREATE INDEX idx_mr_expires_at ON matchmaking_results(expires_at);

ALTER TABLE matchmaking_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON matchmaking_results
  FOR SELECT USING (user_id = auth.uid());

-- matchmaking_runs_log: admin analytics + rate limiting
CREATE TABLE matchmaking_runs_log (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id      uuid        NOT NULL,
  user_id      uuid        NOT NULL,
  cache_hit    boolean     NOT NULL DEFAULT false,
  input_tokens integer     DEFAULT 0,
  output_tokens integer    DEFAULT 0,
  cost_usd     numeric(10,6) DEFAULT 0,
  duration_ms  integer     DEFAULT 0,
  post_type    text,
  category     text,
  created_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_mrl_created_at ON matchmaking_runs_log(created_at);
CREATE INDEX idx_mrl_user_id    ON matchmaking_runs_log(user_id);
CREATE INDEX idx_mrl_post_id    ON matchmaking_runs_log(post_id);

ALTER TABLE matchmaking_runs_log ENABLE ROW LEVEL SECURITY;
-- Only service_role (bypasses RLS) can insert/select

-- find_matching_profiles: DB pre-filter (Step 3 in pipeline)
-- Returns up to p_limit professional profiles using GIN search_vector
CREATE OR REPLACE FUNCTION find_matching_profiles(
  p_skills         text[]  DEFAULT '{}',
  p_category       text    DEFAULT NULL,
  p_city           text    DEFAULT NULL,
  p_country        text    DEFAULT NULL,
  p_location_strict boolean DEFAULT false,
  p_exclude_ids    uuid[]  DEFAULT '{}',
  p_limit          integer DEFAULT 100
)
RETURNS TABLE (
  id               uuid,
  name             text,
  bio              text,
  skills           jsonb,
  category         text,
  feed_interests   text[],
  city             text,
  country          text,
  preferred_language text,
  average_rating   numeric,
  review_count     integer,
  last_seen        timestamptz,
  is_premium       boolean,
  portfolio_count  integer,
  pre_score        real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query   tsquery;
  v_part    tsquery;
  v_skill   text;
BEGIN
  -- Build OR tsquery from skills + category
  v_query := NULL;

  FOREACH v_skill IN ARRAY p_skills
  LOOP
    IF v_skill IS NOT NULL AND length(trim(v_skill)) > 2 THEN
      BEGIN
        v_part := plainto_tsquery('simple', v_skill);
        v_query := CASE WHEN v_query IS NULL THEN v_part ELSE v_query || v_part END;
      EXCEPTION WHEN OTHERS THEN
        -- skip malformed skill
      END;
    END IF;
  END LOOP;

  IF p_category IS NOT NULL AND length(trim(p_category)) > 0 THEN
    BEGIN
      v_part := plainto_tsquery('simple', p_category);
      v_query := CASE WHEN v_query IS NULL THEN v_part ELSE v_query || v_part END;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.bio,
    p.skills,
    p.category,
    p.feed_interests,
    p.city,
    p.country,
    p.preferred_language,
    p.average_rating,
    p.review_count,
    p.last_seen,
    p.is_premium,
    (
      SELECT COUNT(*)::integer
      FROM posts pp
      WHERE pp.user_id = p.id AND pp.post_type = 'portfolio_post'
    ) AS portfolio_count,
    CASE
      WHEN p_city    IS NOT NULL AND p.city    ILIKE p_city    THEN 10.0
      WHEN p_country IS NOT NULL AND p.country ILIKE p_country THEN  7.0
      WHEN NOT p_location_strict                               THEN  3.0
      ELSE                                                          0.0
    END::real AS pre_score
  FROM profiles p
  WHERE
    p.account_type = 'professional'
    AND p.last_seen > (now() - interval '90 days')
    AND (
      p_exclude_ids IS NULL
      OR array_length(p_exclude_ids, 1) IS NULL
      OR NOT (p.id = ANY(p_exclude_ids))
    )
    AND (
      NOT p_location_strict
      OR (p_city    IS NOT NULL AND p.city    ILIKE p_city)
      OR (p_country IS NOT NULL AND p.country ILIKE p_country)
    )
    AND (v_query IS NULL OR p.search_vector @@ v_query)
  ORDER BY pre_score DESC, p.average_rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
