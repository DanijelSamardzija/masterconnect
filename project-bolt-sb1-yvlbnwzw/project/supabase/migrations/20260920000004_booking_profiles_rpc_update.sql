-- ==========================================================================
-- Migration 4 of 6: RPC update — booking_profiles validation
--
-- Changes all 9 booking-write RPCs from the old
--   PERFORM id FROM profiles WHERE id = ... AND is_business = true
-- pattern to the new
--   PERFORM id FROM booking_profiles WHERE id = ...
-- pattern, which is the correct check after Migration 2 re-bound all
-- business_id FKs from profiles(id) to booking_profiles(id).
--
-- Additionally:
--   set_post_booking_enabled   — add p_booking_profile_id UUID DEFAULT NULL
--   upsert_my_business_profile — add p_booking_profile_id UUID DEFAULT NULL
--   deactivate_booking_profile — add p_booking_profile_id UUID (required)
--   reactivate_booking_profile — add p_booking_profile_id UUID (required)
--
-- SAFE for existing users: their booking_profiles.id == profiles.id == auth.uid()
-- so all existing callers still work without any frontend changes.
-- ==========================================================================

BEGIN;

-- ── 1. create_booking ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_booking(
  p_business_id     UUID,
  p_location_id     UUID,
  p_service_id      UUID,
  p_starts_at       TIMESTAMPTZ,
  p_staff_member_id UUID    DEFAULT NULL,
  p_resource_id     UUID    DEFAULT NULL,
  p_party_size      INTEGER DEFAULT 1,
  p_notes           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id        UUID;
  v_timezone         TEXT;
  v_slot_interval    INTEGER;
  v_min_notice_min   INTEGER;
  v_max_advance_days INTEGER;
  v_confirm_mode     TEXT;
  v_svc_duration     INTEGER;
  v_svc_buffer       INTEGER;
  v_svc_capacity     INTEGER;
  v_svc_booking_type TEXT;
  v_svc_name         TEXT;
  v_ends_at          TIMESTAMPTZ;
  v_booking_status   TEXT;
  v_new_booking_id   UUID;
  v_capacity_used    BIGINT;
  v_day_local        DATE;
  v_dow              INTEGER;
  v_oh_start         TIME;
  v_oh_end           TIME;
  v_oh_is_closed     BOOLEAN;
  v_oh_crosses_mid   BOOLEAN;
  v_found_oh         BOOLEAN;
  v_open_start_utc   TIMESTAMPTZ;
  v_open_end_utc     TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_party_size < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_party_size');
  END IF;

  PERFORM id FROM booking_profiles
  WHERE id = p_business_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  SELECT bl.timezone INTO v_timezone
  FROM business_locations bl
  WHERE bl.id = p_location_id
    AND bl.business_id = p_business_id
    AND bl.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  SELECT sc.duration_minutes, sc.buffer_minutes, sc.capacity,
         sc.booking_type, sc.name
  INTO   v_svc_duration, v_svc_buffer, v_svc_capacity,
         v_svc_booking_type, v_svc_name
  FROM   service_catalog sc
  WHERE  sc.id = p_service_id
    AND  sc.business_id = p_business_id
    AND  sc.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  SELECT br.slot_interval_min, br.min_notice_minutes,
         br.max_advance_days,  br.confirmation_mode
  INTO   v_slot_interval, v_min_notice_min,
         v_max_advance_days,   v_confirm_mode
  FROM   booking_rules br
  WHERE  br.business_id = p_business_id;

  IF NOT FOUND THEN
    v_slot_interval    := 15;
    v_min_notice_min   := 60;
    v_max_advance_days := 60;
    v_confirm_mode     := 'instant';
  END IF;

  IF p_staff_member_id IS NOT NULL THEN
    PERFORM id FROM staff_members
    WHERE id = p_staff_member_id
      AND business_id = p_business_id
      AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
    END IF;
  END IF;

  IF p_resource_id IS NOT NULL THEN
    PERFORM id FROM resources
    WHERE id = p_resource_id
      AND business_id = p_business_id
      AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'resource_not_found');
    END IF;
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_svc_duration);

  IF p_starts_at < now() + make_interval(mins => v_min_notice_min) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_soon');
  END IF;

  IF p_starts_at > now() + make_interval(days => v_max_advance_days) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_far');
  END IF;

  v_day_local := (p_starts_at AT TIME ZONE v_timezone)::DATE;
  v_dow       := EXTRACT(dow FROM v_day_local)::INTEGER;
  v_found_oh  := false;

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

  IF p_staff_member_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('bk:staff'),
      hashtext(p_staff_member_id::TEXT)
    );
  END IF;

  IF p_resource_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('bk:resource'),
      hashtext(p_resource_id::TEXT)
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type = 'business'
      AND  tb.location_id = p_location_id
      AND  tb.starts_at   < v_ends_at
      AND  tb.ends_at     > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  IF p_staff_member_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type     = 'staff'
      AND  tb.staff_member_id = p_staff_member_id
      AND  tb.starts_at       < v_ends_at
      AND  tb.ends_at         > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  IF p_resource_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM time_blocks tb
    WHERE  tb.entity_type = 'resource'
      AND  tb.resource_id = p_resource_id
      AND  tb.starts_at   < v_ends_at
      AND  tb.ends_at     > p_starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_block_conflict');
  END IF;

  IF p_staff_member_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM   bookings b
    JOIN   service_catalog sc ON sc.id = b.service_id
    WHERE  b.staff_member_id = p_staff_member_id
      AND  b.status IN ('pending', 'confirmed')
      AND  p_starts_at < (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0)))
      AND  b.starts_at < (v_ends_at  + make_interval(mins => v_svc_buffer))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  IF p_resource_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM   bookings b
    JOIN   service_catalog sc ON sc.id = b.service_id
    WHERE  b.resource_id = p_resource_id
      AND  b.status IN ('pending', 'confirmed')
      AND  p_starts_at < (b.ends_at + make_interval(mins => COALESCE(sc.buffer_minutes, 0)))
      AND  b.starts_at < (v_ends_at  + make_interval(mins => v_svc_buffer))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'resource_conflict');
  END IF;

  SELECT COALESCE(SUM(b.party_size), 0)
  INTO   v_capacity_used
  FROM   bookings b
  WHERE  b.business_id = p_business_id
    AND  b.service_id  = p_service_id
    AND  b.status IN ('pending', 'confirmed')
    AND  b.starts_at  < (v_ends_at  + make_interval(mins => v_svc_buffer))
    AND  (b.ends_at   + make_interval(mins => v_svc_buffer)) > p_starts_at;

  IF v_capacity_used + p_party_size > v_svc_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_full');
  END IF;

  v_booking_status := CASE v_confirm_mode WHEN 'instant' THEN 'confirmed' ELSE 'pending' END;

  INSERT INTO bookings (
    booking_type, business_id, client_id, service_id,
    service_name_snapshot, duration_minutes, staff_member_id,
    location_id, resource_id, starts_at, ends_at, party_size,
    notes, status, confirmation_mode, payment_status
  ) VALUES (
    v_svc_booking_type, p_business_id, v_caller_id, p_service_id,
    v_svc_name, v_svc_duration, p_staff_member_id,
    p_location_id, p_resource_id, p_starts_at, v_ends_at, p_party_size,
    p_notes, v_booking_status, v_confirm_mode, 'not_required'
  )
  RETURNING id INTO v_new_booking_id;

  RETURN jsonb_build_object(
    'ok',                true,
    'booking_id',        v_new_booking_id,
    'status',            v_booking_status,
    'confirmation_mode', v_confirm_mode,
    'starts_at',         p_starts_at,
    'ends_at',           v_ends_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking(UUID, UUID, UUID, TIMESTAMPTZ, UUID, UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_booking(UUID, UUID, UUID, TIMESTAMPTZ, UUID, UUID, INTEGER, TEXT) TO authenticated;

-- ── 2. send_staff_invitation ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_staff_invitation(
  p_business_id UUID,
  p_email       TEXT,
  p_role        TEXT,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_inv_id      UUID;
  v_token       TEXT;
  v_expires_at  TIMESTAMPTZ;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_role NOT IN ('manager', 'worker') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_role');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  PERFORM id FROM booking_profiles
  WHERE id = p_business_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  SELECT sm.role INTO v_caller_role
  FROM staff_members sm
  WHERE sm.business_id = p_business_id
    AND sm.user_id     = v_caller_id
    AND sm.is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_caller_role = 'manager' AND p_role = 'manager' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_location_id IS NOT NULL THEN
    PERFORM id FROM business_locations
    WHERE id = p_location_id AND business_id = p_business_id AND is_active = true
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   staff_members sm
    JOIN   profiles p ON p.id = sm.user_id
    WHERE  sm.business_id = p_business_id
      AND  sm.is_active   = true
      AND  lower(p.email) = lower(p_email)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_staff');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM   staff_members sm
    JOIN   auth.users au ON au.id = sm.user_id
    WHERE  sm.business_id = p_business_id
      AND  sm.is_active   = true
      AND  lower(au.email) = lower(p_email)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_staff');
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_invitations
    WHERE  business_id = p_business_id
      AND  lower(email) = lower(p_email)
      AND  status = 'pending'
      AND  expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_already_pending');
  END IF;

  v_token      := gen_random_uuid()::TEXT;
  v_expires_at := now() + INTERVAL '7 days';

  INSERT INTO staff_invitations (
    business_id, inviter_id, email, role, location_id,
    token, status, expires_at
  ) VALUES (
    p_business_id, v_caller_id, lower(p_email), p_role, p_location_id,
    v_token, 'pending', v_expires_at
  )
  RETURNING id INTO v_inv_id;

  RETURN jsonb_build_object(
    'ok',            true,
    'invitation_id', v_inv_id,
    'token',         v_token,
    'expires_at',    v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_staff_invitation(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ── 3. create_location ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_location(
  p_business_id UUID,
  p_name        TEXT,
  p_address     TEXT    DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL,
  p_country     TEXT    DEFAULT NULL,
  p_timezone    TEXT    DEFAULT 'Europe/Sarajevo',
  p_latitude    FLOAT8  DEFAULT NULL,
  p_longitude   FLOAT8  DEFAULT NULL,
  p_phone       TEXT    DEFAULT NULL,
  p_email       TEXT    DEFAULT NULL,
  p_is_primary  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_loc_id      UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_name_empty');
  END IF;

  IF p_timezone IS NULL OR trim(p_timezone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_timezone');
  END IF;

  PERFORM id FROM booking_profiles
  WHERE id = p_business_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'business_not_found');
  END IF;

  SELECT sm.role INTO v_caller_role
  FROM staff_members sm
  WHERE sm.business_id = p_business_id
    AND sm.user_id     = v_caller_id
    AND sm.is_active   = true
  LIMIT 1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_is_primary THEN
    UPDATE business_locations
    SET    is_primary  = false,
           updated_at  = now()
    WHERE  business_id = p_business_id
      AND  is_primary  = true;
  END IF;

  INSERT INTO business_locations (
    business_id, name, address, city, country, timezone,
    latitude, longitude, phone, email, is_primary, is_active
  ) VALUES (
    p_business_id, trim(p_name), p_address, p_city, p_country,
    trim(p_timezone), p_latitude, p_longitude, p_phone, p_email,
    p_is_primary, true
  )
  RETURNING id INTO v_loc_id;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_location(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, FLOAT8, FLOAT8, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ── 4. upsert_booking_rules ────────────────────────────────────────────────
-- Replaces both 20261012000000 and 20261015000001 versions.

CREATE OR REPLACE FUNCTION public.upsert_booking_rules(
  p_confirmation_mode  TEXT,
  p_min_notice_minutes INTEGER,
  p_max_advance_days   INTEGER,
  p_cancellation_hours INTEGER,
  p_slot_interval_min  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := auth.uid();
BEGIN
  IF v_business_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  PERFORM id FROM booking_profiles WHERE id = v_business_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
  END IF;

  IF p_confirmation_mode NOT IN ('instant', 'requires_approval') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_confirmation_mode');
  END IF;
  IF p_slot_interval_min NOT IN (10, 15, 20, 30, 45, 60, 90, 120) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_slot_interval');
  END IF;
  IF p_min_notice_minutes < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_min_notice');
  END IF;
  IF p_max_advance_days < 1 OR p_max_advance_days > 365 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_max_advance_days');
  END IF;
  IF p_cancellation_hours < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_cancellation_hours');
  END IF;

  INSERT INTO booking_rules (
    business_id, confirmation_mode, min_notice_minutes, max_advance_days,
    cancellation_hours, slot_interval_min
  )
  VALUES (
    v_business_id, p_confirmation_mode, p_min_notice_minutes, p_max_advance_days,
    p_cancellation_hours, p_slot_interval_min
  )
  ON CONFLICT (business_id) DO UPDATE SET
    confirmation_mode   = EXCLUDED.confirmation_mode,
    min_notice_minutes  = EXCLUDED.min_notice_minutes,
    max_advance_days    = EXCLUDED.max_advance_days,
    cancellation_hours  = EXCLUDED.cancellation_hours,
    slot_interval_min   = EXCLUDED.slot_interval_min;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_booking_rules(TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

-- ── 6. set_post_booking_enabled ────────────────────────────────────────────
-- Adds p_booking_profile_id UUID DEFAULT NULL.
-- When p_enabled=true: verifies the caller can manage that booking profile.
-- When p_enabled=false: sets business_id = NULL (profile id doesn't matter).

CREATE OR REPLACE FUNCTION public.set_post_booking_enabled(
  p_post_id            UUID,
  p_enabled            BOOLEAN,
  p_booking_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_post_owner UUID;
  v_bp_id      UUID;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_enabled THEN
    v_bp_id := COALESCE(p_booking_profile_id, v_caller);
    PERFORM id FROM booking_profiles WHERE id = v_bp_id LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
    END IF;
    IF v_bp_id NOT IN (SELECT public.get_my_business_ids()) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_a_business');
    END IF;
  ELSE
    v_bp_id := NULL;
  END IF;

  SELECT user_id INTO v_post_owner
  FROM posts
  WHERE id = p_post_id AND post_type = 'service_listing';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'post_not_found');
  END IF;
  IF v_post_owner != v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  UPDATE posts
  SET
    booking_enabled = p_enabled,
    business_id     = v_bp_id
  WHERE id = p_post_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_post_booking_enabled(UUID, BOOLEAN, UUID) TO authenticated;

-- ── 7. upsert_my_business_profile ──────────────────────────────────────────
-- Adds p_booking_profile_id UUID DEFAULT NULL.
-- NULL → primary profile (v_uid, backward-compat for existing callers).
-- Provided → must be a booking_profile owned by the caller.

CREATE OR REPLACE FUNCTION public.upsert_my_business_profile(
  p_name               TEXT,
  p_timezone           TEXT DEFAULT 'Europe/Sarajevo',
  p_booking_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_bp_id  UUID;
  v_loc_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_timezone IS NULL OR trim(p_timezone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'timezone_required');
  END IF;

  IF p_booking_profile_id IS NOT NULL THEN
    PERFORM id FROM booking_profiles
    WHERE id = p_booking_profile_id AND owner_id = v_uid
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_bp_id := p_booking_profile_id;
  ELSE
    v_bp_id := v_uid;
  END IF;

  UPDATE profiles
  SET    is_business = true,
         name        = trim(p_name)
  WHERE  id = v_uid;

  UPDATE booking_profiles
  SET    name       = trim(p_name),
         is_active  = true,
         updated_at = now()
  WHERE  id = v_bp_id;

  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_bp_id, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role      = 'owner',
                is_active = true,
                updated_at = now();

  SELECT id INTO v_loc_id
  FROM business_locations
  WHERE business_id = v_bp_id AND is_active = true
  ORDER BY created_at
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    INSERT INTO business_locations (
      business_id, name, timezone, is_primary, is_active
    ) VALUES (
      v_bp_id, trim(p_name), trim(p_timezone), true, true
    )
    RETURNING id INTO v_loc_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_my_business_profile(TEXT, TEXT, UUID) TO authenticated;

-- ── 8. deactivate_booking_profile ──────────────────────────────────────────
-- Adds p_booking_profile_id UUID (required).
-- Caller must own the booking profile (booking_profiles.owner_id = auth.uid()).
-- Sets booking_profiles.is_active = false for the specific profile.
-- Only sets profiles.is_business = false if the user has no other active profiles.

CREATE OR REPLACE FUNCTION public.deactivate_booking_profile(
  p_booking_profile_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_future_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  PERFORM id FROM booking_profiles
  WHERE id = p_booking_profile_id AND owner_id = v_uid
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  SELECT COUNT(*) INTO v_future_count
  FROM bookings
  WHERE business_id = p_booking_profile_id
    AND status IN ('pending', 'confirmed')
    AND starts_at > NOW();

  IF v_future_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'has_active_bookings', 'count', v_future_count
    );
  END IF;

  WITH stamped AS (
    UPDATE service_catalog
    SET is_active = false, deactivated_by_profile = true
    WHERE business_id = p_booking_profile_id AND is_active = true
    RETURNING post_id
  )
  UPDATE posts
  SET booking_enabled = false
  WHERE id IN (SELECT post_id FROM stamped WHERE post_id IS NOT NULL);

  UPDATE booking_profiles
  SET is_active  = false,
      updated_at = now()
  WHERE id = p_booking_profile_id;

  -- Turn off is_business only if the user has no other active booking profiles
  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE owner_id = v_uid AND is_active = true
  ) THEN
    UPDATE profiles SET is_business = false WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deactivate_booking_profile(UUID) TO authenticated;

-- ── 9. reactivate_booking_profile ──────────────────────────────────────────
-- Adds p_booking_profile_id UUID (required).
-- Restores services stamped by deactivate_booking_profile.
-- Sets booking_profiles.is_active = true and ensures profiles.is_business = true.

CREATE OR REPLACE FUNCTION public.reactivate_booking_profile(
  p_booking_profile_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  PERFORM id FROM booking_profiles
  WHERE id = p_booking_profile_id AND owner_id = v_uid
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  WITH restored AS (
    UPDATE service_catalog
    SET is_active = true, deactivated_by_profile = false
    WHERE business_id = p_booking_profile_id AND deactivated_by_profile = true
    RETURNING post_id
  )
  UPDATE posts
  SET booking_enabled = true
  WHERE id IN (SELECT post_id FROM restored WHERE post_id IS NOT NULL);

  UPDATE booking_profiles
  SET is_active  = true,
      updated_at = now()
  WHERE id = p_booking_profile_id;

  UPDATE profiles SET is_business = true WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reactivate_booking_profile(UUID) TO authenticated;

-- Drop old overloads that were replaced by new signatures above.
-- PostgreSQL CREATE OR REPLACE only matches exact signatures, so adding
-- a new optional parameter creates a second overload rather than replacing.
DROP FUNCTION IF EXISTS public.deactivate_booking_profile();
DROP FUNCTION IF EXISTS public.reactivate_booking_profile();
DROP FUNCTION IF EXISTS public.set_post_booking_enabled(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_my_business_profile(TEXT, TEXT);

COMMIT;
