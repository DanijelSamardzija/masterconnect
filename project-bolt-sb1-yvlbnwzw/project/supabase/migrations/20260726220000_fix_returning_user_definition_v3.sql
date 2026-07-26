-- Returning users: old accounts (registered before the period) who were active in the period.
-- New users (registered within the period) who are active are counted as Novi = MAU - Povratni.
-- Invariant: MAU = Novi + Povratni
CREATE OR REPLACE FUNCTION get_returning_user_count(month_ago_start timestamptz)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT pv.user_id)
  FROM page_views pv
  JOIN profiles p ON p.id = pv.user_id
  WHERE pv.created_at >= month_ago_start
    AND p.created_at  <  month_ago_start;
$$;
