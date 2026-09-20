-- ==========================================================================
-- Migration 7: Multi-profile auth fixes + create_booking_profile RPC
--
-- Changes:
-- 1. FIX delete_service        — replace user.id ownership check with
--                                staff_members role check (owner/manager)
-- 2. FIX owner_delete_booking  — resolve business_id from booking row,
--                                not from LIMIT 1 on staff_members
-- 3. FIX owner_delete_shift    — resolve business_id from target staff
--                                member, not from caller's LIMIT 1
-- 4. FIX owner_delete_staff_hour_period — same pattern as shift fix
-- 5. NEW create_booking_profile — creates booking_profiles row, seeds
--                                 owner staff_member + booking_rules row
--
-- Root cause of fixes 1-4: LIMIT 1 / equality-with-uid patterns assume
-- profiles.id == booking_profiles.id, which is only true for the primary
-- profile.  Multi-profile breaks this assumption for any secondary profile.
-- ==========================================================================


-- ==========================================================================
-- 1. FIX: delete_service
--    Old auth: IF v_biz_id <> v_uid → not_authorized
--    New auth: caller must be owner/manager in staff_members for that business
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.delete_service(p_service_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_post_id     UUID;
  v_caller_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, post_id
  INTO   v_biz_id, v_post_id
  FROM   service_catalog
  WHERE  id = p_service_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  -- Auth: caller must be owner/manager of the service's business
  SELECT role INTO v_caller_role
  FROM   staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
  LIMIT  1;

  IF NOT FOUND OR v_caller_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Block deletion if there are active/pending future bookings
  IF EXISTS (
    SELECT 1
    FROM   bookings
    WHERE  service_id = p_service_id
      AND  status     IN ('pending', 'confirmed')
      AND  starts_at  > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'has_active_bookings');
  END IF;

  DELETE FROM service_locations WHERE service_id = p_service_id;
  DELETE FROM staff_services     WHERE service_id = p_service_id;

  IF v_post_id IS NOT NULL THEN
    UPDATE posts SET booking_enabled = false WHERE id = v_post_id;
  END IF;

  -- Hard-delete; bookings.service_id → ON DELETE SET NULL keeps history safe
  DELETE FROM service_catalog WHERE id = p_service_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ==========================================================================
-- 2. FIX: owner_delete_booking
--    Old auth: find caller's first business via LIMIT 1, then check booking
--    New auth: load booking's business_id, verify caller is staff there
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.owner_delete_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Load booking — must exist and be in a terminal status
  SELECT business_id, status
  INTO   v_biz_id, v_status
  FROM   bookings
  WHERE  id = p_booking_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_deletable');
  END IF;

  IF v_status NOT IN ('completed', 'cancelled', 'no_show') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_not_deletable');
  END IF;

  -- Auth: caller must be owner/manager of that booking's business
  PERFORM 1 FROM staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
    AND  role        IN ('owner', 'manager')
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  DELETE FROM bookings WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ==========================================================================
-- 3. FIX: owner_delete_shift
--    Old auth: find caller's first business via LIMIT 1
--    New auth: resolve business_id from target staff member
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.owner_delete_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Resolve the business of the target staff member
  SELECT business_id INTO v_biz_id
  FROM   staff_members
  WHERE  id        = p_staff_member_id
    AND  is_active = true
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Auth: caller must be owner/manager of that business
  PERFORM 1 FROM staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
    AND  role        IN ('owner', 'manager')
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  DELETE FROM staff_shifts
  WHERE  staff_member_id = p_staff_member_id
    AND  shift_date      = p_shift_date
    AND  business_id     = v_biz_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ==========================================================================
-- 4. FIX: owner_delete_staff_hour_period
--    Old auth: same LIMIT 1 pattern as shift
--    New auth: resolve business_id from target staff member
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.owner_delete_staff_hour_period(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_sort_order      INTEGER,
  p_month           SMALLINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF COALESCE(p_sort_order, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  -- Resolve the business of the target staff member
  SELECT business_id INTO v_biz_id
  FROM   staff_members
  WHERE  id        = p_staff_member_id
    AND  is_active = true
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Auth: caller must be owner/manager of that business
  PERFORM 1 FROM staff_members
  WHERE  business_id = v_biz_id
    AND  user_id     = v_uid
    AND  is_active   = true
    AND  role        IN ('owner', 'manager')
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  DELETE FROM opening_hours
  WHERE  staff_member_id = p_staff_member_id
    AND  location_id     = p_location_id
    AND  day_of_week     = p_day_of_week
    AND  sort_order      = p_sort_order
    AND  month           = COALESCE(p_month, 0)
    AND  entity_type     = 'staff';

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ==========================================================================
-- 5. NEW: create_booking_profile
--
--    Creates a new booking profile for the calling user:
--      - Inserts into booking_profiles (new UUID)
--      - Sets profiles.is_business = true for the owner
--      - Seeds a staff_members row (role = owner)
--      - Seeds a booking_rules row (all column defaults)
--
--    Returns: { ok: true, profile_id: uuid }
--             { ok: false, error: string }
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.create_booking_profile(
  p_name         TEXT,
  p_profile_type TEXT,
  p_timezone     TEXT DEFAULT 'Europe/Sarajevo'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_profile_type NOT IN ('appointment', 'accommodation', 'restaurant', 'tradespeople', 'food_order') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_profile_type');
  END IF;

  -- Advisory lock: prevent concurrent profile creation for the same user
  PERFORM pg_advisory_xact_lock(hashtext('bk:create_profile:' || v_uid::text));

  v_profile_id := gen_random_uuid();

  -- Create the booking profile
  INSERT INTO booking_profiles (id, owner_id, profile_type, name)
  VALUES (v_profile_id, v_uid, p_profile_type, trim(p_name));

  -- Mark owner's main profile as a business account
  UPDATE profiles SET is_business = true WHERE id = v_uid;

  -- Seed the owner as staff member (owner role) in this profile's business
  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_profile_id, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role = 'owner', is_active = true, updated_at = now();

  -- Seed booking rules with all defaults (confirmation_mode='instant',
  -- min_notice_minutes=60, max_advance_days=60, cancellation_hours=24,
  -- slot_interval_min=15 — all column-level defaults)
  INSERT INTO booking_rules (business_id)
  VALUES (v_profile_id)
  ON CONFLICT (business_id) DO NOTHING;

  -- Seed a default primary location using the provided timezone
  INSERT INTO business_locations (
    business_id, name, timezone, is_primary, is_active
  ) VALUES (
    v_profile_id,
    trim(p_name),
    COALESCE(NULLIF(trim(p_timezone), ''), 'Europe/Sarajevo'),
    true,
    true
  );

  RETURN jsonb_build_object('ok', true, 'profile_id', v_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_profile(TEXT, TEXT, TEXT) TO authenticated;
