-- ==========================================================================
-- Analytics: filter staff by primary_location_id when p_location_id is given
--
-- Before: by_staff and staff_service_breakdown filtered only by b.location_id
--         (where the booking happened), so staff from other locations could
--         appear if they had a booking at that location.
-- After:  when p_location_id is given, also require sm.primary_location_id = p_location_id
--         so analytics respects the staff assignment, not just booking location.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_booking_analytics(
  p_location_id UUID    DEFAULT NULL,
  p_date_from   DATE    DEFAULT NULL,
  p_date_to     DATE    DEFAULT NULL,
  p_staff_id    UUID    DEFAULT NULL,
  p_service_id  UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_biz_id   UUID;
  v_tz       TEXT;
  v_from     TIMESTAMPTZ;
  v_to       TIMESTAMPTZ;
  v_summary  JSONB;
  v_by_staff JSONB;
  v_by_svc   JSONB;
  v_svc_brk  JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
    AND  sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT bl.timezone INTO v_tz
  FROM   business_locations bl
  WHERE  bl.business_id = v_biz_id
    AND  bl.is_primary  = true
    AND  bl.is_active   = true
  LIMIT 1;
  v_tz := COALESCE(v_tz, 'Europe/Sarajevo');

  IF p_date_from IS NOT NULL THEN
    v_from := (p_date_from::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;
  IF p_date_to IS NOT NULL THEN
    v_to := ((p_date_to + 1)::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_tz;
  END IF;

  -- Summary: filter bookings by location (booking location, not staff assignment)
  SELECT jsonb_build_object(
    'total_bookings', COUNT(*),
    'completed',      COUNT(*) FILTER (WHERE b.status = 'completed'),
    'no_shows',       COUNT(*) FILTER (WHERE b.status = 'no_show'),
    'cancelled',      COUNT(*) FILTER (WHERE b.status = 'cancelled'),
    'revenue',        COALESCE(SUM(
                        CASE WHEN b.status = 'completed'
                        THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                        ELSE 0 END
                      ), 0)
  ) INTO v_summary
  FROM   bookings b
  LEFT JOIN service_catalog sc ON sc.id = b.service_id
  WHERE  b.business_id  = v_biz_id
    AND  (p_location_id IS NULL OR b.location_id      = p_location_id)
    AND  (v_from IS NULL        OR b.starts_at        >= v_from)
    AND  (v_to   IS NULL        OR b.starts_at        <  v_to)
    AND  (p_staff_id IS NULL    OR b.staff_member_id  = p_staff_id)
    AND  (p_service_id IS NULL  OR b.service_id       = p_service_id);

  -- By staff: filter by BOTH booking location AND staff assignment location
  -- so only staff assigned to the selected location appear in the cards.
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'revenue')::numeric DESC), '[]'::jsonb)
  INTO   v_by_staff
  FROM (
    SELECT jsonb_build_object(
      'staff_member_id', b.staff_member_id::TEXT,
      'staff_name',      COALESCE(MAX(p.name), '—'),
      'completed',       COUNT(*) FILTER (WHERE b.status = 'completed'),
      'no_shows',        COUNT(*) FILTER (WHERE b.status = 'no_show'),
      'revenue',         COALESCE(SUM(
                           CASE WHEN b.status = 'completed'
                           THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                           ELSE 0 END
                         ), 0)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN staff_members sm ON sm.id  = b.staff_member_id
    LEFT   JOIN profiles p        ON p.id   = sm.user_id
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.business_id  = v_biz_id
      AND  (p_location_id IS NULL OR b.location_id          = p_location_id)
      AND  (p_location_id IS NULL OR sm.primary_location_id = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at            >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at            <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id      = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id           = p_service_id)
    GROUP  BY b.staff_member_id
  ) sub;

  -- By service total
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'revenue')::numeric DESC), '[]'::jsonb)
  INTO   v_by_svc
  FROM (
    SELECT jsonb_build_object(
      'service_id',   COALESCE(b.service_id::TEXT, ''),
      'service_name', COALESCE(MAX(b.service_name_snapshot), '—'),
      'completed',    COUNT(*) FILTER (WHERE b.status = 'completed'),
      'no_shows',     COUNT(*) FILTER (WHERE b.status = 'no_show'),
      'revenue',      COALESCE(SUM(
                        CASE WHEN b.status = 'completed'
                        THEN COALESCE(b.price_snapshot, sc.price, 0) * b.party_size
                        ELSE 0 END
                      ), 0)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.business_id  = v_biz_id
      AND  (p_location_id IS NULL OR b.location_id     = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at       >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at       <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id      = p_service_id)
    GROUP  BY b.service_id
  ) sub;

  -- Staff × Service breakdown: also filter by staff assignment location
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'staff_name', (row_data->>'revenue')::numeric DESC), '[]'::jsonb)
  INTO   v_svc_brk
  FROM (
    SELECT jsonb_build_object(
      'staff_member_id', b.staff_member_id::TEXT,
      'staff_name',      COALESCE(MAX(p.name), '—'),
      'service_id',      COALESCE(b.service_id::TEXT, ''),
      'service_name',    COALESCE(MAX(b.service_name_snapshot), '—'),
      'completed',       COUNT(*),
      'avg_price',       ROUND(AVG(COALESCE(b.price_snapshot, sc.price, 0)), 2),
      'revenue',         ROUND(SUM(COALESCE(b.price_snapshot, sc.price, 0) * b.party_size), 2)
    ) AS row_data
    FROM   bookings b
    LEFT   JOIN staff_members sm ON sm.id  = b.staff_member_id
    LEFT   JOIN profiles p        ON p.id   = sm.user_id
    LEFT   JOIN service_catalog sc ON sc.id = b.service_id
    WHERE  b.business_id   = v_biz_id
      AND  b.status        = 'completed'
      AND  (p_location_id IS NULL OR b.location_id          = p_location_id)
      AND  (p_location_id IS NULL OR sm.primary_location_id = p_location_id)
      AND  (v_from IS NULL        OR b.starts_at            >= v_from)
      AND  (v_to   IS NULL        OR b.starts_at            <  v_to)
      AND  (p_staff_id IS NULL    OR b.staff_member_id      = p_staff_id)
      AND  (p_service_id IS NULL  OR b.service_id           = p_service_id)
    GROUP  BY b.staff_member_id, b.service_id, b.service_name_snapshot
  ) sub;

  RETURN jsonb_build_object(
    'ok',                      true,
    'summary',                 v_summary,
    'by_staff',                v_by_staff,
    'by_service',              v_by_svc,
    'staff_service_breakdown', v_svc_brk
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_analytics(UUID, DATE, DATE, UUID, UUID) TO authenticated;
