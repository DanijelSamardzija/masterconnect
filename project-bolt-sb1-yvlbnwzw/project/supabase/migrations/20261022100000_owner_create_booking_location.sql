-- ==========================================================================
-- Fix owner_create_booking: add p_location_id and consolidate overloads.
--
-- Problem: Two overloads existed (7-param and 8-param with guest_email).
-- Neither set location_id on the booking, so manually created bookings had
-- location_id = NULL and never appeared under location filters.
--
-- Fix: Drop both overloads, create single 9-param version that:
--   • accepts p_location_id UUID DEFAULT NULL
--   • stores it in bookings.location_id
--   • derives business from staff member (not auth.uid()) for multi-profile safety
-- ==========================================================================

DROP FUNCTION IF EXISTS public.owner_create_booking(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.owner_create_booking(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.owner_create_booking(
  p_service_id      UUID,
  p_staff_member_id UUID,
  p_starts_at       TIMESTAMPTZ,
  p_guest_name      TEXT        DEFAULT NULL,
  p_guest_phone     TEXT        DEFAULT NULL,
  p_guest_email     TEXT        DEFAULT NULL,
  p_client_id       UUID        DEFAULT NULL,
  p_notes           TEXT        DEFAULT NULL,
  p_location_id     UUID        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_biz_id       UUID;
  v_svc_name     TEXT;
  v_svc_duration INTEGER;
  v_booking_type TEXT;
  v_ends_at      TIMESTAMPTZ;
  v_booking_id   UUID;
  v_token_exp    TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_guest_name IS NULL AND p_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_required');
  END IF;

  -- Derive business from the selected staff member
  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.id = p_staff_member_id AND sm.is_active = true;

  IF v_biz_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Verify caller is owner or manager of that business
  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE user_id     = v_uid
      AND business_id = v_biz_id
      AND is_active   = true
      AND role        IN ('owner', 'manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT name, duration_minutes, booking_type
  INTO v_svc_name, v_svc_duration, v_booking_type
  FROM service_catalog
  WHERE id = p_service_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_svc_duration || ' minutes')::INTERVAL;

  IF p_guest_email IS NOT NULL THEN
    v_token_exp := v_ends_at + INTERVAL '7 days';
  END IF;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    guest_name, guest_phone, guest_email,
    guest_token_expires_at,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, location_id, starts_at, ends_at,
    status, confirmation_mode, notes
  ) VALUES (
    v_booking_type, v_biz_id, p_client_id,
    p_guest_name, p_guest_phone, p_guest_email,
    v_token_exp,
    p_service_id, v_svc_name, v_svc_duration,
    p_staff_member_id, p_location_id, p_starts_at, v_ends_at,
    'confirmed', 'instant', p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_create_booking(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, UUID, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
