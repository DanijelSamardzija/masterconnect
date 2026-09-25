-- ==========================================================================
-- Staff hours boundary validation
--
-- Rule: staff schedule (weekly template + per-date shifts) must NEVER
--       exceed business/location opening hours.
--
-- Changes:
--   1. owner_set_staff_hours  — reject if hours outside business hours
--   2. set_my_staff_hours     — reject if hours outside business hours
--   3. owner_set_shift        — reject if shift outside business hours
--   4. staff_set_my_shift     — reject if shift outside business hours
--   5. get_available_slots    — clamp staff hours to business hours ceiling
--
-- Behaviour:
--   • No business hours configured for that location/day → allow anything
--   • If business hours exist: staff range must satisfy
--       p_open_time  >= MIN(biz.start_time)
--       p_close_time <= MAX(biz.end_time)
--     across all non-closed periods for that location+day.
--   • Error returned: 'outside_business_hours'
--   • Existing staff schedule NOT deleted when business hours change.
--     get_available_slots enforces the ceiling dynamically at query time.
--
-- DO NOT TOUCH: timezone, starts_at, email, notification flow.
-- ==========================================================================


-- ── 1. owner_set_staff_hours ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_set_staff_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_open_time       TIME,
  p_close_time      TIME,
  p_is_closed       BOOLEAN  DEFAULT false,
  p_sort_order      INTEGER  DEFAULT 0,
  p_month           SMALLINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID;
  v_biz_id          UUID;
  v_biz_start       TIME;
  v_biz_end         TIME;
  v_effective_open  TIME;
  v_effective_close TIME;
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

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  -- Business hours boundary check (only when not marking the day as closed)
  IF NOT COALESCE(p_is_closed, false) THEN
    v_effective_open  := COALESCE(p_open_time,  '09:00'::TIME);
    v_effective_close := COALESCE(p_close_time, '17:00'::TIME);

    SELECT MIN(oh.start_time), MAX(oh.end_time)
    INTO   v_biz_start, v_biz_end
    FROM   opening_hours oh
    WHERE  oh.location_id = p_location_id
      AND  oh.entity_type = 'business'
      AND  oh.day_of_week = p_day_of_week
      AND  oh.is_closed   = false;

    -- v_biz_start IS NULL means no business hours configured → allow
    IF v_biz_start IS NOT NULL THEN
      IF v_effective_open < v_biz_start OR v_effective_close > v_biz_end THEN
        RETURN jsonb_build_object('ok', false, 'error', 'outside_business_hours');
      END IF;
    END IF;
  END IF;

  -- Upsert the template row
  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order, month
  ) VALUES (
    'staff', p_staff_member_id, p_location_id, p_day_of_week,
    COALESCE(p_open_time,  '09:00'::TIME),
    COALESCE(p_close_time, '17:00'::TIME),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0),
    COALESCE(p_month, 0)
  )
  ON CONFLICT (staff_member_id, location_id, day_of_week, sort_order, month)
  WHERE entity_type = 'staff'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'::TIME),
    end_time   = COALESCE(p_close_time, '17:00'::TIME),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  -- When marking a day as working in the template, clear stale is_off=true overrides
  IF NOT COALESCE(p_is_closed, false) AND COALESCE(p_sort_order, 0) = 0 THEN
    DELETE FROM staff_shifts
    WHERE staff_member_id = p_staff_member_id
      AND is_off = true
      AND EXTRACT(dow FROM shift_date)::INTEGER = p_day_of_week
      AND shift_date >= CURRENT_DATE;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_staff_hours(UUID, UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER, SMALLINT) TO authenticated;


-- ── 2. set_my_staff_hours ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_my_staff_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_open_time   TIME,
  p_close_time  TIME,
  p_is_closed   BOOLEAN DEFAULT false,
  p_sort_order  INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             UUID;
  v_sm_id           UUID;
  v_biz_id          UUID;
  v_perms           JSONB;
  v_biz_start       TIME;
  v_biz_end         TIME;
  v_effective_open  TIME;
  v_effective_close TIME;
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

  -- Business hours boundary check
  IF NOT COALESCE(p_is_closed, false) THEN
    v_effective_open  := COALESCE(p_open_time,  '09:00'::TIME);
    v_effective_close := COALESCE(p_close_time, '17:00'::TIME);

    SELECT MIN(oh.start_time), MAX(oh.end_time)
    INTO   v_biz_start, v_biz_end
    FROM   opening_hours oh
    WHERE  oh.location_id = p_location_id
      AND  oh.entity_type = 'business'
      AND  oh.day_of_week = p_day_of_week
      AND  oh.is_closed   = false;

    IF v_biz_start IS NOT NULL THEN
      IF v_effective_open < v_biz_start OR v_effective_close > v_biz_end THEN
        RETURN jsonb_build_object('ok', false, 'error', 'outside_business_hours');
      END IF;
    END IF;
  END IF;

  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order
  ) VALUES (
    'staff', v_sm_id, p_location_id, p_day_of_week,
    COALESCE(p_open_time,  '09:00'::TIME),
    COALESCE(p_close_time, '17:00'::TIME),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0)
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

