-- ==========================================================================
-- Add opening-hours validation to owner_create_booking.
--
-- Rules:
--   • If p_location_id is NULL → skip validation (no location context).
--   • Look up staff-specific hours first, fall back to business hours.
--   • If no opening hours are configured for that location/day → allow.
--   • If location is closed that day, or starts_at/ends_at falls outside
--     the configured window → return 'outside_opening_hours'.
--   • No min_notice / max_advance_days check (owner override on timing).
-- ==========================================================================

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

  -- Opening hours validation
  v_timezone     TEXT;
  v_day_local    DATE;
  v_dow          INTEGER;
  v_oh_start     TIME;
  v_oh_end       TIME;
  v_oh_is_closed BOOLEAN;
  v_oh_crosses_mid BOOLEAN;
  v_found_oh     BOOLEAN;
  v_open_start_utc TIMESTAMPTZ;
  v_open_end_utc   TIMESTAMPTZ;
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

  -- ── Opening hours validation (only when a location is provided) ──────────
  IF p_location_id IS NOT NULL THEN
    SELECT bl.timezone INTO v_timezone
    FROM business_locations bl
    WHERE bl.id = p_location_id AND bl.is_active = true
    LIMIT 1;

    IF v_timezone IS NOT NULL THEN
      v_day_local := (p_starts_at AT TIME ZONE v_timezone)::DATE;
      v_dow       := EXTRACT(dow FROM v_day_local)::INTEGER;
      v_found_oh  := false;

      -- Staff-specific hours take priority
      SELECT oh.start_time, oh.end_time, oh.is_closed, oh.crosses_midnight
      INTO   v_oh_start, v_oh_end, v_oh_is_closed, v_oh_crosses_mid
      FROM   opening_hours oh
      WHERE  oh.location_id     = p_location_id
        AND  oh.entity_type     = 'staff'
        AND  oh.staff_member_id = p_staff_member_id
        AND  oh.day_of_week     = v_dow
      LIMIT 1;
      IF FOUND THEN v_found_oh := true; END IF;

      -- Fall back to business hours
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

      -- Validate only when hours ARE configured
      IF v_found_oh THEN
        IF v_oh_is_closed THEN
          RETURN jsonb_build_object('ok', false, 'error', 'outside_opening_hours');
        END IF;

        v_open_start_utc := (v_day_local::TEXT || ' ' || v_oh_start::TEXT)::TIMESTAMP
                            AT TIME ZONE v_timezone;
        IF v_oh_crosses_mid THEN
          v_open_end_utc := ((v_day_local + 1)::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                            AT TIME ZONE v_timezone;
        ELSE
          v_open_end_utc := (v_day_local::TEXT || ' ' || v_oh_end::TEXT)::TIMESTAMP
                            AT TIME ZONE v_timezone;
        END IF;

        IF p_starts_at < v_open_start_utc OR v_ends_at > v_open_end_utc THEN
          RETURN jsonb_build_object('ok', false, 'error', 'outside_opening_hours');
        END IF;
      END IF;
    END IF;
  END IF;

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
