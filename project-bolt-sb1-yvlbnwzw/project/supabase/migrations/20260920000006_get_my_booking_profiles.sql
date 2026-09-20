-- ==========================================================================
-- Migration 6 of 6: get_my_booking_profiles() RPC
--
-- Returns all booking profiles owned by the calling user, with
-- per-profile aggregate counts needed for the Booking hub UI:
--   location_count  — active business_locations
--   service_count   — active service_catalog entries
--   unit_count      — active accommodation_units
--
-- Returns JSONB: { ok: true, profiles: [...] }
--   Profile shape: id, profile_type, name, avatar_url, is_active,
--                  location_count, service_count, unit_count, created_at
--
-- Ordered: active profiles first, then by created_at ASC (oldest = primary).
-- Returns empty array (not error) when the caller has no profiles yet.
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
            'id',             bp.id,
            'profile_type',   bp.profile_type,
            'name',           bp.name,
            'avatar_url',     bp.avatar_url,
            'is_active',      bp.is_active,
            'created_at',     bp.created_at,
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
