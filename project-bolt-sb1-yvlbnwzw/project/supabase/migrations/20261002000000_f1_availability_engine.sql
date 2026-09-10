-- ==========================================================================
-- F1: Availability Engine — get_available_slots RPC
-- Read-only. No advisory locks needed (those are F2 write path).
-- DB is UTC. business_locations.timezone is IANA for local time conversion.
-- opening_hours stores LOCAL time; this function converts to UTC via AT TIME ZONE.
-- ==========================================================================
--
-- RPC CONTRACT
-- ─────────────────────────────────────────────────────────────────────────
-- Function : public.get_available_slots
-- Caller   : frontend booking calendar (F6), post-booking widget (F7)
-- Auth     : anon + authenticated (availability is public)
-- Mode     : STABLE SECURITY DEFINER — no writes, runs as owner (bypasses RLS)
--
-- Parameters
--   p_business_id     UUID     — business profile id (profiles.id, is_business=true)
--   p_location_id     UUID     — location to query (business_locations.id)
--   p_service_id      UUID     — service being booked (service_catalog.id)
--   p_week_start      DATE     — first day of the 7-day window (any day, not just Monday)
--   p_staff_member_id UUID?    — if set: restrict to this staff member's schedule
--   p_resource_id     UUID?    — if set: restrict to slots where resource is free
--
-- Returns TABLE
--   slot_start         TIMESTAMPTZ  UTC start of the potential slot
--   slot_end           TIMESTAMPTZ  UTC end (slot_start + service.duration_minutes)
--   available          BOOLEAN      true when capacity_remaining > 0
--   capacity_remaining INTEGER      service.capacity minus concurrent confirmed/pending bookings
--
-- Slot generation rules (applied in order):
--   1. Load location.timezone — abort if location not found / not active
--   2. Load booking_rules (min_notice_minutes, max_advance_days, slot_interval_min)
--      — use schema defaults if no row exists
--   3. Load service (duration_minutes, buffer_minutes, capacity)
--      — abort if service not found / not active
--   4. Compute window: [now() + min_notice_minutes, now() + max_advance_days]
--   5. For each day in p_week_start .. p_week_start+6:
--      a. Skip if entire day is beyond max_advance horizon
--      b. Look up opening_hours for that day_of_week:
--         — if p_staff_member_id set: prefer 'staff' row, fall back to 'business' row
--         — otherwise: use 'business' row
--      c. Skip if no row found or is_closed = true
--      d. Convert start_time/end_time from local → UTC using location.timezone
--         — if crosses_midnight=true: end is on the following calendar day
--      e. Generate candidate slots by slot_interval_min from open_start to open_end
--         such that slot_start + duration_minutes <= open_end_utc
--   6. For each candidate slot:
--      a. Skip if slot_start < now() + min_notice_minutes  (too soon)
--      b. Stop  if slot_start > now() + max_advance_days   (too far)
--      c. Skip if overlapped by a time_block (entity_type='business', location_id match)
--      d. Skip if overlapped by a time_block (entity_type='staff', staff match) when staff set
--      e. Skip if overlapped by a time_block (entity_type='resource', resource match) when resource set
--      f. Skip if staff already has ANY booking during this slot+buffer (when staff set)
--      g. Skip if resource already has ANY booking during this slot+buffer (when resource set)
--      h. Count concurrent bookings for this service in this slot → capacity_remaining
--      i. Return slot (available = capacity_remaining > 0, even if 0 for waitlist awareness)
-- ==========================================================================

-- ── Performance indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_opening_hours_location_dow
  ON public.opening_hours (location_id, entity_type, day_of_week)
  WHERE NOT is_closed;

CREATE INDEX IF NOT EXISTS idx_opening_hours_staff_dow
  ON public.opening_hours (staff_member_id, day_of_week)
  WHERE entity_type = 'staff' AND NOT is_closed;

CREATE INDEX IF NOT EXISTS idx_time_blocks_business_time
  ON public.time_blocks (location_id, starts_at, ends_at)
  WHERE entity_type = 'business';

CREATE INDEX IF NOT EXISTS idx_time_blocks_staff_time
  ON public.time_blocks (staff_member_id, starts_at, ends_at)
  WHERE entity_type = 'staff';

CREATE INDEX IF NOT EXISTS idx_time_blocks_resource_time
  ON public.time_blocks (resource_id, starts_at, ends_at)
  WHERE entity_type = 'resource';

CREATE INDEX IF NOT EXISTS idx_bookings_service_slot
  ON public.bookings (business_id, service_id, starts_at, ends_at)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_staff_slot
  ON public.bookings (staff_member_id, starts_at, ends_at)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_bookings_resource_slot
  ON public.bookings (resource_id, starts_at, ends_at)
  WHERE status IN ('pending', 'confirmed');

-- ── Main RPC function ──────────────────────────────────────────────────────

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
      -- end_time is on the following calendar day
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
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

-- ── Permissions ────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID, UUID) TO authenticated;
