-- ==========================================================================
-- Migration 13: Add onboarding_done flag to booking_profiles
--
-- Tracks whether the business owner has explicitly finished the onboarding
-- wizard. Pressing browser Back mid-wizard leaves onboarding_done = false,
-- allowing the hub to detect incomplete profiles and redirect back.
--
-- Existing profiles (migrated from old system) are all considered done.
-- New profiles created via create_booking_profile start with false (default).
-- ==========================================================================

ALTER TABLE public.booking_profiles
  ADD COLUMN IF NOT EXISTS onboarding_done BOOL NOT NULL DEFAULT false;

-- All pre-existing profiles are already set up
UPDATE public.booking_profiles SET onboarding_done = true;

-- ==========================================================================
-- Refresh get_my_booking_profiles to include onboarding_done
-- ==========================================================================

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
            'id',              bp.id,
            'profile_type',    bp.profile_type,
            'name',            bp.name,
            'avatar_url',      bp.avatar_url,
            'is_active',       bp.is_active,
            'onboarding_done', bp.onboarding_done,
            'created_at',      bp.created_at,
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
