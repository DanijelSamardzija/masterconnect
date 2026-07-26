-- Returning users: visited on 2+ distinct calendar days in the period
-- Previous definition (registered 30+ days ago) was too restrictive.
-- New definition captures users who genuinely came back, regardless of account age.
CREATE OR REPLACE FUNCTION get_returning_user_count(month_ago_start timestamptz)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM (
    SELECT user_id
    FROM page_views
    WHERE created_at >= month_ago_start
      AND user_id IS NOT NULL
    GROUP BY user_id
    HAVING COUNT(DISTINCT created_at::date) > 1
  ) t;
$$;
