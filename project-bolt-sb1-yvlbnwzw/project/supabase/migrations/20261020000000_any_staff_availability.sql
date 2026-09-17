-- get_available_slots_any_staff
-- Returns the union of available slots across all eligible staff for a service.
-- A slot appears if at least one eligible staff member is free at that time.
--
-- NOTE: get_available_slots returns (slot_date DATE, slot_start TIME, slot_end TIME, ...).
-- We combine slot_date + slot_start with the location timezone to produce TIMESTAMPTZ output
-- that the booking UI expects.
CREATE OR REPLACE FUNCTION get_available_slots_any_staff(
  p_business_id   UUID,
  p_location_id   UUID,
  p_service_id    UUID,
  p_week_start    DATE
)
RETURNS TABLE(slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ, available BOOLEAN, capacity_remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz_id          UUID;
  v_has_assignments BOOLEAN;
  v_timezone        TEXT;
BEGIN
  SELECT sc.business_id INTO v_biz_id
  FROM service_catalog sc
  WHERE sc.id = p_service_id AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id
  ) INTO v_has_assignments;

  SELECT bl.timezone INTO v_timezone
  FROM business_locations bl
  WHERE bl.id = p_location_id
  LIMIT 1;

  v_timezone := COALESCE(v_timezone, 'UTC');

  RETURN QUERY
  SELECT DISTINCT ON (ts)
    ts                AS slot_start,
    te                AS slot_end,
    true::BOOLEAN     AS available,
    max_cap           AS capacity_remaining
  FROM (
    SELECT
      (s.slot_date + s.slot_start) AT TIME ZONE v_timezone AS ts,
      (s.slot_date + s.slot_end)   AT TIME ZONE v_timezone AS te,
      s.capacity_remaining                                  AS max_cap
    FROM (
      SELECT sm.id AS staff_id
      FROM staff_members sm
      WHERE sm.business_id    = v_biz_id
        AND sm.is_active       = true
        AND sm.accept_bookings = true
        AND (
          NOT v_has_assignments
          OR EXISTS (
            SELECT 1 FROM staff_services ss
            WHERE ss.staff_member_id = sm.id AND ss.service_id = p_service_id
          )
        )
    ) eligible
    CROSS JOIN LATERAL get_available_slots(
      p_business_id, p_location_id, p_service_id, p_week_start, eligible.staff_id
    ) AS s
    WHERE s.capacity_remaining > 0
  ) raw
  ORDER BY ts, max_cap DESC;
END;
$$;

-- get_staff_available_for_slot
-- For a specific slot, returns staff who are free and eligible to perform the service.
-- Used to populate the "choose a staff member" dialog after a client picks a slot in any-staff mode.
--
-- NOTE: get_available_slots returns TIME for slot_start (not TIMESTAMPTZ), so we compare
-- by converting back using the location timezone.
CREATE OR REPLACE FUNCTION get_staff_available_for_slot(
  p_business_id   UUID,
  p_location_id   UUID,
  p_service_id    UUID,
  p_slot_start    TIMESTAMPTZ,
  p_slot_end      TIMESTAMPTZ,
  p_week_start    DATE
)
RETURNS TABLE(staff_member_id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz_id          UUID;
  v_has_assignments BOOLEAN;
  v_timezone        TEXT;
BEGIN
  SELECT sc.business_id INTO v_biz_id
  FROM service_catalog sc
  WHERE sc.id = p_service_id AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id
  ) INTO v_has_assignments;

  SELECT bl.timezone INTO v_timezone
  FROM business_locations bl
  WHERE bl.id = p_location_id
  LIMIT 1;

  v_timezone := COALESCE(v_timezone, 'UTC');

  RETURN QUERY
  SELECT sm.id, p.name::TEXT
  FROM staff_members sm
  JOIN profiles p ON p.id = sm.user_id
  WHERE sm.business_id    = v_biz_id
    AND sm.is_active       = true
    AND sm.accept_bookings = true
    AND (
      NOT v_has_assignments
      OR EXISTS (
        SELECT 1 FROM staff_services ss
        WHERE ss.staff_member_id = sm.id AND ss.service_id = p_service_id
      )
    )
    AND EXISTS (
      SELECT 1
      FROM get_available_slots(
        p_business_id, p_location_id, p_service_id, p_week_start, sm.id
      ) AS s
      WHERE (s.slot_date + s.slot_start) AT TIME ZONE v_timezone = p_slot_start
        AND s.capacity_remaining > 0
    )
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_slots_any_staff(UUID, UUID, UUID, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_staff_available_for_slot(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) TO authenticated, anon;
