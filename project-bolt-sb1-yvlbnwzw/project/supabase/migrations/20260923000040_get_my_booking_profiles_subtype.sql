-- Migration 040: Add business_subtype to get_my_booking_profiles
--
-- Needed so the Booking hub card can display the trade profile subtype
-- (solo / company / cooperative / freelancer) without an extra fetch.

CREATE OR REPLACE FUNCTION public.get_my_booking_profiles()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'profiles', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',               bp.id,
            'profile_type',     bp.profile_type,
            'name',             bp.name,
            'avatar_url',       bp.avatar_url,
            'is_active',        bp.is_active,
            'onboarding_done',  bp.onboarding_done,
            'business_subtype', bp.business_subtype,
            'created_at',       bp.created_at,
            'location_count', (
              SELECT COUNT(*)
              FROM business_locations bl
              WHERE bl.business_id = bp.id AND bl.is_active = true
            ),
            'service_count', (
              SELECT COUNT(*)
              FROM service_catalog sc
              WHERE sc.business_id = bp.id AND sc.is_active = true
            ),
            'unit_count', (
              SELECT COUNT(*)
              FROM accommodation_units au
              WHERE au.business_id = bp.id AND au.is_active = true
            )
          )
          ORDER BY bp.is_active DESC, bp.created_at ASC
        )
        FROM booking_profiles bp
        WHERE bp.owner_id = v_uid
      ),
      '[]'::jsonb
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_booking_profiles() TO authenticated;
