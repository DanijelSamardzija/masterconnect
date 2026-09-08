-- Audit log for AI translation calls (rate limiting + cost tracking)

CREATE TABLE IF NOT EXISTS ai_translation_log (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_id    uuid         NOT NULL,
  target_lang   text         NOT NULL CHECK (target_lang IN ('sr','en','de','es','fr')),
  cache_hit     boolean      NOT NULL DEFAULT false,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10,6),
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Used by rate-limit query: user + fresh + last 24h
CREATE INDEX IF NOT EXISTS idx_atl_user_date
  ON ai_translation_log(user_id, created_at DESC)
  WHERE NOT cache_hit;

ALTER TABLE ai_translation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages translation log"
  ON ai_translation_log FOR ALL TO service_role
  USING (true);

GRANT ALL ON ai_translation_log TO service_role;

-- Admin view for translation costs
CREATE OR REPLACE VIEW v_translation_cost_daily AS
SELECT
  date_trunc('day', created_at)           AS day,
  COUNT(*) FILTER (WHERE NOT cache_hit)   AS fresh_translations,
  COUNT(*) FILTER (WHERE cache_hit)       AS cache_hits,
  COUNT(DISTINCT user_id)                 AS unique_users,
  ROUND(SUM(cost_usd)::numeric, 4)        AS total_cost_usd
FROM ai_translation_log
GROUP BY 1
ORDER BY 1 DESC;
