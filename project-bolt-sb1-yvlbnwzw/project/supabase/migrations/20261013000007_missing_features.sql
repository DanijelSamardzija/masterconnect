-- ============================================================
-- Missing features
--
-- 1. staff_cancel_booking     — staff with can_cancel_bookings
-- 2. get_available_slots      — enforce staff_services assignment
-- 3. owner_reschedule_booking — owner moves a booking to new time
-- 4. client_reschedule_booking— client moves their own upcoming booking
-- ============================================================

-- ── 1. staff_cancel_booking ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_cancel_booking(
  p_booking_id UUID,
  p_reason     TEXT DEFAULT NULL
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

  SELECT sm.id, sm.business_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_cancel_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  UPDATE bookings
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id          = p_booking_id
    AND business_id = v_biz_id
    AND status      = 'confirmed';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_cancel_booking(UUID, TEXT) TO authenticated;


-- ── 2. get_available_slots — enforce staff_services ──────────────────────────
-- If a service has ANY staff_services rows AND the requested staff member is
-- not among them → return nothing (that staff cannot perform this service).

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id     UUID,
  p_location_id     UUID,
  p_service_id      UUID,
  p_week_start      DATE,
  p_staff_member_id UUID DEFAULT NULL,
  p_resource_id     UUID DEFAULT NULL
)
RETURNS TABLE (
  slot_start         TIMESTAMPTZ,
  slot_end           TIMESTAMPTZ,
  available          BOOLEAN,
  capacity_remaining INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone         TEXT;
  v_slot_interval    INTEGER;
  v_min_notice_min   INTEGER;
  v_max_advance_days INTEGER;
  v_svc_duration     INTEGER;
  v_svc_buffer       INTEGER;
  v_svc_capacity     INTEGER;
  v_earliest         TIMESTAMPTZ;
  v_deadline         TIMESTAMPTZ;
  v_week_end         DATE;
  v_day              DATE;
  v_dow              INTEGER;
  v_oh_start         TIME;
  v_oh_end           TIME;
  v_oh_is_closed     BOOLEAN;
  v_oh_crosses_mid   BOOLEAN;
  v_found_oh         BOOLEAN;
  v_open_start_utc   TIMESTAMPTZ;
  v_open_end_utc     TIMESTAMPTZ;
  v_slot_ts          TIMESTAMPTZ;
  v_slot_end_ts      TIMESTAMPTZ;
  v_interval         INTERVAL;
  v_duration_iv      INTERVAL;
  v_capacity_used    INTEGER;
  -- shift override
  v_shift_start       TIME;
  v_shift_end         TIME;
  v_shift_is_off      BOOLEAN;
  v_has_shift         BOOLEAN;
  -- break
  v_shift_break_start TIME;
  v_shift_break_end   TIME;
  v_break_start_utc   TIMESTAMPTZ;
  v_break_end_utc     TIMESTAMPTZ;
BEGIN
  -- 1. Location + timezone
  SELECT bl.timezone
  INTO   v_timezone
  FROM   business_locations bl
  WHERE  bl.id          = p_location_id
    AND  bl.business_id = p_business_id
    AND  bl.is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- 2. Booking rules
  SELECT br.slot_interval_min, br.min_notice_minutes, br.max_advance_days
  INTO   v_slot_interval, v_min_notice_min, v_max_advance_days
  FROM   booking_rules br
  WHERE  br.business_id = p_business_id;

  IF NOT FOUND THEN
    v_slot_interval    := 15;
    v_min_notice_min   := 60;
    v_max_advance_days := 60;
  END IF;

  -- 3. Service details
  SELECT sc.duration_minutes, sc.buffer_minutes, sc.capacity
  INTO   v_svc_duration, v_svc_buffer, v_svc_capacity
  FROM   service_catalog sc
  WHERE  sc.id          = p_service_id
    AND  sc.business_id = p_business_id
    AND  sc.is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- 3b. Enforce staff_services assignment
  IF p_staff_member_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM staff_services WHERE service_id = p_service_id LIMIT 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_services
        WHERE service_id      = p_service_id
          AND staff_member_id = p_staff_member_id
      ) THEN
        RETURN; -- staff not assigned to this service
      END IF;
    END IF;
  END IF;

  -- 4. Availability window
  v_earliest    := now() + make_interval(mins => v_min_notice_min);
  v_deadline    := now() + make_interval(days => v_max_advance_days);
  v_week_end    := p_week_start + 6;
  v_interval    := make_interval(mins => v_slot_interval);
  v_duration_iv := make_interval(mins => v_svc_duration);

  -- 5. Day loop
  FOR v_day IN
    SELECT d::DATE
    FROM   generate_series(
             p_week_start::TIMESTAMP,
             v_week_end::TIMESTAMP,
             '1 day'::INTERVAL
           ) AS d
  LOOP
    IF (v_day::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone > v_deadline THEN
      EXIT;
    END IF;

    v_dow               := EXTRACT(dow FROM v_day)::INTEGER;
    v_found_oh          := false;
    v_has_shift         := false;
    v_shift_break_start := NULL;
    v_shift_break_end   := NULL;
    v_break_start_utc   := NULL;
    v_break_end_utc     := NULL;

    -- 5a-0. staff_shifts override
    IF p_staff_member_id IS NOT NULL THEN
      SELECT ss.start_time, ss.end_time, ss.is_off, ss.break_start, ss.break_end
      INTO   v_shift_start, v_shift_end, v_shift_is_off, v_shift_break_start, v_shift_break_end
      FROM   staff_shifts ss
      WHERE  ss.staff_member_id = p_staff_member_id
        AND  ss.shift_date      = v_day
      LIMIT  1;

      IF FOUND THEN
        v_has_shift := true;
        IF COALESCE(v_shift_is_off, false) THEN CONTINUE; END IF;
        v_oh_start       := v_shift_start;
        v_oh_end         := v_shift_end;
        v_oh_is_closed   := false;
        v_oh_crosses_mid := false;
        v_found_oh       := true;
        IF v_shift_break_start IS NOT NULL AND v_shift_break_end IS NOT NULL THEN
          v_break_start_utc := (v_day::TEXT || ' ' || v_shift_break_start::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
          v_break_end_utc   := (v_day::TEXT || ' ' || v_shift_break_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
        END IF;
      END IF;
    END IF;

    -- 5a. Opening hours (skipped when shift override found)
    IF NOT v_has_shift THEN
      IF p_staff_member_id IS NOT NULL THEN
        SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
        INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
        FROM   opening_hours oh
        WHERE  oh.location_id     = p_location_id
          AND  oh.entity_type     = 'staff'
          AND  oh.staff_member_id = p_staff_member_id
          AND  oh.day_of_week     = v_dow
          AND  oh.sort_order      = 0
          AND  oh.month IN (0, EXTRACT(MONTH FROM v_day)::SMALLINT)
        ORDER BY oh.month DESC
        LIMIT 1;
        IF FOUND THEN v_found_oh := true; END IF;
      END IF;

      IF NOT v_found_oh THEN
        SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
        INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
        FROM   opening_hours oh
        WHERE  oh.location_id = p_location_id
          AND  oh.entity_type = 'business'
          AND  oh.day_of_week = v_dow
        LIMIT 1;
        IF FOUND THEN v_found_oh := true; END IF;
      END IF;
    END IF;

    IF NOT v_found_oh OR v_oh_is_closed THEN CONTINUE; END IF;

    -- 5b. Local → UTC
    v_open_start_utc := (v_day::TEXT || ' ' || v_oh_start::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    IF v_oh_crosses_mid THEN
      v_open_end_utc := ((v_day + 1)::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    ELSE
      v_open_end_utc := (v_day::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    END IF;

    -- 6. Slot loop
    v_slot_ts := v_open_start_utc;

    WHILE v_slot_ts + v_duration_iv <= v_open_end_utc LOOP
      v_slot_end_ts := v_slot_ts + v_duration_iv;

      IF v_slot_ts < v_earliest THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;
      IF v_slot_ts > v_deadline THEN EXIT; END IF;

      -- Break period
      IF v_break_start_utc IS NOT NULL
         AND v_slot_ts    < v_break_end_utc
         AND v_slot_end_ts > v_break_start_utc
      THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      -- Business time_block
      IF EXISTS (
        SELECT 1 FROM time_blocks tb
        WHERE tb.entity_type = 'business' AND tb.location_id = p_location_id
          AND tb.starts_at < v_slot_end_ts AND tb.ends_at > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      -- Staff time_block
      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM time_blocks tb
        WHERE tb.entity_type = 'staff' AND tb.staff_member_id = p_staff_member_id
          AND tb.starts_at < v_slot_end_ts AND tb.ends_at > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      -- Booking conflicts
      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings b
        JOIN service_catalog sc2 ON sc2.id = b.service_id
        WHERE b.staff_member_id = p_staff_member_id
          AND b.status IN ('pending', 'confirmed')
          AND v_slot_ts    < b.ends_at + make_interval(mins => COALESCE(sc2.buffer_minutes, 0))
          AND v_slot_end_ts > b.starts_at
      ) THEN
        slot_start := v_slot_ts; slot_end := v_slot_end_ts;
        available := false; capacity_remaining := 0;
        RETURN NEXT;
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      -- Capacity check
      SELECT COUNT(*) INTO v_capacity_used
      FROM bookings b
      WHERE b.service_id = p_service_id AND b.status IN ('pending', 'confirmed')
        AND v_slot_ts < b.ends_at AND v_slot_end_ts > b.starts_at;

      slot_start         := v_slot_ts;
      slot_end           := v_slot_end_ts;
      available          := v_capacity_used < COALESCE(v_svc_capacity, 1);
      capacity_remaining := GREATEST(0, COALESCE(v_svc_capacity, 1) - v_capacity_used);
      RETURN NEXT;

      v_slot_ts := v_slot_ts + v_interval;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO authenticated, anon;


-- ── 3. owner_reschedule_booking ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_biz_id       UUID;
  v_old_start    TIMESTAMPTZ;
  v_old_end      TIMESTAMPTZ;
  v_new_end      TIMESTAMPTZ;
  v_staff_id     UUID;
  v_duration_iv  INTERVAL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  SELECT starts_at, ends_at, staff_member_id
  INTO   v_old_start, v_old_end, v_staff_id
  FROM   bookings
  WHERE  id = p_booking_id AND business_id = v_biz_id
    AND  status IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  IF p_new_starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_in_past');
  END IF;

  -- Check staff conflicts (excluding this booking)
  IF v_staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings b
      WHERE  b.staff_member_id = v_staff_id
        AND  b.status IN ('pending', 'confirmed')
        AND  b.id <> p_booking_id
        AND  p_new_starts_at < b.ends_at
        AND  v_new_end        > b.starts_at
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict');
    END IF;
  END IF;

  UPDATE bookings
  SET    starts_at  = p_new_starts_at,
         ends_at    = v_new_end,
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;


-- ── 4. client_reschedule_booking ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.client_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            UUID;
  v_old_start      TIMESTAMPTZ;
  v_old_end        TIMESTAMPTZ;
  v_new_end        TIMESTAMPTZ;
  v_staff_id       UUID;
  v_biz_id         UUID;
  v_min_notice_min INTEGER;
  v_duration_iv    INTERVAL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT starts_at, ends_at, staff_member_id, business_id
  INTO   v_old_start, v_old_end, v_staff_id, v_biz_id
  FROM   bookings
  WHERE  id        = p_booking_id
    AND  client_id = v_uid
    AND  status    IN ('pending', 'confirmed')
    AND  starts_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- Min notice check
  SELECT COALESCE(br.min_notice_minutes, 60) INTO v_min_notice_min
  FROM booking_rules br WHERE br.business_id = v_biz_id;

  IF p_new_starts_at < now() + make_interval(mins => COALESCE(v_min_notice_min, 60)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_soon');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  -- Check staff conflicts (excluding this booking)
  IF v_staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings b
      WHERE  b.staff_member_id = v_staff_id
        AND  b.status IN ('pending', 'confirmed')
        AND  b.id <> p_booking_id
        AND  p_new_starts_at < b.ends_at
        AND  v_new_end        > b.starts_at
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict');
    END IF;
  END IF;

  UPDATE bookings
  SET    starts_at  = p_new_starts_at,
         ends_at    = v_new_end,
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;
