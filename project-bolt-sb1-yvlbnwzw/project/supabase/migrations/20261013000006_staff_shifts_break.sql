-- ============================================================
-- Staff Shifts — add break_start / break_end support
--
-- 1.  ALTER TABLE  staff_shifts — add break columns
-- 2.  owner_get_week_shifts   — include break in output
-- 3.  owner_set_shift         — accept break params
-- 4.  owner_copy_week_shifts  — copy break fields
-- 5.  staff_get_my_shifts     — include break in output
-- 6.  staff_set_my_shift      — accept break params
-- 7.  get_available_slots     — skip break slots
-- 8.  public_get_week_breaks  — read-only for booking page
-- ============================================================

-- ── 1. Add break columns ──────────────────────────────────────────────────────

ALTER TABLE public.staff_shifts
  ADD COLUMN IF NOT EXISTS break_start TIME,
  ADD COLUMN IF NOT EXISTS break_end   TIME;


-- ── 2. owner_get_week_shifts ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_get_week_shifts(
  p_week_start DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'staff_member_id', sm.id,
          'staff_name',      p.name,
          'shifts',          COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'shift_date',  ss.shift_date::TEXT,
                  'start_time',  ss.start_time::TEXT,
                  'end_time',    ss.end_time::TEXT,
                  'is_off',      ss.is_off,
                  'notes',       ss.notes,
                  'break_start', ss.break_start::TEXT,
                  'break_end',   ss.break_end::TEXT
                )
                ORDER BY ss.shift_date
              )
              FROM staff_shifts ss
              WHERE ss.staff_member_id = sm.id
                AND ss.shift_date >= p_week_start
                AND ss.shift_date <  p_week_start + 7
            ),
            '[]'::jsonb
          )
        )
        ORDER BY p.name
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id = v_biz_id
        AND sm.is_active   = true
        AND sm.role IN ('worker', 'manager')
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_week_shifts(DATE) TO authenticated;


-- ── 3. owner_set_shift ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_set_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE,
  p_start_time      TIME    DEFAULT NULL,
  p_end_time        TIME    DEFAULT NULL,
  p_is_off          BOOLEAN DEFAULT false,
  p_notes           TEXT    DEFAULT NULL,
  p_break_start     TIME    DEFAULT NULL,
  p_break_end       TIME    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_loc_id UUID;
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

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end, created_by
  ) VALUES (
    v_biz_id, p_staff_member_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes,
    p_break_start, p_break_end, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time  = p_start_time,
    end_time    = p_end_time,
    is_off      = COALESCE(p_is_off, false),
    notes       = p_notes,
    break_start = p_break_start,
    break_end   = p_break_end,
    created_by  = v_uid,
    updated_at  = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_shift(UUID, DATE, TIME, TIME, BOOLEAN, TEXT, TIME, TIME) TO authenticated;


-- ── 4. owner_copy_week_shifts ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_copy_week_shifts(
  p_from_week_start DATE,
  p_to_week_start   DATE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_count  INTEGER;
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

  DELETE FROM staff_shifts
  WHERE business_id = v_biz_id
    AND shift_date >= p_to_week_start
    AND shift_date <  p_to_week_start + 7;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end, created_by
  )
  SELECT
    business_id,
    staff_member_id,
    location_id,
    p_to_week_start + (shift_date - p_from_week_start),
    start_time,
    end_time,
    is_off,
    notes,
    break_start,
    break_end,
    v_uid
  FROM staff_shifts
  WHERE business_id = v_biz_id
    AND shift_date >= p_from_week_start
    AND shift_date <  p_from_week_start + 7;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'copied', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_copy_week_shifts(DATE, DATE) TO authenticated;


-- ── 5. staff_get_my_shifts ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_get_my_shifts(
  p_from_date DATE,
  p_to_date   DATE
)
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

  SELECT id INTO v_sm_id
  FROM staff_members
  WHERE user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'shift_date',  ss.shift_date::TEXT,
          'start_time',  ss.start_time::TEXT,
          'end_time',    ss.end_time::TEXT,
          'is_off',      ss.is_off,
          'notes',       ss.notes,
          'break_start', ss.break_start::TEXT,
          'break_end',   ss.break_end::TEXT
        )
        ORDER BY ss.shift_date
      )
      FROM staff_shifts ss
      WHERE ss.staff_member_id = v_sm_id
        AND ss.shift_date      >= p_from_date
        AND ss.shift_date      <= p_to_date
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_get_my_shifts(DATE, DATE) TO authenticated;


