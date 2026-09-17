-- Fix get_available_slots: respect staff_shifts start_time/end_time overrides.
--
-- Previously (20261018000004) the function only checked staff_shifts.is_off
-- to skip a day, but ignored start_time/end_time when the owner or staff
-- set custom working hours for a specific date.
-- This caused clients to see the default opening_hours slots (e.g. 09:00–17:00)
-- even when the shift was explicitly overridden to e.g. 11:00–16:00.
--
-- Fix: query staff_shifts before the opening_hours lookup. If an explicit shift
-- row exists for that date:
--   • is_off = true  → skip the day entirely (existing behaviour)
--   • start_time + end_time set → use those hours instead of opening_hours
--   • is_off = false but no times → fall back to opening_hours as before

DROP FUNCTION IF EXISTS public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID);

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
  -- shift override variables
  v_shift_start      TIME;
  v_shift_end        TIME;
  v_shift_is_off     BOOLEAN;
  v_has_shift        BOOLEAN;
BEGIN
  -- 1. Location + timezone
  SELECT bl.timezone
  INTO   v_timezone
  FROM   business_locations bl
  WHERE  bl.id          = p_location_id
    AND  bl.business_id = p_business_id
    AND  bl.is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

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

  IF NOT FOUND THEN
    RETURN;
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

    v_dow       := EXTRACT(dow FROM v_day)::INTEGER;
    v_found_oh  := false;
    v_has_shift := false;

    -- 5a-0. Check staff_shifts for an explicit override on this exact date.
    --       This takes precedence over opening_hours for both off and working shifts.
    IF p_staff_member_id IS NOT NULL THEN
      SELECT ss.is_off, ss.start_time, ss.end_time
      INTO   v_shift_is_off, v_shift_start, v_shift_end
      FROM   staff_shifts ss
      WHERE  ss.staff_member_id = p_staff_member_id
        AND  ss.shift_date      = v_day
      LIMIT 1;

      IF FOUND THEN
        v_has_shift := true;

        -- Day off: skip all slots for this day
        IF COALESCE(v_shift_is_off, false) THEN
          CONTINUE;
        END IF;

        -- Working with explicit hours: use shift times instead of opening_hours
        IF v_shift_start IS NOT NULL AND v_shift_end IS NOT NULL THEN
          v_oh_start       := v_shift_start;
          v_oh_end         := v_shift_end;
          v_oh_is_closed   := false;
          v_oh_crosses_mid := false;
          v_found_oh       := true;
        END IF;
        -- If shift exists but has no times (e.g. is_off=false with no override),
        -- fall through to opening_hours lookup below
      END IF;
    END IF;

    -- 5a. Opening hours lookup (skipped when a shift override already set v_found_oh)
    IF NOT v_found_oh THEN
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

    IF NOT v_found_oh OR v_oh_is_closed THEN
      CONTINUE;
    END IF;

    -- 5b. Local time → UTC
    v_open_start_utc := (v_day::TEXT || ' ' || v_oh_start::TEXT)::TIMESTAMP
                        AT TIME ZONE v_timezone;

    IF v_oh_crosses_mid THEN
      v_open_end_utc := ((v_day + 1)::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                        AT TIME ZONE v_timezone;
    ELSE
      v_open_end_utc := (v_day::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                        AT TIME ZONE v_timezone;
    END IF;

    -- 6. Slot loop
    v_slot_ts := v_open_start_utc;

    WHILE v_slot_ts + v_duration_iv <= v_open_end_utc LOOP
      v_slot_end_ts := v_slot_ts + v_duration_iv;

      IF v_slot_ts < v_earliest THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      IF v_slot_ts > v_deadline THEN
        EXIT;
      END IF;

      -- 6c. Business-level time_block
      IF EXISTS (
        SELECT 1
        FROM   time_blocks tb
        WHERE  tb.entity_type = 'business'
          AND  tb.location_id = p_location_id
          AND  tb.starts_at   < v_slot_end_ts
          AND  tb.ends_at     > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6d. Staff-level time_block
      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM   time_blocks tb
        WHERE  tb.entity_type     = 'staff'
          AND  tb.staff_member_id = p_staff_member_id
          AND  tb.starts_at       < v_slot_end_ts
          AND  tb.ends_at         > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6e. Resource-level time_block
      IF p_resource_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM   time_blocks tb
        WHERE  tb.entity_type = 'resource'
          AND  tb.resource_id = p_resource_id
          AND  tb.starts_at   < v_slot_end_ts
          AND  tb.ends_at     > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6f. Staff double-booking
      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM   bookings b
        JOIN   service_catalog sc ON sc.id = b.service_id
        WHERE  b.staff_member_id = p_staff_member_id
          AND  b.status IN ('pending', 'confirmed')
          AND  v_slot_ts    < b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0))
          AND  v_slot_end_ts > b.starts_at
      ) THEN
        slot_start         := v_slot_ts;
        slot_end           := v_slot_end_ts;
        available          := false;
        capacity_remaining := 0;
        RETURN NEXT;
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6g. Service capacity check
      SELECT COUNT(*) INTO v_capacity_used
      FROM   bookings b
      WHERE  b.service_id = p_service_id
        AND  b.status IN ('pending', 'confirmed')
        AND  v_slot_ts    < b.ends_at
        AND  v_slot_end_ts > b.starts_at;

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
