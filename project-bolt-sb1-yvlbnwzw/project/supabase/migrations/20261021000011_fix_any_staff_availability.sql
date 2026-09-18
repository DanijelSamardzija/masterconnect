-- Fix get_available_slots_any_staff and get_staff_available_for_slot.
--
-- The original migration (20261020000000) assumed get_available_slots returned
-- (slot_date DATE, slot_start TIME, slot_end TIME, ...) and combined them via
-- (slot_date + slot_start) AT TIME ZONE tz.
--
-- The actual function has always returned slot_start TIMESTAMPTZ and slot_end TIMESTAMPTZ,
-- so s.slot_date never existed and the LATERAL join silently returned 0 rows.
-- Fix: reference s.slot_start and s.slot_end directly.

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
BEGIN
  SELECT sc.business_id INTO v_biz_id
  FROM service_catalog sc
  WHERE sc.id = p_service_id AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id
  ) INTO v_has_assignments;

  RETURN QUERY
  SELECT DISTINCT ON (ts)
    ts                AS slot_start,
    te                AS slot_end,
    true::BOOLEAN     AS available,
    max_cap           AS capacity_remaining
  FROM (
    SELECT
      s.slot_start AS ts,
      s.slot_end   AS te,
      s.capacity_remaining AS max_cap
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
BEGIN
  SELECT sc.business_id INTO v_biz_id
  FROM service_catalog sc
  WHERE sc.id = p_service_id AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT EXISTS(
    SELECT 1 FROM staff_services ss WHERE ss.service_id = p_service_id
  ) INTO v_has_assignments;

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
      WHERE s.slot_start = p_slot_start
        AND s.capacity_remaining > 0
    )
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_available_slots_any_staff(UUID, UUID, UUID, DATE) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_staff_available_for_slot(UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, DATE) TO authenticated, anon;
