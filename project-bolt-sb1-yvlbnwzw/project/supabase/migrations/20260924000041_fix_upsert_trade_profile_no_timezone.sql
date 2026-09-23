-- Migration 041: Fix upsert_trade_profile — remove non-existent timezone column
-- booking_profiles has no timezone column; timezone lives on business_locations.
-- p_timezone param is kept for API compatibility but not stored on the profile.

DROP FUNCTION IF EXISTS public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.upsert_trade_profile(
  p_name                TEXT,
  p_business_subtype    TEXT     DEFAULT NULL,
  p_timezone            TEXT     DEFAULT NULL,
  p_contact_channels    JSONB    DEFAULT NULL,
  p_emergency_enabled   BOOLEAN  DEFAULT NULL,
  p_booking_profile_id  UUID     DEFAULT NULL,
  p_description         TEXT     DEFAULT NULL,
  p_service_area_cities TEXT[]   DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_profile_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  p_name := TRIM(p_name);
  IF p_name = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name_required');
  END IF;

  IF p_booking_profile_id IS NOT NULL THEN
    SELECT id INTO v_profile_id
    FROM booking_profiles
    WHERE id = p_booking_profile_id
      AND owner_id = v_user_id
      AND profile_type = 'tradespeople';
    IF v_profile_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_found');
    END IF;
  ELSE
    SELECT id INTO v_profile_id
    FROM booking_profiles
    WHERE owner_id     = v_user_id
      AND profile_type = 'tradespeople'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    INSERT INTO booking_profiles (
      owner_id, profile_type, name, business_subtype,
      contact_channels, emergency_enabled,
      description, service_area_cities
    )
    VALUES (
      v_user_id, 'tradespeople', p_name,
      COALESCE(p_business_subtype, 'company'),
      COALESCE(p_contact_channels, '{}'),
      COALESCE(p_emergency_enabled, false),
      p_description, p_service_area_cities
    )
    RETURNING id INTO v_profile_id;
  ELSE
    UPDATE booking_profiles
    SET
      name                = p_name,
      business_subtype    = COALESCE(p_business_subtype,  business_subtype),
      contact_channels    = COALESCE(p_contact_channels,  contact_channels),
      emergency_enabled   = COALESCE(p_emergency_enabled, emergency_enabled),
      description         = p_description,
      service_area_cities = p_service_area_cities,
      updated_at          = now()
    WHERE id = v_profile_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'profile_id', v_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID, TEXT, TEXT[]) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
