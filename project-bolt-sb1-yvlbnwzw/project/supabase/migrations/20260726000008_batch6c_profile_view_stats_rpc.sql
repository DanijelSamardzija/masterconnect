-- Batch 6C: get_profile_view_stats() RPC
-- Replaces the unbounded profile_views fetch in dashboard/page.tsx fetchProfileViews.
--
-- Before: SELECT viewer_id, viewed_at FROM profile_views WHERE profile_id = X
--         → all rows transferred to browser; JS deduplication + date filtering
-- After:  COUNT(DISTINCT viewer_id) with inline CASE filters — 3 numbers, no rows.
--
-- Index already exists: idx_profile_views_profile_viewed ON profile_views(profile_id, viewed_at DESC)
-- created in 20260410000000_profile_views.sql — covers the profile_id = auth.uid() filter.
--
-- Security: auth.uid() directly — no profile_id parameter to spoof.
-- Note: "today" uses date_trunc('day', now() AT TIME ZONE 'UTC').
--       Existing client used local midnight. Difference is at most a few hours
--       and only affects the "today" bucket — acceptable for analytics display.

CREATE OR REPLACE FUNCTION get_profile_view_stats()
RETURNS TABLE (today bigint, this_week bigint, total bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    COUNT(DISTINCT CASE WHEN viewed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') THEN viewer_id END) AS today,
    COUNT(DISTINCT CASE WHEN viewed_at >= now() - interval '7 days'                   THEN viewer_id END) AS this_week,
    COUNT(DISTINCT viewer_id)                                                                              AS total
  FROM profile_views
  WHERE profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_profile_view_stats() TO authenticated;
