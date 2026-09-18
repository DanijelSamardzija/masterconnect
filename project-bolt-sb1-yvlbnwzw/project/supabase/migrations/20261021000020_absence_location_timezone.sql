-- ==========================================================================
-- Fix: create_staff_absence and public_get_staff_absences use primary
-- location timezone even when the staff member is assigned to a different
-- location (potentially in a different timezone).
--
-- Fix: prefer staff member's assigned location timezone, fall back to
-- business primary location timezone.
-- ==========================================================================

-- ── 1. create_staff_absence ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_staff_absence(
  p_staff_member_id UUID,
  p_date_from       DATE,
  p_date_to         DATE,
  p_reason          TEXT    DEFAULT 'vacation',
  p_note            TEXT    DEFAULT NULL,
  p_force           BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID;
  v_biz_id        UUID;
  v_caller_role   TEXT;
  v_timezone      TEXT;
  v_starts_at     TIMESTAMPTZ;
  v_ends_at       TIMESTAMPTZ;
  v_booking_count INTEGER;
  v_absence_id    UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dates_required');
  END IF;

  IF p_date_to < p_date_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'date_to_before_date_from');
  END IF;

  IF p_reason IS NULL OR p_reason NOT IN ('vacation', 'sick_leave', 'holiday', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  -- Use the staff member's assigned location timezone; fall back to primary.
  SELECT sm.business_id,
         COALESCE(bl_asgn.timezone, bl_prim.timezone) AS timezone
  INTO   v_biz_id, v_timezone
  FROM   staff_members sm
  LEFT JOIN business_locations bl_asgn ON bl_asgn.id = sm.primary_location_id
                                       AND bl_asgn.is_active = true
  JOIN      business_locations bl_prim ON bl_prim.business_id = sm.business_id
                                       AND bl_prim.is_primary = true
  WHERE  sm.id = p_staff_member_id AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_member_not_found');
  END IF;

  SELECT role INTO v_caller_role
  FROM   staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  v_starts_at := (p_date_from::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;
  v_ends_at   := ((p_date_to + 1)::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone;

  SELECT COUNT(*)
  INTO   v_booking_count
  FROM   bookings b
  WHERE  b.staff_member_id = p_staff_member_id
    AND  b.status          IN ('pending', 'confirmed')
    AND  b.starts_at        < v_ends_at
    AND  b.ends_at          > v_starts_at;

  IF v_booking_count > 0 AND NOT p_force THEN
    RETURN jsonb_build_object(
      'ok',            false,
      'warning',       'has_bookings',
      'booking_count', v_booking_count
    );
  END IF;

  INSERT INTO time_blocks (entity_type, staff_member_id, starts_at, ends_at, reason, note)
  VALUES ('staff', p_staff_member_id, v_starts_at, v_ends_at, p_reason, p_note)
  RETURNING id INTO v_absence_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'absence_id',    v_absence_id,
    'booking_count', v_booking_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_absence(UUID, DATE, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── 2. public_get_staff_absences ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.public_get_staff_absences(
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'reason',    tb.reason,
        'note',      tb.note,
        'date_from', (tb.starts_at AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::DATE,
        'date_to',   ((tb.ends_at  AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::DATE - 1)
      )
      ORDER BY tb.starts_at ASC
    ),
    '[]'::jsonb
  )
  FROM   time_blocks tb
  JOIN   staff_members sm       ON sm.id = tb.staff_member_id
  LEFT JOIN business_locations bl_asgn ON bl_asgn.id = sm.primary_location_id
                                       AND bl_asgn.is_active = true
  JOIN      business_locations bl_prim ON bl_prim.business_id = sm.business_id
                                       AND bl_prim.is_primary = true
  WHERE  tb.staff_member_id = p_staff_member_id
    AND  tb.entity_type     = 'staff'
    AND  tb.ends_at         > now();
$$;

GRANT EXECUTE ON FUNCTION public.public_get_staff_absences(UUID) TO anon, authenticated;
