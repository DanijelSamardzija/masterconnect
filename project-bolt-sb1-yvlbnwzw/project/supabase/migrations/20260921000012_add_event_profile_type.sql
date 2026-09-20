-- ==========================================================================
-- Migration 12: Add 'event' profile_type
--
-- Adds 'event' (Događaji) as a sixth profile type alongside the existing
-- five: appointment, accommodation, restaurant, tradespeople, food_order.
--
-- Changes:
--   1. DROP + recreate the CHECK constraint on booking_profiles.profile_type
--   2. Update create_booking_profile RPC validation to allow 'event'
-- ==========================================================================

-- ── 1. Update CHECK constraint ─────────────────────────────────────────────

ALTER TABLE public.booking_profiles
  DROP CONSTRAINT IF EXISTS booking_profiles_profile_type_check;

ALTER TABLE public.booking_profiles
  ADD CONSTRAINT booking_profiles_profile_type_check
  CHECK (profile_type IN (
    'appointment',
    'accommodation',
    'restaurant',
    'tradespeople',
    'food_order',
    'event'
  ));

-- ── 2. Update create_booking_profile RPC ───────────────────────────────────

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

  IF p_profile_type NOT IN ('appointment', 'accommodation', 'restaurant', 'tradespeople', 'food_order', 'event') THEN
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

  -- Seed booking rules with all defaults
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
