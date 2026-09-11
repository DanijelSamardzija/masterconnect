-- ==========================================================================
-- Split hours (dvokratno radno vrijeme)
--
-- Changes:
--   1. Add sort_order SMALLINT NOT NULL DEFAULT 0 to opening_hours
--   2. Replace uniq_opening_hours_business_day (per-day) with
--      uniq_opening_hours_business_period (per-day-per-period)
--   3. get_available_slots: loop over all non-closed business periods per day
--   4. upsert_opening_hours: add p_sort_order parameter
--   5. get_opening_hours: return actual rows (with sort_order), no fill-in defaults
--   6. delete_opening_hour_period: new RPC to remove extra periods (sort_order > 0)
--
-- Backward compatibility:
--   - Existing rows get sort_order=0 via DEFAULT — no data loss
--   - Calling upsert_opening_hours without p_sort_order still works (DEFAULT 0)
--   - Slot engine with one period per day produces identical results
-- ==========================================================================

-- ── 1. Add sort_order column ─────────────────────────────────────────────────

ALTER TABLE public.opening_hours
  ADD COLUMN IF NOT EXISTS sort_order SMALLINT NOT NULL DEFAULT 0;

-- ── 2. Replace unique index ───────────────────────────────────────────────────
-- Old index allows only one row per (location, day).
-- New index allows multiple rows per (location, day, sort_order).

DROP INDEX IF EXISTS public.uniq_opening_hours_business_day;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_opening_hours_business_period
  ON public.opening_hours(location_id, day_of_week, sort_order)
  WHERE entity_type = 'business';

-- ── 3. get_available_slots: support multiple periods per day ──────────────────
-- Key change: replace single SELECT...LIMIT 1 for business hours with
-- a FOR loop (via UNION ALL query) over all non-closed periods ordered by sort_order.
-- Staff schedule remains single-period (unchanged).

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
  v_period           RECORD;
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

  -- 2. Booking rules (defaults match schema CHECK constraints)
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
  v_earliest     := now() + make_interval(mins => v_min_notice_min);
  v_deadline     := now() + make_interval(days => v_max_advance_days);
  v_week_end     := p_week_start + 6;
  v_interval     := make_interval(mins => v_slot_interval);
  v_duration_iv  := make_interval(mins => v_svc_duration);

  -- 5. Day loop
  FOR v_day IN
    SELECT d::DATE
    FROM   generate_series(
             p_week_start::TIMESTAMP,
             v_week_end::TIMESTAMP,
             '1 day'::INTERVAL
           ) AS d
  LOOP
    -- Skip day if its midnight is already beyond the booking horizon
    IF (v_day::TEXT || ' 00:00:00')::TIMESTAMP AT TIME ZONE v_timezone > v_deadline THEN
      EXIT;
    END IF;

    v_dow := EXTRACT(dow FROM v_day)::INTEGER; -- 0=Sun…6=Sat

    -- 5a. Opening hours lookup
    v_found_oh := false;

    IF p_staff_member_id IS NOT NULL THEN
      SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
      INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
      FROM   opening_hours oh
      WHERE  oh.location_id     = p_location_id
        AND  oh.entity_type     = 'staff'
        AND  oh.staff_member_id = p_staff_member_id
        AND  oh.day_of_week     = v_dow
      LIMIT 1;

      IF FOUND THEN v_found_oh := true; END IF;
    END IF;

    -- 5b. Iterate over period(s) for this day.
    --
    -- Staff schedule (v_found_oh=true): contributes exactly 0 or 1 row depending
    --   on whether the staff member is open that day.
    -- Business schedule (v_found_oh=false): contributes all non-closed periods
    --   ordered by sort_order, enabling dvokratno radno vrijeme.
    --
    -- Using UNION ALL ensures the slot-generation loop runs once per period
    -- without code duplication.

    FOR v_period IN
      -- Staff period (0 or 1 row)
      SELECT v_oh_start        AS start_time,
             v_oh_end          AS end_time,
             v_oh_crosses_mid  AS crosses_midnight,
             0                 AS ord
      WHERE  v_found_oh = true AND v_oh_is_closed = false
      UNION ALL
      -- Business periods (0..N rows, ordered by sort_order)
      SELECT oh.start_time,
             oh.end_time,
             oh.crosses_midnight,
             oh.sort_order     AS ord
      FROM   opening_hours oh
      WHERE  v_found_oh = false
        AND  oh.location_id = p_location_id
        AND  oh.entity_type = 'business'
        AND  oh.day_of_week = v_dow
        AND  oh.is_closed   = false
      ORDER BY ord
    LOOP
      -- 5c. Local time → UTC
      v_open_start_utc := (v_day::TEXT || ' ' || v_period.start_time::TEXT)::TIMESTAMP
                          AT TIME ZONE v_timezone;

      IF v_period.crosses_midnight THEN
        v_open_end_utc := ((v_day + 1)::TEXT || ' ' || v_period.end_time::TEXT)::TIMESTAMP
                          AT TIME ZONE v_timezone;
      ELSE
        v_open_end_utc := (v_day::TEXT || ' ' || v_period.end_time::TEXT)::TIMESTAMP
                          AT TIME ZONE v_timezone;
      END IF;

      -- 6. Slot loop
      v_slot_ts := v_open_start_utc;

      WHILE v_slot_ts + v_duration_iv <= v_open_end_utc LOOP
        v_slot_end_ts := v_slot_ts + v_duration_iv;

        -- 6a. Too soon
        IF v_slot_ts < v_earliest THEN
          v_slot_ts := v_slot_ts + v_interval;
          CONTINUE;
        END IF;

        -- 6b. Beyond horizon — no more slots on any remaining day
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

        -- 6f. Staff double-booking (any service, respects that service's buffer)
        IF p_staff_member_id IS NOT NULL AND EXISTS (
          SELECT 1
          FROM   bookings b
          JOIN   service_catalog sc ON sc.id = b.service_id
          WHERE  b.staff_member_id = p_staff_member_id
            AND  b.status IN ('pending', 'confirmed')
            AND  b.starts_at < v_slot_end_ts
            AND  (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0))) > v_slot_ts
        ) THEN
          v_slot_ts := v_slot_ts + v_interval;
          CONTINUE;
        END IF;

        -- 6g. Resource double-booking
        IF p_resource_id IS NOT NULL AND EXISTS (
          SELECT 1
          FROM   bookings b
          JOIN   service_catalog sc ON sc.id = b.service_id
          WHERE  b.resource_id = p_resource_id
            AND  b.status IN ('pending', 'confirmed')
            AND  b.starts_at < v_slot_end_ts
            AND  (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0))) > v_slot_ts
        ) THEN
          v_slot_ts := v_slot_ts + v_interval;
          CONTINUE;
        END IF;

        -- 6h. Service capacity
        SELECT COUNT(*)
        INTO   v_capacity_used
        FROM   bookings b
        JOIN   service_catalog sc ON sc.id = b.service_id
        WHERE  b.business_id = p_business_id
          AND  b.service_id  = p_service_id
          AND  b.status IN ('pending', 'confirmed')
          AND  b.starts_at < v_slot_end_ts
          AND  (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0))) > v_slot_ts;

        -- 6i. Emit row
        slot_start         := v_slot_ts;
        slot_end           := v_slot_end_ts;
        capacity_remaining := GREATEST(0, v_svc_capacity - v_capacity_used);
        available          := capacity_remaining > 0;
        RETURN NEXT;

        v_slot_ts := v_slot_ts + v_interval;
      END LOOP; -- slot loop
    END LOOP; -- period loop
  END LOOP; -- day loop

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO authenticated;

