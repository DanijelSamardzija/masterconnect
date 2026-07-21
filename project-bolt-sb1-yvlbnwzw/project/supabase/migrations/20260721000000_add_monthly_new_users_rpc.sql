CREATE OR REPLACE FUNCTION get_monthly_new_users(year_start timestamptz, year_end timestamptz)
RETURNS TABLE(month text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
    COUNT(*) AS count
  FROM profiles
  WHERE created_at >= year_start AND created_at < year_end
  GROUP BY date_trunc('month', created_at)
  ORDER BY month;
$$;
