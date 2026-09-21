-- Fix: upsert_my_business_profile must NEVER change profiles.name.
-- profiles.name is the user's GigZone identity and belongs exclusively to
-- the user's own profile settings — not to any booking profile flow.
--
-- Additionally, the old 2-param overload from f10_business_setup did not
-- update booking_profiles.name at all, leaving it stale.
--
-- This migration:
--   1. Drops the 2-param overload (now obsolete).
--   2. Replaces the 3-param overload (UUID DEFAULT NULL) so it:
--      a. Sets profiles.is_business = true ONLY (no name change).
--      b. Updates booking_profiles.name for the target profile.
--      c. Ensures staff_members owner row for the target profile.
--      d. Creates a default location if none exists for the target profile.

-- Drop the outdated 2-param overload that was modifying profiles.name
-- and did not update booking_profiles.name.
DROP FUNCTION IF EXISTS public.upsert_my_business_profile(TEXT, TEXT);

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

  -- Resolve which booking profile to update
  IF p_booking_profile_id IS NOT NULL THEN
    -- Secondary profile: caller must own it
    IF NOT EXISTS (
      SELECT 1 FROM booking_profiles
      WHERE id = p_booking_profile_id AND owner_id = v_uid
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_bp_id := p_booking_profile_id;
  ELSE
    -- Primary profile: id equals the user's own id
    v_bp_id := v_uid;
  END IF;

  -- Mark user as a business — intentionally does NOT touch profiles.name.
  -- profiles.name is the user's GigZone identity and must only be changed
  -- through the regular profile settings, never from a booking profile flow.
  UPDATE profiles
  SET    is_business = true
  WHERE  id = v_uid;

  -- Update the name and active flag on the target booking profile only.
  UPDATE booking_profiles
  SET    name       = trim(p_name),
         is_active  = true,
         updated_at = now()
  WHERE  id = v_bp_id;

  -- Ensure owner row exists in staff_members for this booking profile.
  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_bp_id, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role       = 'owner',
                is_active  = true,
                updated_at = now();

  -- Create a default primary location if this booking profile has none.
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
