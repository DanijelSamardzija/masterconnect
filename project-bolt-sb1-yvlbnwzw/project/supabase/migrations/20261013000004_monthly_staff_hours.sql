-- ============================================================
-- Monthly staff hours + owner control
--
-- 1. Add month column to opening_hours (0 = all months, 1-12 = specific)
-- 2. Recreate unique index to include month
-- 3. Update set_my_staff_hours to accept p_month
-- 4. Update get_staff_opening_hours to filter by p_month
-- 5. Update delete_my_staff_hour_period to accept p_month
-- 6. Update get_available_slots to prefer month-specific rows
-- 7. Add owner_set_staff_hours (owner manages any staff member)
-- 8. Add owner_get_staff_hours
-- 9. Add owner_delete_staff_hour_period
-- ============================================================

-- ── 1. Add month column ──────────────────────────────────────────────────────
ALTER TABLE public.opening_hours
  ADD COLUMN IF NOT EXISTS month SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE public.opening_hours
  DROP CONSTRAINT IF EXISTS opening_hours_month_check;

ALTER TABLE public.opening_hours
  ADD CONSTRAINT opening_hours_month_check CHECK (month >= 0 AND month <= 12);

-- ── 2. Recreate unique index with month ──────────────────────────────────────
DROP INDEX IF EXISTS public.uniq_opening_hours_staff_period;

CREATE UNIQUE INDEX uniq_opening_hours_staff_period
  ON public.opening_hours(staff_member_id, location_id, day_of_week, sort_order, month)
  WHERE entity_type = 'staff';

-- ── 3. set_my_staff_hours with p_month ───────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER);

CREATE OR REPLACE FUNCTION public.set_my_staff_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_open_time   TIME,
  p_close_time  TIME,
  p_is_closed   BOOLEAN DEFAULT false,
  p_sort_order  INTEGER DEFAULT 0,
  p_month       SMALLINT DEFAULT 0
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
    start_time, end_time, is_closed, sort_order, month
  ) VALUES (
    'staff', v_sm_id, p_location_id, p_day_of_week,
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

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER, SMALLINT) TO authenticated;


-- ── 4. get_staff_opening_hours with p_month ──────────────────────────────────
DROP FUNCTION IF EXISTS public.get_staff_opening_hours(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_staff_opening_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_month           SMALLINT DEFAULT 0
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
        'day_of_week', oh.day_of_week,
        'start_time',  oh.start_time::TEXT,
        'end_time',    oh.end_time::TEXT,
        'is_closed',   oh.is_closed,
        'sort_order',  oh.sort_order,
        'month',       oh.month
      )
      ORDER BY oh.day_of_week, oh.sort_order
    ),
    '[]'::jsonb
  )
  FROM opening_hours oh
  WHERE oh.staff_member_id = p_staff_member_id
    AND oh.location_id     = p_location_id
    AND oh.entity_type     = 'staff'
    AND oh.month           = p_month;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_opening_hours(UUID, UUID, SMALLINT) TO authenticated;


-- ── 5. delete_my_staff_hour_period with p_month ──────────────────────────────
DROP FUNCTION IF EXISTS public.delete_my_staff_hour_period(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.delete_my_staff_hour_period(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_sort_order  INTEGER,
  p_month       SMALLINT DEFAULT 0
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

  IF COALESCE(p_sort_order, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  SELECT id INTO v_sm_id
  FROM staff_members
  WHERE user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  DELETE FROM opening_hours
  WHERE staff_member_id = v_sm_id
    AND location_id     = p_location_id
    AND day_of_week     = p_day_of_week
    AND sort_order      = p_sort_order
    AND month           = COALESCE(p_month, 0)
    AND entity_type     = 'staff';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_staff_hour_period(UUID, INTEGER, INTEGER, SMALLINT) TO authenticated;


-- ── 6. Update get_available_slots to prefer month-specific rows ───────────────
-- Only the opening-hours lookup section changes; rest of function is identical.

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

    v_dow := EXTRACT(dow FROM v_day)::INTEGER;

    -- 5a. Opening hours lookup (month-aware: prefer specific month over default 0)
    v_found_oh := false;

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
      ORDER BY oh.month DESC  -- month-specific row wins over default (0)
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


-- ── 7. owner_set_staff_hours ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_staff_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_open_time       TIME,
  p_close_time      TIME,
  p_is_closed       BOOLEAN DEFAULT false,
  p_sort_order      INTEGER DEFAULT 0,
  p_month           SMALLINT DEFAULT 0
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Verify caller is owner/manager of the business
  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- Verify the target staff member belongs to the same business
  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Verify location belongs to business
  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

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

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_staff_hours(UUID, UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER, SMALLINT) TO authenticated;


-- ── 8. owner_get_staff_hours ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_staff_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_month           SMALLINT DEFAULT 0
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

  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'day_of_week', oh.day_of_week,
        'start_time',  oh.start_time::TEXT,
        'end_time',    oh.end_time::TEXT,
        'is_closed',   oh.is_closed,
        'sort_order',  oh.sort_order,
        'month',       oh.month
      )
      ORDER BY oh.day_of_week, oh.sort_order
    )
    FROM opening_hours oh
    JOIN staff_members sm ON sm.id = oh.staff_member_id
    WHERE oh.staff_member_id = p_staff_member_id
      AND oh.location_id     = p_location_id
      AND oh.entity_type     = 'staff'
      AND oh.month           = p_month
      AND sm.business_id     = v_biz_id),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_staff_hours(UUID, UUID, SMALLINT) TO authenticated;


-- ── 9. owner_delete_staff_hour_period ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_delete_staff_hour_period(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_sort_order      INTEGER,
  p_month           SMALLINT DEFAULT 0
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF COALESCE(p_sort_order, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  DELETE FROM opening_hours
  WHERE staff_member_id = p_staff_member_id
    AND location_id     = p_location_id
    AND day_of_week     = p_day_of_week
    AND sort_order      = p_sort_order
    AND month           = COALESCE(p_month, 0)
    AND entity_type     = 'staff';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_staff_hour_period(UUID, UUID, INTEGER, INTEGER, SMALLINT) TO authenticated;
