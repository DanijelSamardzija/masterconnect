-- Migration 039: Fix upsert_trade_profile ambiguity
--
-- If migration 019 (6-param) was applied but migration 027 (which drops it)
-- was not, the live DB ends up with BOTH a 6-param and an 8-param overload of
-- upsert_trade_profile.  PostgREST cannot resolve the ambiguity and returns
-- HTTP 400 on every RPC call.
--
-- Fix: unconditionally drop ALL known overloads, then recreate the single
-- canonical 8-param version (same body as migration 036).

DROP FUNCTION IF EXISTS public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS public.upsert_trade_profile(TEXT, TEXT, TEXT, JSONB, BOOLEAN, UUID, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.upsert_trade_profile(
  p_name                TEXT,
  p_business_subtype    TEXT    DEFAULT NULL,
  p_timezone            TEXT    DEFAULT NULL,
  p_contact_channels    JSONB   DEFAULT NULL,
  p_emergency_enabled   BOOLEAN DEFAULT NULL,
  p_booking_profile_id  UUID    DEFAULT NULL,
  p_description         TEXT    DEFAULT NULL,
  p_service_area_cities TEXT[]  DEFAULT '{}'
)
RETURNS JSONB
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

  -- Resolve target booking_profile
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
    WHERE owner_id    = v_user_id
      AND profile_type = 'tradespeople'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    -- Create new trade profile — use sensible defaults for INSERT
    INSERT INTO booking_profiles (
      owner_id, profile_type, name, business_subtype,
      timezone, contact_channels, emergency_enabled,
      description, service_area_cities
    )
    VALUES (
      v_user_id, 'tradespeople', p_name,
      COALESCE(p_business_subtype, 'company'),
      COALESCE(p_timezone, 'Europe/Sarajevo'),
      COALESCE(p_contact_channels, '{}'),
      COALESCE(p_emergency_enabled, false),
      p_description, p_service_area_cities
    )
    RETURNING id INTO v_profile_id;
  ELSE
    -- Update existing — preserve each field when caller doesn't pass it
    UPDATE booking_profiles
    SET
      name                = p_name,
      business_subtype    = COALESCE(p_business_subtype,  business_subtype),
      timezone            = COALESCE(p_timezone,           timezone),
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

REVOKE EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT,TEXT,TEXT,JSONB,BOOLEAN,UUID,TEXT,TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.upsert_trade_profile(TEXT,TEXT,TEXT,JSONB,BOOLEAN,UUID,TEXT,TEXT[]) TO authenticated;