GRANT EXECUTE ON FUNCTION public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER) TO authenticated;


-- ── 3. owner_set_shift ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_set_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE,
  p_start_time      TIME    DEFAULT NULL,
  p_end_time        TIME    DEFAULT NULL,
  p_is_off          BOOLEAN DEFAULT false,
  p_notes           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_biz_id    UUID;
  v_loc_id    UUID;
  v_dow       INTEGER;
  v_biz_start TIME;
  v_biz_end   TIME;
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

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  SELECT primary_location_id INTO v_loc_id
  FROM staff_members WHERE id = p_staff_member_id;

  -- Business hours boundary check (only when setting real times, not marking as off)
  IF NOT COALESCE(p_is_off, false) AND p_start_time IS NOT NULL AND p_end_time IS NOT NULL
     AND v_loc_id IS NOT NULL THEN
    v_dow := EXTRACT(dow FROM p_shift_date)::INTEGER;

    SELECT MIN(oh.start_time), MAX(oh.end_time)
    INTO   v_biz_start, v_biz_end
    FROM   opening_hours oh
    WHERE  oh.location_id = v_loc_id
      AND  oh.entity_type = 'business'
      AND  oh.day_of_week = v_dow
      AND  oh.is_closed   = false;

    IF v_biz_start IS NOT NULL THEN
      IF p_start_time < v_biz_start OR p_end_time > v_biz_end THEN
        RETURN jsonb_build_object('ok', false, 'error', 'outside_business_hours');
      END IF;
    END IF;
  END IF;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, created_by
  ) VALUES (
    v_biz_id, p_staff_member_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time = p_start_time,
    end_time   = p_end_time,
    is_off     = COALESCE(p_is_off, false),
    notes      = p_notes,
    created_by = v_uid,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_shift(UUID, DATE, TIME, TIME, BOOLEAN, TEXT) TO authenticated;


-- ── 4. staff_set_my_shift ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_set_my_shift(
  p_shift_date DATE,
  p_start_time TIME    DEFAULT NULL,
  p_end_time   TIME    DEFAULT NULL,
  p_is_off     BOOLEAN DEFAULT false,
  p_notes      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_sm_id     UUID;
  v_biz_id    UUID;
  v_loc_id    UUID;
  v_perms     JSONB;
  v_dow       INTEGER;
  v_biz_start TIME;
  v_biz_end   TIME;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.primary_location_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_loc_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_set_hours')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  -- Business hours boundary check
  IF NOT COALESCE(p_is_off, false) AND p_start_time IS NOT NULL AND p_end_time IS NOT NULL
     AND v_loc_id IS NOT NULL THEN
    v_dow := EXTRACT(dow FROM p_shift_date)::INTEGER;

    SELECT MIN(oh.start_time), MAX(oh.end_time)
    INTO   v_biz_start, v_biz_end
    FROM   opening_hours oh
    WHERE  oh.location_id = v_loc_id
      AND  oh.entity_type = 'business'
      AND  oh.day_of_week = v_dow
      AND  oh.is_closed   = false;

    IF v_biz_start IS NOT NULL THEN
      IF p_start_time < v_biz_start OR p_end_time > v_biz_end THEN
        RETURN jsonb_build_object('ok', false, 'error', 'outside_business_hours');
      END IF;
    END IF;
  END IF;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, created_by
  ) VALUES (
    v_biz_id, v_sm_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time = p_start_time,
    end_time   = p_end_time,
    is_off     = COALESCE(p_is_off, false),
    notes      = p_notes,
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_my_shift(DATE, TIME, TIME, BOOLEAN, TEXT) TO authenticated;


-- ── 5. get_available_slots — business hours ceiling for staff schedule ─────────
-- Drop the 6-param version that was accidentally re-created by this migration
-- (it was already dropped by 20261021000008_get_available_slots_exclude_booking.sql).
DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID);

-- Update the active 7-param version (with p_exclude_booking_id + break support)
-- to add business hours clamping when staff-specific hours are used.
-- Added variables: v_used_staff_hours, v_biz_open, v_biz_close.
-- The clamping block fires after the "skip if closed" check and before UTC conversion.
-- DO NOT touch: timezone, starts_at, UTC conversions, email, notifications.

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id        UUID,
  p_location_id        UUID,
  p_service_id         UUID,
  p_week_start         DATE,
  p_staff_member_id    UUID DEFAULT NULL,
  p_resource_id        UUID DEFAULT NULL,
  p_exclude_booking_id UUID DEFAULT NULL
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
  v_timezone          TEXT;
  v_slot_interval     INTEGER;
  v_min_notice_min    INTEGER;
  v_max_advance_days  INTEGER;
  v_svc_duration      INTEGER;
  v_svc_buffer        INTEGER;
  v_svc_capacity      INTEGER;
  v_earliest          TIMESTAMPTZ;
  v_deadline          TIMESTAMPTZ;
  v_week_end          DATE;
  v_day               DATE;
  v_dow               INTEGER;
  v_oh_start          TIME;
  v_oh_end            TIME;
  v_oh_is_closed      BOOLEAN;
  v_oh_crosses_mid    BOOLEAN;
  v_found_oh          BOOLEAN;
  v_open_start_utc    TIMESTAMPTZ;
  v_open_end_utc      TIMESTAMPTZ;
  v_slot_ts           TIMESTAMPTZ;
  v_slot_end_ts       TIMESTAMPTZ;
  v_interval          INTERVAL;
  v_duration_iv       INTERVAL;
  v_capacity_used     INTEGER;
  v_shift_start       TIME;
  v_shift_end         TIME;
  v_shift_is_off      BOOLEAN;
  v_has_shift         BOOLEAN;
  v_shift_break_start TIME;
  v_shift_break_end   TIME;
  v_break_start_utc   TIMESTAMPTZ;
  v_break_end_utc     TIMESTAMPTZ;
  -- business hours ceiling clamping
  v_used_staff_hours  BOOLEAN;
  v_biz_open          TIME;
  v_biz_close         TIME;
BEGIN
  SELECT bl.timezone
  INTO   v_timezone
  FROM   business_locations bl
  WHERE  bl.id          = p_location_id
    AND  bl.business_id = p_business_id
    AND  bl.is_active   = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT br.slot_interval_min, br.min_notice_minutes, br.max_advance_days
  INTO   v_slot_interval, v_min_notice_min, v_max_advance_days
  FROM   booking_rules br
  WHERE  br.business_id = p_business_id;
  IF NOT FOUND THEN
    v_slot_interval    := 15;
    v_min_notice_min   := 60;
    v_max_advance_days := 60;
  END IF;

  SELECT sc.duration_minutes, sc.buffer_minutes, sc.capacity
  INTO   v_svc_duration, v_svc_buffer, v_svc_capacity
  FROM   service_catalog sc
  WHERE  sc.id          = p_service_id
    AND  sc.business_id = p_business_id
    AND  sc.is_active   = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_staff_member_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM staff_services WHERE service_id = p_service_id LIMIT 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM staff_services
        WHERE service_id = p_service_id AND staff_member_id = p_staff_member_id
      ) THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  v_earliest    := now() + make_interval(mins => v_min_notice_min);
  v_deadline    := now() + make_interval(days => v_max_advance_days);
  v_week_end    := p_week_start + 6;
  v_interval    := make_interval(mins => v_slot_interval);
  v_duration_iv := make_interval(mins => v_svc_duration);

  FOR v_day IN
    SELECT d::DATE
    FROM   generate_series(p_week_start::TIMESTAMP, v_week_end::TIMESTAMP, '1 day'::INTERVAL) AS d
  LOOP
    IF (v_day::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone > v_deadline THEN
      EXIT;
    END IF;

    v_dow               := EXTRACT(dow FROM v_day)::INTEGER;
    v_found_oh          := false;
    v_has_shift         := false;
    v_used_staff_hours  := false;
    v_shift_break_start := NULL;
    v_shift_break_end   := NULL;
    v_break_start_utc   := NULL;
    v_break_end_utc     := NULL;

    IF p_staff_member_id IS NOT NULL THEN
      SELECT ss.start_time, ss.end_time, ss.is_off, ss.break_start, ss.break_end
      INTO   v_shift_start, v_shift_end, v_shift_is_off, v_shift_break_start, v_shift_break_end
      FROM   staff_shifts ss
      WHERE  ss.staff_member_id = p_staff_member_id AND ss.shift_date = v_day
      LIMIT  1;

      IF FOUND THEN
        v_has_shift := true;
        IF COALESCE(v_shift_is_off, false) THEN CONTINUE; END IF;
        v_oh_start          := v_shift_start;
        v_oh_end            := v_shift_end;
        v_oh_is_closed      := false;
        v_oh_crosses_mid    := false;
        v_found_oh          := true;
        v_used_staff_hours  := true;
        IF v_shift_break_start IS NOT NULL AND v_shift_break_end IS NOT NULL THEN
          v_break_start_utc := (v_day::TEXT || ' ' || v_shift_break_start::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
          v_break_end_utc   := (v_day::TEXT || ' ' || v_shift_break_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
        END IF;
      END IF;
    END IF;

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
        IF FOUND THEN
          v_found_oh         := true;
          v_used_staff_hours := true;
        END IF;
      END IF;

      IF NOT v_found_oh THEN
        SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
        INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
        FROM   opening_hours oh
        WHERE  oh.location_id = p_location_id AND oh.entity_type = 'business' AND oh.day_of_week = v_dow
        LIMIT 1;
        IF FOUND THEN v_found_oh := true; END IF;
      END IF;
    END IF;

    IF NOT v_found_oh OR v_oh_is_closed THEN CONTINUE; END IF;

    -- Business hours ceiling: clamp when staff-specific schedule was used
    IF v_used_staff_hours THEN
      SELECT MIN(oh.start_time), MAX(oh.end_time)
      INTO   v_biz_open, v_biz_close
      FROM   opening_hours oh
      WHERE  oh.location_id = p_location_id
        AND  oh.entity_type = 'business'
        AND  oh.day_of_week = v_dow
        AND  oh.is_closed   = false;

      -- No business hours configured → no restriction, use staff hours as-is
      IF v_biz_open IS NOT NULL THEN
        v_oh_start := GREATEST(v_oh_start, v_biz_open);
        v_oh_end   := LEAST(v_oh_end, v_biz_close);
        IF v_oh_start >= v_oh_end THEN
          CONTINUE; -- staff window completely outside business hours
        END IF;
      END IF;
    END IF;

    v_open_start_utc := (v_day::TEXT || ' ' || v_oh_start::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    IF v_oh_crosses_mid THEN
      v_open_end_utc := ((v_day + 1)::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    ELSE
      v_open_end_utc := (v_day::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP AT TIME ZONE v_timezone;
    END IF;

    v_slot_ts := v_open_start_utc;

    WHILE v_slot_ts + v_duration_iv <= v_open_end_utc LOOP
      v_slot_end_ts := v_slot_ts + v_duration_iv;

      IF v_slot_ts < v_earliest THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;
      IF v_slot_ts > v_deadline THEN EXIT; END IF;

      IF v_break_start_utc IS NOT NULL
         AND v_slot_ts < v_break_end_utc AND v_slot_end_ts > v_break_start_utc
      THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM time_blocks tb
        WHERE tb.entity_type = 'business' AND tb.location_id = p_location_id
          AND tb.starts_at < v_slot_end_ts AND tb.ends_at > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM time_blocks tb
        WHERE tb.entity_type = 'staff' AND tb.staff_member_id = p_staff_member_id
          AND tb.starts_at < v_slot_end_ts AND tb.ends_at > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings b
        JOIN service_catalog sc2 ON sc2.id = b.service_id
        WHERE b.staff_member_id = p_staff_member_id
          AND b.status IN ('pending', 'confirmed')
          AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
          AND v_slot_ts    < b.ends_at + make_interval(mins => COALESCE(sc2.buffer_minutes, 0))
          AND v_slot_end_ts > b.starts_at
      ) THEN
        slot_start := v_slot_ts; slot_end := v_slot_end_ts;
        available := false; capacity_remaining := 0;
        RETURN NEXT;
        v_slot_ts := v_slot_ts + v_interval; CONTINUE;
      END IF;

      SELECT COUNT(*) INTO v_capacity_used
      FROM bookings b
      WHERE b.service_id = p_service_id
        AND b.status IN ('pending', 'confirmed')
        AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
        AND v_slot_ts < b.ends_at AND v_slot_end_ts > b.starts_at;

      slot_start         := v_slot_ts;
      slot_end           := v_slot_end_ts;
      available          := v_capacity_used < COALESCE(v_svc_capacity, 1);
      capacity_remaining := GREATEST(0, COALESCE(v_svc_capacity, 1) - v_capacity_used);
      RETURN NEXT;

      v_slot_ts := v_slot_ts + v_interval;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID, UUID) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
