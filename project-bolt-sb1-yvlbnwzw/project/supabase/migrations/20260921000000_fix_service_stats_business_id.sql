-- Fix get_business_service_stats_by_location to accept explicit p_business_id.
-- Previously the function used auth.uid() as the business filter, which only
-- worked for the first profile ever created (whose id happened to equal the
-- owner's auth.uid()). Multi-profile owners always saw the first profile's
-- services regardless of which profile was active.

CREATE OR REPLACE FUNCTION public.get_business_service_stats_by_location(
  p_location_id  UUID DEFAULT NULL,
  p_business_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_business_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  -- Resolve the target business profile
  IF p_business_id IS NOT NULL THEN
    -- Verify ownership before trusting the caller-supplied id
    SELECT id INTO v_business_id
    FROM booking_profiles
    WHERE id = p_business_id
      AND owner_id = v_uid
    LIMIT 1;
    IF v_business_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  ELSE
    -- Fallback: oldest active profile owned by this user
    SELECT id INTO v_business_id
    FROM booking_profiles
    WHERE owner_id = v_uid
      AND is_active = true
    ORDER BY created_at
    LIMIT 1;
    IF v_business_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  END IF;

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
                              ),
          'completed_count',  COUNT(b.id) FILTER (WHERE b.status = 'completed')
        ) AS row_data
        FROM service_catalog sc
        LEFT JOIN bookings b
          ON b.service_id  = sc.id
         AND b.business_id = v_business_id
         AND (p_location_id IS NULL OR b.location_id = p_location_id)
        WHERE sc.business_id = v_business_id
          AND sc.is_active   = true
        GROUP BY sc.id, sc.name, sc.duration_minutes,
                 sc.price, sc.price_type, sc.created_at
      ) sub
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_service_stats_by_location(UUID, UUID) TO authenticated;
