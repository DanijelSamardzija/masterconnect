-- Extend matchmaking_runs_log: nullable post_id, pipeline_type, admin views

-- 1. post_id no longer required (reverse pipeline has no post)
ALTER TABLE matchmaking_runs_log
  ALTER COLUMN post_id DROP NOT NULL;

-- 2. Track which AI pipeline generated this run
ALTER TABLE matchmaking_runs_log
  ADD COLUMN IF NOT EXISTS pipeline_type text
  NOT NULL DEFAULT 'forward'
  CHECK (pipeline_type IN ('forward', 'reverse', 'notify', 'translate', 'guidance'));

-- 3. Composite index for fast rate-limit counting (user + type + time, fresh only)
CREATE INDEX IF NOT EXISTS idx_mrl_user_type_date
  ON matchmaking_runs_log(user_id, pipeline_type, created_at DESC)
  WHERE NOT cache_hit;

-- 4. Updated stats RPC with per-pipeline breakdown
CREATE OR REPLACE FUNCTION get_matchmaking_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_runs',          COUNT(*),
    'cache_hits',          COUNT(*) FILTER (WHERE cache_hit = true),
    'cache_hit_rate_pct',  ROUND(
                             COUNT(*) FILTER (WHERE cache_hit = true)::numeric
                             / NULLIF(COUNT(*), 0) * 100, 1),
    'total_cost_usd',      ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
    'avg_duration_ms',     ROUND(AVG(duration_ms) FILTER (WHERE NOT cache_hit))::int,
    'total_input_tokens',  COALESCE(SUM(input_tokens)::bigint, 0),
    'total_output_tokens', COALESCE(SUM(output_tokens)::bigint, 0),
    'runs_last_7d',        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND NOT cache_hit),
    'runs_last_30d',       COUNT(*) FILTER (WHERE created_at > now() - interval '30 days' AND NOT cache_hit),
    'by_pipeline', (
      SELECT COALESCE(jsonb_object_agg(pipeline_type, stats), '{}'::jsonb)
      FROM (
        SELECT pipeline_type,
               jsonb_build_object(
                 'fresh',    COUNT(*) FILTER (WHERE NOT cache_hit),
                 'cached',   COUNT(*) FILTER (WHERE cache_hit),
                 'cost_usd', ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4)
               ) AS stats
        FROM matchmaking_runs_log
        GROUP BY pipeline_type
      ) sub
    ),
    'top_categories', (
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

-- 5. Admin cost views (readable only via service_role due to RLS on source table)
CREATE OR REPLACE VIEW v_ai_cost_daily AS
SELECT
  date_trunc('day', created_at)           AS day,
  pipeline_type,
  COUNT(*) FILTER (WHERE NOT cache_hit)   AS fresh_runs,
  COUNT(*) FILTER (WHERE cache_hit)       AS cache_hits,
  COUNT(DISTINCT user_id)                 AS unique_users,
  ROUND(SUM(cost_usd)::numeric, 4)        AS total_cost_usd,
  ROUND(AVG(cost_usd) FILTER (WHERE NOT cache_hit)::numeric, 6) AS avg_cost_per_run
FROM matchmaking_runs_log
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW v_ai_cost_per_user AS
SELECT
  l.user_id,
  p.name                                                                    AS user_name,
  p.is_premium,
  ROUND(SUM(l.cost_usd)::numeric, 4)                                        AS total_cost_usd,
  COUNT(*) FILTER (WHERE NOT l.cache_hit)                                    AS fresh_runs,
  COUNT(*) FILTER (WHERE NOT l.cache_hit AND l.pipeline_type = 'forward')   AS forward_runs,
  COUNT(*) FILTER (WHERE NOT l.cache_hit AND l.pipeline_type = 'reverse')   AS reverse_runs
FROM matchmaking_runs_log l
  JOIN profiles p ON p.id = l.user_id
WHERE l.created_at > now() - interval '30 days'
GROUP BY l.user_id, p.name, p.is_premium
ORDER BY total_cost_usd DESC;
