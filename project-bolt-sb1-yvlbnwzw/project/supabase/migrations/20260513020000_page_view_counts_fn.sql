-- Server-side aggregation so admin analytics never hits row limits
CREATE OR REPLACE FUNCTION get_page_view_counts()
RETURNS TABLE(page text, count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT page, COUNT(*)::bigint AS count
  FROM page_views
  GROUP BY page
  ORDER BY count DESC;
$$;
