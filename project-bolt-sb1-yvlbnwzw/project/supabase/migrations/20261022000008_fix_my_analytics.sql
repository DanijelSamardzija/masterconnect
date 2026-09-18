-- Fix get_my_analytics: service_name_snapshot must be aggregated or in GROUP BY
-- Use MAX() for snapshot columns + group only by service_id

CREATE OR REPLACE FUNCTION public.get_my_analytics(
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_location_id UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_tz        TEXT;
  v_from      TIMESTAMPTZ;
  v_to        TIMESTAMPTZ;
  v_summary   JSONB;
  v_by_svc    JSONB;
  v_locations JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT bl.timezone INTO v_tz
  FROM   staff_members sm
  JOIN   business_locations bl ON bl.business_id = sm.business_id
                               AND bl.is_primary  = true
                               AND bl.is_active   = true
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
  LIMIT 1;
  v_tz := COALESCE(v_tz, 'Europe/Sarajevo');

  IF p_date_from IS NOT NULL THEN
    v_from := (p_date_from::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to := ((p_date_to + 1)::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;

  SELECT jsonb_build_object(
    'completed', COUNT(*),
    'revenue',   COALESCE(ROUND(SUM(
                   COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                 ), 2), 0)
  ) INTO v_summary
  FROM   bookings b
  JOIN   staff_members sm ON sm.id       = b.staff_member_id
                         AND sm.user_id   = v_uid
                         AND sm.is_active = true
  LEFT   JOIN service_catalog sc ON sc.id = b.service_id
  WHERE  b.status = 'completed'
    AND  (p_location_id IS NULL OR b.location_id = p_location_id)
    AND  (v_from IS NULL        OR b.starts_at  >= v_from)
    AND  (v_to   IS NULL        OR b.starts_at  <  v_to);

  -- Group by service_id only; use MAX() for name columns
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'completed')::int DESC), '[]'::jsonb)
  INTO   v_by_svc
  FROM (
    SELECT jsonb_build_object(
      'service_id',   COALESCE(b.service_id::TEXT, ''),
      'service_name', COALESCE(MAX(b.service_name_snapshot), MAX(sc.name), '—'),
      'completed',    COUNT(*),
      'avg_price',    ROUND(AVG(COALESCE(b.price_snapshot, sc.price, 0)), 2),
      'revenue',      ROUND(SUM(COALESCE(b.price_snapshot, sc.price, 0) * b.party_size), 2)
    ) AS row_data
    FROM   bookings b
    JOIN   staff_members sm ON sm.id       = b.staff_member_id
                           AND sm.user_id   = v_uid
                           AND sm.is_active = true
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.status = 'completed'
      AND  (p_location_id IS NULL OR b.location_id = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at  >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at  <  v_to)
    GROUP  BY b.service_id
  ) sub;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', bl.id, 'name', bl.name)
    ORDER BY bl.name
  ), '[]'::jsonb) INTO v_locations
  FROM (
    SELECT DISTINCT bl.id, bl.name
    FROM   staff_members sm
    JOIN   business_locations bl ON bl.business_id = sm.business_id
                                 AND bl.is_active   = true
    WHERE  sm.user_id   = v_uid
      AND  sm.is_active = true
  ) bl;

  RETURN jsonb_build_object(
    'ok',         true,
    'summary',    v_summary,
    'by_service', v_by_svc,
    'locations',  v_locations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_analytics(DATE, DATE, UUID) TO authenticated;
