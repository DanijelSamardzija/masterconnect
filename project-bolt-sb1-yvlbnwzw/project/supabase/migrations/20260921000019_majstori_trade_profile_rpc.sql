-- Faza 2 (Majstori i Firme): Trade profile extensions.
--
-- 1. Add business_subtype to booking_profiles — sub-classifies tradespeople
--    profiles as solo/company/cooperative/freelancer.
-- 2. upsert_trade_profile RPC — trade-specific onboarding save.
--    Intentionally does NOT touch profiles.name (profile separation rule).

ALTER TABLE booking_profiles
  ADD COLUMN IF NOT EXISTS business_subtype TEXT
    CHECK (business_subtype IS NULL
        OR business_subtype IN ('solo', 'company', 'cooperative', 'freelancer'));

CREATE OR REPLACE FUNCTION public.upsert_trade_profile(
  p_name               TEXT,
  p_business_subtype   TEXT    DEFAULT 'company',
  p_timezone           TEXT    DEFAULT 'Europe/Sarajevo',
  p_contact_channels   JSONB   DEFAULT '{}',
  p_emergency_enabled  BOOLEAN DEFAULT false,
  p_booking_profile_id UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_bp_id UUID;
  v_loc_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_business_subtype NOT IN ('solo', 'company', 'cooperative', 'freelancer') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_subtype');
  END IF;

  IF p_booking_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM booking_profiles WHERE id = p_booking_profile_id AND owner_id = v_uid
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_bp_id := p_booking_profile_id;
  ELSE
    v_bp_id := v_uid;
  END IF;

  -- Mark user as a business. Profile separation: NEVER write profiles.name.
  UPDATE profiles
  SET    is_business = true
  WHERE  id = v_uid;

  -- Update the booking profile with trade-specific fields.
  UPDATE booking_profiles
  SET    name              = trim(p_name),
         business_subtype  = p_business_subtype,
         contact_channels  = p_contact_channels,
         emergency_enabled = p_emergency_enabled,
         is_active         = true,
         updated_at        = now()
  WHERE  id = v_bp_id;

  -- Ensure owner row in staff_members.
  INSERT INTO staff_members (business_id, user_id, role, is_active)
  VALUES (v_bp_id, v_uid, 'owner', true)
  ON CONFLICT (business_id, user_id)
  DO UPDATE SET role       = 'owner',
                is_active  = true,
                updated_at = now();

  -- Create default primary location if none exists.
  SELECT id INTO v_loc_id
  FROM   business_locations
  WHERE  business_id = v_bp_id AND is_active = true
  ORDER  BY created_at
  LIMIT  1;

  IF v_loc_id IS NULL THEN
    INSERT INTO business_locations (business_id, name, timezone, is_primary, is_active)
    VALUES (v_bp_id, trim(p_name), trim(p_timezone), true, true)
    RETURNING id INTO v_loc_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'location_id', v_loc_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID)
  TO authenticated;