-- ── 6. staff_set_my_shift ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.staff_set_my_shift(
  p_shift_date  DATE,
  p_start_time  TIME    DEFAULT NULL,
  p_end_time    TIME    DEFAULT NULL,
  p_is_off      BOOLEAN DEFAULT false,
  p_notes       TEXT    DEFAULT NULL,
  p_break_start TIME    DEFAULT NULL,
  p_break_end   TIME    DEFAULT NULL
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
  v_loc_id UUID;
  v_perms  JSONB;
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

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end, created_by
  ) VALUES (
    v_biz_id, v_sm_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes,
    p_break_start, p_break_end, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time  = p_start_time,
    end_time    = p_end_time,
    is_off      = COALESCE(p_is_off, false),
    notes       = p_notes,
    break_start = p_break_start,
    break_end   = p_break_end,
    updated_at  = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_my_shift(DATE, TIME, TIME, BOOLEAN, TEXT, TIME, TIME) TO authenticated;


-- ── 7. get_available_slots — with break skip logic ───────────────────────────

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
  v_shift_start      TIME;
  v_shift_end        TIME;
  v_shift_is_off     BOOLEAN;
  v_has_shift        BOOLEAN;
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

    -- 5a-0. staff_shifts override for this specific date (highest priority)
    IF p_staff_member_id IS NOT NULL THEN
      SELECT ss.start_time, ss.end_time, ss.is_off, ss.break_start, ss.break_end
      INTO   v_shift_start, v_shift_end, v_shift_is_off, v_shift_break_start, v_shift_break_end
      FROM   staff_shifts ss
      WHERE  ss.staff_member_id = p_staff_member_id
        AND  ss.shift_date      = v_day
      LIMIT  1;

      IF FOUND THEN
        v_has_shift := true;
        IF COALESCE(v_shift_is_off, false) THEN
          CONTINUE;
        END IF;
        v_oh_start       := v_shift_start;
        v_oh_end         := v_shift_end;
        v_oh_is_closed   := false;
        v_oh_crosses_mid := false;
        v_found_oh       := true;
        -- Compute break UTC window
        IF v_shift_break_start IS NOT NULL AND v_shift_break_end IS NOT NULL THEN
          v_break_start_utc := (v_day::TEXT || ' ' || v_shift_break_start::TEXT)::TIMESTAMP
                               AT TIME ZONE v_timezone;
          v_break_end_utc   := (v_day::TEXT || ' ' || v_shift_break_end::TEXT)::TIMESTAMP
                               AT TIME ZONE v_timezone;
        END IF;
      END IF;
    END IF;

    -- 5a. Opening hours lookup (month-aware; skipped when shift override found)
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

      -- 6b. Break period check — skip slots that overlap the break window
      IF v_break_start_utc IS NOT NULL
         AND v_slot_ts    < v_break_end_utc
         AND v_slot_end_ts > v_break_start_utc
      THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6c. Business-level time_block
      IF EXISTS (
        SELECT 1 FROM time_blocks tb
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
        SELECT 1 FROM time_blocks tb
        WHERE  tb.entity_type     = 'staff'
          AND  tb.staff_member_id = p_staff_member_id
          AND  tb.starts_at       < v_slot_end_ts
          AND  tb.ends_at         > v_slot_ts
      ) THEN
        v_slot_ts := v_slot_ts + v_interval;
        CONTINUE;
      END IF;

      -- 6e. Booking conflicts
      IF p_staff_member_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM bookings b
        JOIN service_catalog sc2 ON sc2.id = b.service_id
        WHERE  b.staff_member_id = p_staff_member_id
          AND  b.status IN ('pending', 'confirmed')
          AND  v_slot_ts    < b.ends_at + make_interval(mins => COALESCE(sc2.buffer_minutes, 0))
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

      -- 6f. Capacity check
      SELECT COUNT(*) INTO v_capacity_used
      FROM bookings b
      WHERE b.service_id = p_service_id
        AND b.status IN ('pending', 'confirmed')
        AND v_slot_ts    < b.ends_at
        AND v_slot_end_ts > b.starts_at;

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


-- ── 8. public_get_week_breaks — for booking page ─────────────────────────────

CREATE OR REPLACE FUNCTION public.public_get_week_breaks(
  p_staff_member_id UUID,
  p_week_start      DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'shift_date',  ss.shift_date::TEXT,
          'break_start', ss.break_start::TEXT,
          'break_end',   ss.break_end::TEXT
        )
        ORDER BY ss.shift_date
      )
      FROM staff_shifts ss
      WHERE ss.staff_member_id = p_staff_member_id
        AND ss.shift_date      >= p_week_start
        AND ss.shift_date      <  p_week_start + 7
        AND ss.break_start     IS NOT NULL
        AND ss.break_end       IS NOT NULL
        AND NOT ss.is_off
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_week_breaks(UUID, DATE) TO authenticated, anon;
