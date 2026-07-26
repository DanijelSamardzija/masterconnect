-- Exclude admin users from all page_view-based analytics RPCs.
-- Returning user definition: first page_view before the period start (visit-based, not account-age-based).

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
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv JOIN profiles p ON p.id = pv.user_id WHERE pv.created_at >= today_start AND (p.is_admin IS NULL OR p.is_admin = false)) AS dau,
    (SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv JOIN profiles p ON p.id = pv.user_id WHERE pv.created_at >= week_start  AND (p.is_admin IS NULL OR p.is_admin = false)) AS wau,
    (SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv JOIN profiles p ON p.id = pv.user_id WHERE pv.created_at >= month_start AND (p.is_admin IS NULL OR p.is_admin = false)) AS mau,
    (SELECT COUNT(DISTINCT pv.user_id) FROM page_views pv JOIN profiles p ON p.id = pv.user_id WHERE pv.created_at >= year_start AND pv.created_at < year_end AND (p.is_admin IS NULL OR p.is_admin = false)) AS yau;
$$;

CREATE OR REPLACE FUNCTION get_daily_active_users(week_start timestamptz)
RETURNS TABLE(date text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(pv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
    COUNT(DISTINCT pv.user_id) AS count
  FROM page_views pv
  JOIN profiles p ON p.id = pv.user_id
  WHERE pv.created_at >= week_start
    AND (p.is_admin IS NULL OR p.is_admin = false)
  GROUP BY to_char(pv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  ORDER BY date;
$$;

CREATE OR REPLACE FUNCTION get_monthly_active_users(
  year_start timestamptz,
  year_end   timestamptz
)
RETURNS TABLE(month text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    to_char(pv.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
    COUNT(DISTINCT pv.user_id) AS count
  FROM page_views pv
  JOIN profiles p ON p.id = pv.user_id
  WHERE pv.created_at >= year_start AND pv.created_at < year_end
    AND (p.is_admin IS NULL OR p.is_admin = false)
  GROUP BY to_char(pv.created_at AT TIME ZONE 'UTC', 'YYYY-MM')
  ORDER BY month;
$$;

CREATE OR REPLACE FUNCTION get_page_view_counts()
RETURNS TABLE(page text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pv.page, COUNT(*)::bigint AS count
  FROM page_views pv
  JOIN profiles p ON p.id = pv.user_id
  WHERE (p.is_admin IS NULL OR p.is_admin = false)
  GROUP BY pv.page
  ORDER BY count DESC;
$$;

-- Returning users: first page_view was before the period (visit-based definition).
-- Novi = first page_view within the period. Invariant: MAU = Novi + Povratni.
CREATE OR REPLACE FUNCTION get_returning_user_count(month_ago_start timestamptz)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_visit AS (
    SELECT pv.user_id, MIN(pv.created_at) AS prva_posjeta
    FROM page_views pv
    JOIN profiles p ON p.id = pv.user_id
    WHERE pv.user_id IS NOT NULL
      AND (p.is_admin IS NULL OR p.is_admin = false)
    GROUP BY pv.user_id
  )
  SELECT COUNT(DISTINCT pv.user_id)
  FROM page_views pv
  JOIN first_visit fv ON fv.user_id = pv.user_id
  WHERE pv.created_at >= month_ago_start
    AND fv.prva_posjeta < month_ago_start;
$$;