-- ── 4. upsert_opening_hours: add p_sort_order parameter ──────────────────────
-- Drop old 5-param overload first — its ON CONFLICT target (location_id, day_of_week)
-- is removed above and would cause an error on any call.
DROP FUNCTION IF EXISTS public.upsert_opening_hours(UUID, INTEGER, TIME, TIME, BOOLEAN);

-- Callers that omit p_sort_order still get DEFAULT 0 (backward compatible).

CREATE OR REPLACE FUNCTION public.upsert_opening_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_open_time   TIME    DEFAULT '09:00',
  p_close_time  TIME    DEFAULT '17:00',
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
  v_uid         UUID;
  v_biz_id      UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM   business_locations
  WHERE  id = p_location_id AND is_active = true
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

  INSERT INTO opening_hours (
    entity_type, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order
  ) VALUES (
    'business',
    p_location_id,
    p_day_of_week,
    COALESCE(p_open_time,  '09:00'),
    COALESCE(p_close_time, '17:00'),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0)
  )
  ON CONFLICT (location_id, day_of_week, sort_order)
  WHERE entity_type = 'business'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'),
    end_time   = COALESCE(p_close_time, '17:00'),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_opening_hours(UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER) TO authenticated;

-- ── 5. get_opening_hours: return all stored periods with sort_order ────────────
-- Returns actual DB rows ordered by (day_of_week, sort_order).
-- Days with no saved hours are omitted; the client fills in defaults for those.
-- Returns '[]'::jsonb (not NULL) when no hours are saved.

CREATE OR REPLACE FUNCTION public.get_opening_hours(
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
        'day_of_week', oh.day_of_week,
        'start_time',  oh.start_time::TEXT,
        'end_time',    oh.end_time::TEXT,
        'is_closed',   oh.is_closed,
        'sort_order',  oh.sort_order
      )
      ORDER BY oh.day_of_week, oh.sort_order
    ),
    '[]'::jsonb
  )
  FROM opening_hours oh
  WHERE oh.location_id = p_location_id
    AND oh.entity_type = 'business';
$$;

GRANT EXECUTE ON FUNCTION public.get_opening_hours(UUID) TO authenticated, anon;

-- ── 6. delete_opening_hour_period ────────────────────────────────────────────
-- Removes one extra period (sort_order > 0) for a day.
-- The primary period (sort_order = 0) cannot be deleted here;
-- use upsert_opening_hours with is_closed=true to close a day instead.

CREATE OR REPLACE FUNCTION public.delete_opening_hour_period(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_sort_order  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_sort_order IS NULL OR p_sort_order <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM   business_locations
  WHERE  id = p_location_id AND is_active = true
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

  DELETE FROM opening_hours
  WHERE  location_id = p_location_id
    AND  entity_type = 'business'
    AND  day_of_week = p_day_of_week
    AND  sort_order  = p_sort_order;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_opening_hour_period(UUID, INTEGER, INTEGER) TO authenticated;
