CREATE OR REPLACE FUNCTION get_daily_new_users(range_from timestamptz, range_to timestamptz)
RETURNS TABLE(date text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    COUNT(*) AS count
  FROM profiles
  WHERE created_at >= range_from AND created_at <= range_to
  GROUP BY to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
$$;
