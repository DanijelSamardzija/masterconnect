-- ==========================================================================
-- Add sick_leave reason + public closure RPC for anon booking page
--
-- Changes:
--   1. Expand time_blocks.reason CHECK to include 'sick_leave'
--   2. Update create_business_closure() to accept 'sick_leave'
--   3. Add public_get_business_closures() — accessible to anon for booking page
-- ==========================================================================

-- ── 1. Expand reason CHECK ────────────────────────────────────────────────

ALTER TABLE public.time_blocks
  DROP CONSTRAINT IF EXISTS time_blocks_reason_check;

ALTER TABLE public.time_blocks
  ADD CONSTRAINT time_blocks_reason_check
    CHECK (reason IN ('holiday', 'vacation', 'blocked', 'break', 'renovation', 'other', 'sick_leave'));

-- ── 2. Update create_business_closure to accept sick_leave ────────────────

CREATE OR REPLACE FUNCTION public.create_business_closure(
  p_location_id UUID,
  p_date_from   DATE,
  p_date_to     DATE,
  p_reason      TEXT    DEFAULT 'vacation',
  p_note        TEXT    DEFAULT NULL,
  p_force       BOOLEAN DEFAULT false
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
  v_closure_id    UUID;
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

  IF p_reason IS NULL OR p_reason NOT IN ('holiday', 'vacation', 'renovation', 'other', 'blocked', 'break', 'sick_leave') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  SELECT bl.business_id, bl.timezone
  INTO   v_biz_id, v_timezone
  FROM   business_locations bl
  WHERE  bl.id = p_location_id AND bl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
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
  WHERE  b.business_id = v_biz_id
    AND  b.status      IN ('pending', 'confirmed')
    AND  b.starts_at    < v_ends_at
    AND  b.ends_at      > v_starts_at;

  IF v_booking_count > 0 AND NOT p_force THEN
    RETURN jsonb_build_object(
      'ok',            false,
      'warning',       'has_bookings',
      'booking_count', v_booking_count
    );
  END IF;

  INSERT INTO time_blocks (entity_type, location_id, starts_at, ends_at, reason, note)
  VALUES (
    'business',
    p_location_id,
    v_starts_at,
    v_ends_at,
    COALESCE(p_reason, 'vacation'),
    p_note
  )
  RETURNING id INTO v_closure_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'closure_id',    v_closure_id,
    'booking_count', v_booking_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_business_closure(UUID, DATE, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── 3. public_get_business_closures — accessible to anon ─────────────────
-- Returns only active and upcoming closures (not past).
-- Used on the booking page to inform customers of temporary closures.

CREATE OR REPLACE FUNCTION public.public_get_business_closures(
  p_location_id UUID
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
        'date_from', (tb.starts_at AT TIME ZONE bl.timezone)::DATE,
        'date_to',   ((tb.ends_at  AT TIME ZONE bl.timezone)::DATE - 1)
      )
      ORDER BY tb.starts_at ASC
    ),
    '[]'::jsonb
  )
  FROM time_blocks tb
  JOIN business_locations bl ON bl.id = tb.location_id
  WHERE tb.location_id = p_location_id
    AND tb.entity_type = 'business'
    AND tb.ends_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.public_get_business_closures(UUID) TO anon, authenticated;
