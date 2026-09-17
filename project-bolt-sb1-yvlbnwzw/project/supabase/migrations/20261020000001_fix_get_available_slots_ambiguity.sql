-- Fix column ambiguity in get_available_slots when called from LATERAL context.
-- opening_hours.staff_member_id was unqualified in CTE queries, conflicting with
-- the implicit OUT variable of RETURNS TABLE(..., staff_member_id uuid, ...).
-- Fix: add table alias 'oh' to opening_hours and qualify all column references.

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_business_id    UUID,
  p_location_id    UUID,
  p_service_id     UUID,
  p_week_start     DATE,
  p_staff_member_id UUID DEFAULT NULL,
  p_resource_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  slot_date          DATE,
  slot_start         TIME,
  slot_end           TIME,
  staff_member_id    UUID,
  staff_name         TEXT,
  capacity_remaining INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone         TEXT;
  v_min_notice_min   INTEGER;
  v_max_advance_days INTEGER;
  v_svc_duration     INTEGER;
  v_svc_buffer       INTEGER;
  v_svc_capacity     INTEGER;
  v_earliest         TIMESTAMPTZ;
  v_deadline         TIMESTAMPTZ;
  v_week_end         DATE;
  v_interval         INTERVAL;
  v_duration_iv      INTERVAL;
  v_day              DATE;
  v_staff            RECORD;
  v_period           RECORD;
  v_slot_ts          TIMESTAMPTZ;
  v_slot_end_ts      TIMESTAMPTZ;
  v_capacity_used    INTEGER;
BEGIN
  -- 1. Timezone
  SELECT COALESCE(bl.timezone, 'UTC') INTO v_timezone
  FROM business_locations bl
  WHERE bl.id = p_location_id AND bl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  -- 2. Booking rules
  SELECT br.min_notice_minutes, br.max_advance_days
  INTO   v_min_notice_min, v_max_advance_days
  FROM   booking_rules br
  WHERE  br.business_id = p_business_id;

  IF NOT FOUND THEN
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

  v_earliest    := now() + make_interval(mins => v_min_notice_min);
  v_deadline    := now() + make_interval(days => v_max_advance_days);
  v_week_end    := p_week_start + 6;
  v_interval    := make_interval(mins => v_svc_duration);
  v_duration_iv := make_interval(mins => v_svc_duration);

  -- 5. Day loop
  FOR v_day IN
    SELECT generate_series(p_week_start, v_week_end, '1 day'::INTERVAL)::DATE
  LOOP
    -- 6. Staff loop
    FOR v_staff IN
      SELECT sm.id AS sm_id, p.name AS sm_name
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id    = p_business_id
        AND sm.is_active       = true
        AND sm.accept_bookings = true
        AND (p_staff_member_id IS NULL OR sm.id = p_staff_member_id)
        AND (
          NOT EXISTS (SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id)
          OR EXISTS (
            SELECT 1 FROM staff_services ss
            WHERE ss.staff_member_id = sm.id AND ss.service_id = p_service_id
          )
        )
      ORDER BY sm.joined_at
    LOOP
      -- 7. Opening-hours periods for this staff+day (month-aware)
      -- Use alias 'oh' to avoid ambiguity with OUT variable 'staff_member_id'
      FOR v_period IN
        WITH month_hours AS (
          SELECT oh.start_time, oh.end_time, oh.is_closed
          FROM opening_hours oh
          WHERE oh.entity_type     = 'staff'
            AND oh.staff_member_id = v_staff.sm_id
            AND oh.location_id     = p_location_id
            AND oh.day_of_week     = EXTRACT(DOW FROM v_day)::INTEGER
            AND oh.month           = EXTRACT(MONTH FROM v_day)::SMALLINT
          ORDER BY oh.sort_order
        ),
        year_hours AS (
          SELECT oh.start_time, oh.end_time, oh.is_closed
          FROM opening_hours oh
          WHERE oh.entity_type     = 'staff'
            AND oh.staff_member_id = v_staff.sm_id
            AND oh.location_id     = p_location_id
            AND oh.day_of_week     = EXTRACT(DOW FROM v_day)::INTEGER
            AND oh.month           = 0
          ORDER BY oh.sort_order
        )
        SELECT * FROM (
          SELECT * FROM month_hours
          UNION ALL
          SELECT * FROM year_hours WHERE NOT EXISTS (SELECT 1 FROM month_hours)
        ) combined
        WHERE NOT is_closed
      LOOP
        v_slot_ts := (v_day::TEXT || ' ' || v_period.start_time::TEXT)::TIMESTAMPTZ
                     AT TIME ZONE v_timezone;

        WHILE v_slot_ts + v_duration_iv <=
              (v_day::TEXT || ' ' || v_period.end_time::TEXT)::TIMESTAMPTZ
              AT TIME ZONE v_timezone
        LOOP
          v_slot_end_ts := v_slot_ts + v_duration_iv;

          IF v_slot_ts < v_earliest THEN
            v_slot_ts := v_slot_ts + v_interval;
            CONTINUE;
          END IF;

          IF v_slot_ts >= v_deadline THEN
            EXIT;
          END IF;

          -- Skip if staff has a time block covering this slot
          IF EXISTS (
            SELECT 1 FROM time_blocks tb
            WHERE tb.staff_member_id = v_staff.sm_id
              AND tb.starts_at        < v_slot_end_ts
              AND tb.ends_at          > v_slot_ts
          ) THEN
            v_slot_ts := v_slot_ts + v_interval;
            CONTINUE;
          END IF;

          -- Skip if there is a business-level time block for this location covering this slot
          IF EXISTS (
            SELECT 1 FROM time_blocks tb
            WHERE tb.entity_type     = 'business'
              AND tb.location_id     = p_location_id
              AND tb.staff_member_id IS NULL
              AND tb.starts_at        < v_slot_end_ts
              AND tb.ends_at          > v_slot_ts
          ) THEN
            v_slot_ts := v_slot_ts + v_interval;
            CONTINUE;
          END IF;

          -- Count overlapping confirmed/pending bookings for capacity check
          SELECT COUNT(*) INTO v_capacity_used
          FROM bookings b
          WHERE b.staff_member_id = v_staff.sm_id
            AND b.status          IN ('pending', 'confirmed')
            AND b.starts_at        < v_slot_end_ts
            AND b.ends_at          > v_slot_ts;

          slot_date          := v_day;
          slot_start         := (v_slot_ts AT TIME ZONE v_timezone)::TIME;
          slot_end           := (v_slot_end_ts AT TIME ZONE v_timezone)::TIME;
          staff_member_id    := v_staff.sm_id;
          staff_name         := v_staff.sm_name;
          capacity_remaining := GREATEST(0, v_svc_capacity - v_capacity_used);

          IF capacity_remaining = 0 THEN
            v_slot_ts := v_slot_ts + v_interval;
            CONTINUE;
          END IF;

          RETURN NEXT;

          v_slot_ts := v_slot_ts + v_interval;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO authenticated, anon;
