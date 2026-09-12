-- ==========================================================================
-- Staff self-service schedule RPCs
-- New RPCs (all require active staff membership + matching permission flag):
--   set_my_staff_hours      — staff sets own shift schedule
--   add_my_time_block       — staff adds vacation/block/break
--   get_my_time_blocks      — staff reads own future time blocks
--   delete_my_time_block    — staff deletes own time block
--   staff_create_booking    — staff books a slot (skips opening hours check)
-- ==========================================================================

-- ── set_my_staff_hours ────────────────────────────────────────────────────
-- Upserts one day's schedule for the calling staff member.
-- Requires: permissions.can_set_hours = true

CREATE OR REPLACE FUNCTION public.set_my_staff_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_open_time   TIME,
  p_close_time  TIME,
  p_is_closed   BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_sm_id  UUID;
  v_biz_id UUID;
  v_perms  JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT sm.id, sm.business_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_set_hours')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order
  ) VALUES (
    'staff', v_sm_id, p_location_id, p_day_of_week,
    COALESCE(p_open_time,  '09:00'::TIME),
    COALESCE(p_close_time, '17:00'::TIME),
    COALESCE(p_is_closed, false),
    0
  )
  ON CONFLICT (staff_member_id, location_id, day_of_week, sort_order)
  WHERE entity_type = 'staff'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'::TIME),
    end_time   = COALESCE(p_close_time, '17:00'::TIME),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN) TO authenticated;

-- ── add_my_time_block ─────────────────────────────────────────────────────
-- Requires: permissions.can_block_time = true

CREATE OR REPLACE FUNCTION public.add_my_time_block(
  p_starts_at TIMESTAMPTZ,
  p_ends_at   TIMESTAMPTZ,
  p_reason    TEXT DEFAULT 'vacation',
  p_note      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_sm_id UUID;
  v_perms JSONB;
  v_new_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_ends_at IS NULL OR p_starts_at IS NULL OR p_ends_at <= p_starts_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_range');
  END IF;

  IF p_reason NOT IN ('holiday', 'vacation', 'blocked', 'break') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  SELECT sm.id, sm.permissions
  INTO v_sm_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_block_time')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  INSERT INTO time_blocks (entity_type, staff_member_id, starts_at, ends_at, reason, note)
  VALUES ('staff', v_sm_id, p_starts_at, p_ends_at, p_reason, p_note)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'block_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_my_time_block(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;

-- ── get_my_time_blocks ────────────────────────────────────────────────────
-- Returns the caller's own upcoming time blocks.

CREATE OR REPLACE FUNCTION public.get_my_time_blocks()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_sm_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT sm.id INTO v_sm_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',        tb.id,
          'starts_at', tb.starts_at,
          'ends_at',   tb.ends_at,
          'reason',    tb.reason,
          'note',      tb.note
        )
        ORDER BY tb.starts_at
      )
      FROM time_blocks tb
      WHERE tb.staff_member_id = v_sm_id
        AND tb.ends_at > now()
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_time_blocks() TO authenticated;

-- ── delete_my_time_block ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_time_block(
  p_block_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_sm_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id INTO v_sm_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  DELETE FROM time_blocks
  WHERE id = p_block_id AND staff_member_id = v_sm_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_time_block(UUID) TO authenticated;

-- ── staff_create_booking ──────────────────────────────────────────────────
-- Creates a booking on behalf of a walk-in or phone client.
-- Skips opening-hours and min-notice checks (staff override).
-- Double-booking check is still enforced.
-- Requires: permissions.can_create_bookings = true

CREATE OR REPLACE FUNCTION public.staff_create_booking(
  p_service_id UUID,
  p_starts_at  TIMESTAMPTZ,
  p_notes      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_sm     RECORD;
  v_svc    RECORD;
  v_ends_at TIMESTAMPTZ;
  v_new_id  UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.primary_location_id, sm.permissions
  INTO v_sm
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_sm.permissions->>'can_create_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT sc.name, sc.duration_minutes, sc.buffer_minutes, sc.booking_type
  INTO v_svc
  FROM service_catalog sc
  WHERE sc.id = p_service_id
    AND sc.business_id = v_sm.business_id
    AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_svc.duration_minutes);

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN service_catalog sc2 ON sc2.id = b.service_id
    WHERE b.staff_member_id = v_sm.id
      AND b.status IN ('pending', 'confirmed')
      AND p_starts_at < (b.ends_at + make_interval(mins => COALESCE(sc2.buffer_minutes, 0)))
      AND b.starts_at < (v_ends_at + make_interval(mins => COALESCE(v_svc.buffer_minutes, 0)))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, location_id,
    starts_at, ends_at, notes,
    status, confirmation_mode, payment_status
  ) VALUES (
    v_svc.booking_type, v_sm.business_id, v_uid,
    p_service_id, v_svc.name, v_svc.duration_minutes,
    v_sm.id, v_sm.primary_location_id,
    p_starts_at, v_ends_at, p_notes,
    'confirmed', 'instant', 'not_required'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_create_booking(UUID, TIMESTAMPTZ, TEXT) TO authenticated;
