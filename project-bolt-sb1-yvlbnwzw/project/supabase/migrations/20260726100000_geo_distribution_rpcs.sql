-- Geo distribution RPCs: DB-side aggregation to bypass PostgREST max-rows limit

CREATE OR REPLACE FUNCTION get_country_distribution()
RETURNS TABLE (country text, cnt bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT country, COUNT(*) AS cnt
  FROM profiles
  WHERE country IS NOT NULL AND country != ''
  GROUP BY country
  ORDER BY cnt DESC;
$$;

CREATE OR REPLACE FUNCTION get_city_distribution()
RETURNS TABLE (city text, cnt bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT city, COUNT(*) AS cnt
  FROM profiles
  WHERE city IS NOT NULL AND city != ''
  GROUP BY city
  ORDER BY cnt DESC;
$$;

-- Returns COUNT DISTINCT — no row-limit issue since result is a scalar
CREATE OR REPLACE FUNCTION get_unique_poster_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT user_id) FROM posts;
$$;
