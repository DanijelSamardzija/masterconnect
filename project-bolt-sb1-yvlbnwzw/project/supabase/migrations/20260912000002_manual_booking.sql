-- Manual booking support: guest clients (phone/walk-in)
-- make client_id nullable, add guest_name + guest_phone

ALTER TABLE public.bookings
  ALTER COLUMN client_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name  TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- At least one of client_id or guest_name must be present
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_client_or_guest
  CHECK (client_id IS NOT NULL OR guest_name IS NOT NULL);

-- RPC: owner manually creates a booking (guest or existing user)
CREATE OR REPLACE FUNCTION public.owner_create_booking(
  p_service_id      UUID,
  p_staff_member_id UUID,
  p_starts_at       TIMESTAMPTZ,
  p_guest_name      TEXT        DEFAULT NULL,
  p_guest_phone     TEXT        DEFAULT NULL,
  p_client_id       UUID        DEFAULT NULL,
  p_notes           TEXT        DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_guest_name IS NULL AND p_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_required');
  END IF;

  -- Verify owner/manager role and get business_id
  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF v_biz_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Get service details
  SELECT name, duration_minutes, booking_type
  INTO v_svc_name, v_svc_duration, v_booking_type
  FROM service_catalog
  WHERE id = p_service_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_svc_duration || ' minutes')::INTERVAL;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    guest_name, guest_phone,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, starts_at, ends_at,
    status, confirmation_mode, notes
  ) VALUES (
    v_booking_type, v_biz_id, p_client_id,
    p_guest_name, p_guest_phone,
    p_service_id, v_svc_name, v_svc_duration,
    p_staff_member_id, p_starts_at, v_ends_at,
    'confirmed', 'instant', p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_create_booking(UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, UUID, TEXT) TO authenticated;
