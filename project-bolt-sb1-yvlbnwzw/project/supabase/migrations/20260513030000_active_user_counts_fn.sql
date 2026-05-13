-- Server-side distinct user counts so analytics never hits row limits
CREATE OR REPLACE FUNCTION get_active_user_counts(
  today_start timestamptz,
  week_start  timestamptz,
  month_start timestamptz,
  year_start  timestamptz,
  year_end    timestamptz
)
RETURNS TABLE(dau bigint, wau bigint, mau bigint, yau bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE created_at >= today_start)                              AS dau,
    (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE created_at >= week_start)                               AS wau,
    (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE created_at >= month_start)                              AS mau,
    (SELECT COUNT(DISTINCT user_id) FROM page_views WHERE created_at >= year_start AND created_at < year_end)     AS yau;
$$;
