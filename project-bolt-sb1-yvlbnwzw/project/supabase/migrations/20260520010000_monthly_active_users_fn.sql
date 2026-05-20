-- Aggregate monthly active users server-side to avoid row limit issues
CREATE OR REPLACE FUNCTION get_monthly_active_users(
  year_start timestamptz,
  year_end   timestamptz
)
RETURNS TABLE(month text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
    COUNT(DISTINCT user_id) AS count
  FROM page_views
  WHERE created_at >= year_start AND created_at < year_end
  GROUP BY to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM')
  ORDER BY month;
$$;
