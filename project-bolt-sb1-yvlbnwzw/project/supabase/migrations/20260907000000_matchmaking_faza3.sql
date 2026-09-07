-- =============================================================
-- Matchmaking Faza 3: monetizacija + Faza 2 dopune
-- =============================================================

-- ── Faza 2 (dopune) ── opcione kolone na profiles ────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate_min numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate_max numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_categories  text[];

-- ── Faza 2 (dopune) ── Admin analytics RPC ───────────────────
CREATE OR REPLACE FUNCTION get_matchmaking_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_runs',          COUNT(*),
    'cache_hits',          COUNT(*) FILTER (WHERE cache_hit = true),
    'cache_hit_rate',      ROUND(
                             COUNT(*) FILTER (WHERE cache_hit = true)::numeric
                             / NULLIF(COUNT(*), 0) * 100, 1),
    'total_cost_usd',      ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
    'avg_duration_ms',     ROUND(AVG(duration_ms) FILTER (WHERE NOT cache_hit))::int,
    'total_input_tokens',  COALESCE(SUM(input_tokens)::bigint, 0),
    'total_output_tokens', COALESCE(SUM(output_tokens)::bigint, 0),
    'runs_last_7d',        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND NOT cache_hit),
    'runs_last_30d',       COUNT(*) FILTER (WHERE created_at > now() - interval '30 days' AND NOT cache_hit),
    'top_categories',      (
      SELECT COALESCE(jsonb_agg(r ORDER BY r->>'count' DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object('category', category, 'count', COUNT(*)) AS r
        FROM matchmaking_runs_log
        WHERE category IS NOT NULL AND NOT cache_hit
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 5
      ) sub
    )
  )
  INTO v_result
  FROM matchmaking_runs_log;
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_matchmaking_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_matchmaking_stats() TO authenticated;

-- ── Faza 3 ── matchmaking_boosts ─────────────────────────────
-- Profesionalci plaćaju 30 kredita da budu prioritetni (7 dana)
CREATE TABLE IF NOT EXISTS matchmaking_boosts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credits_spent integer NOT NULL DEFAULT 30,
  boost_score  integer NOT NULL DEFAULT 15 CHECK (boost_score >= 0 AND boost_score <= 15),
  valid_until  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matchmaking_boosts_profile_valid_idx
  ON matchmaking_boosts(profile_id, valid_until DESC);

ALTER TABLE matchmaking_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own boosts"
  ON matchmaking_boosts FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Admins view all boosts"
  ON matchmaking_boosts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role manages boosts"
  ON matchmaking_boosts FOR ALL TO service_role
  USING (true);

GRANT ALL ON matchmaking_boosts TO service_role;

-- ── Faza 3 ── matchmaking_unlock_log ─────────────────────────
-- Prati koje je korisnik otključao oglase (50 kredita)
CREATE TABLE IF NOT EXISTS matchmaking_unlock_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id      uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  credits_spent integer NOT NULL DEFAULT 50,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS matchmaking_unlock_log_user_id_idx
  ON matchmaking_unlock_log(user_id);

ALTER TABLE matchmaking_unlock_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own unlocks"
  ON matchmaking_unlock_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all unlocks"
  ON matchmaking_unlock_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role manages unlocks"
  ON matchmaking_unlock_log FOR ALL TO service_role
  USING (true);

GRANT ALL ON matchmaking_unlock_log TO service_role;

-- ── Faza 3 ── matchmaking_feedback_log ───────────────────────
-- Thumbs down (negative feedback) na kandidatima — za buduće prompt fine-tuning
CREATE TABLE IF NOT EXISTS matchmaking_feedback_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id              uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  candidate_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feedback             text NOT NULL DEFAULT 'negative' CHECK (feedback IN ('positive', 'negative')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id, candidate_profile_id)
);

CREATE INDEX IF NOT EXISTS matchmaking_feedback_log_post_id_idx
  ON matchmaking_feedback_log(post_id);

ALTER TABLE matchmaking_feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
  ON matchmaking_feedback_log FOR ALL TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all feedback"
  ON matchmaking_feedback_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Service role manages feedback"
  ON matchmaking_feedback_log FOR ALL TO service_role
  USING (true);

GRANT ALL ON matchmaking_feedback_log TO service_role;
