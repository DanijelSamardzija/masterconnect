-- ============================================================
-- staff_create_booking  — add p_guest_name, p_guest_phone
-- get_my_staff_bookings — add guest_name, guest_phone, client_phone
-- ============================================================

-- Drop old signatures (parameter count changed → new overload would coexist)
DROP FUNCTION IF EXISTS public.staff_create_booking(UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_my_staff_bookings(BOOLEAN);

-- ── staff_create_booking ──────────────────────────────────────────────────────
-- Creates a walk-in / phone booking on behalf of a named guest.
-- Skips opening-hours and min-notice checks (staff override).
-- Double-booking check is still enforced.
-- Requires: permissions.can_create_bookings = true

CREATE OR REPLACE FUNCTION public.staff_create_booking(
  p_service_id  UUID,
  p_starts_at   TIMESTAMPTZ,
  p_notes       TEXT DEFAULT NULL,
  p_guest_name  TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID;
  v_sm      RECORD;
  v_svc     RECORD;
  v_ends_at TIMESTAMPTZ;
  v_new_id  UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.primary_location_id, sm.permissions
  INTO v_sm
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_sm.permissions->>'can_create_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT sc.name, sc.duration_minutes, sc.buffer_minutes, sc.booking_type
  INTO v_svc
  FROM service_catalog sc
  WHERE sc.id = p_service_id
    AND sc.business_id = v_sm.business_id
    AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_svc.duration_minutes);

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN service_catalog sc2 ON sc2.id = b.service_id
    WHERE b.staff_member_id = v_sm.id
      AND b.status IN ('pending', 'confirmed')
      AND p_starts_at < (b.ends_at  + make_interval(mins => COALESCE(sc2.buffer_minutes, 0)))
      AND b.starts_at < (v_ends_at  + make_interval(mins => COALESCE(v_svc.buffer_minutes, 0)))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, location_id,
    starts_at, ends_at, notes,
    guest_name, guest_phone,
    status, confirmation_mode, payment_status
  ) VALUES (
    v_svc.booking_type, v_sm.business_id, NULL,
    p_service_id, v_svc.name, v_svc.duration_minutes,
    v_sm.id, v_sm.primary_location_id,
    p_starts_at, v_ends_at, p_notes,
    NULLIF(TRIM(COALESCE(p_guest_name, '')), ''),
    NULLIF(TRIM(COALESCE(p_guest_phone, '')), ''),
    'confirmed', 'instant', 'not_required'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_create_booking(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;


-- ── get_my_staff_bookings ─────────────────────────────────────────────────────
-- Returns bookings assigned to the calling user as a staff member.
-- Now also returns guest_name, guest_phone, client_phone.

CREATE OR REPLACE FUNCTION public.get_my_staff_bookings(
  p_upcoming_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  booking_id       UUID,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  status           TEXT,
  service_name     TEXT,
  duration_minutes INTEGER,
  client_name      TEXT,
  client_phone     TEXT,
  guest_name       TEXT,
  guest_phone      TEXT,
  location_name    TEXT,
  notes            TEXT,
  party_size       INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id              AS booking_id,
    b.starts_at,
    b.ends_at,
    b.status::TEXT,
    COALESCE(b.service_name_snapshot, sc.name, '—') AS service_name,
    b.duration_minutes,
    cp.name           AS client_name,
    cp.phone          AS client_phone,
    b.guest_name,
    b.guest_phone,
    bl.name           AS location_name,
    b.notes,
    b.party_size
  FROM bookings b
  JOIN staff_members sm ON sm.id = b.staff_member_id
  LEFT JOIN service_catalog sc ON sc.id = b.service_id
  LEFT JOIN profiles cp ON cp.id = b.client_id
  LEFT JOIN business_locations bl ON bl.id = b.location_id
  WHERE sm.user_id = auth.uid()
    AND (NOT p_upcoming_only OR b.starts_at >= now())
    AND b.status NOT IN ('cancelled')
  ORDER BY b.starts_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_bookings(BOOLEAN) TO authenticated;
