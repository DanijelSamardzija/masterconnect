-- Fix: jsonb_agg cannot nest aggregate functions (COUNT inside jsonb_agg)
-- Solution: compute counts in a subquery, then wrap with jsonb_agg

CREATE OR REPLACE FUNCTION public.get_business_service_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data ORDER BY (row_data->>'created_at'))
      FROM (
        SELECT jsonb_build_object(
          'id',               sc.id,
          'name',             sc.name,
          'duration_minutes', sc.duration_minutes,
          'price',            sc.price,
          'price_type',       sc.price_type,
          'created_at',       sc.created_at,
          'upcoming_count',   COUNT(b.id) FILTER (
                                WHERE b.starts_at >= now()
                                  AND b.status IN ('pending', 'confirmed')
                              ),
          'pending_count',    COUNT(b.id) FILTER (WHERE b.status = 'pending'),
          'total_count',      COUNT(b.id) FILTER (
                                WHERE b.status IN ('confirmed', 'completed', 'no_show')
                              )
        ) AS row_data
        FROM service_catalog sc
        LEFT JOIN bookings b
          ON b.service_id  = sc.id
         AND b.business_id = v_uid
        WHERE sc.business_id = v_uid
          AND sc.is_active   = true
        GROUP BY sc.id, sc.name, sc.duration_minutes,
                 sc.price, sc.price_type, sc.created_at
      ) sub
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_service_stats() TO authenticated;
