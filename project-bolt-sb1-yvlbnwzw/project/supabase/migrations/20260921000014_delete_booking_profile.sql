-- Migration 14: delete_booking_profile RPC
-- Atomically deletes a booking profile after verifying ownership and
-- confirming zero bookings reference it (RESTRICT FK makes this safe).

CREATE OR REPLACE FUNCTION public.delete_booking_profile(
  p_booking_profile_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_booking_count BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Ownership check: profile must exist and belong to the calling user
  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE id = p_booking_profile_id
      AND owner_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Block if any bookings reference this profile (past or future)
  SELECT COUNT(*) INTO v_booking_count
  FROM bookings
  WHERE business_id = p_booking_profile_id;

  IF v_booking_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'has_bookings',
      'count', v_booking_count
    );
  END IF;

  -- Atomic delete — CASCADE handles all 20 dependent tables automatically.
  -- posts.business_id stays SET NULL (preserves the post, removes booking link).
  DELETE FROM booking_profiles
  WHERE id = p_booking_profile_id
    AND owner_id = v_uid;

  -- Clear is_business on the parent profile if no active booking profiles remain
  IF NOT EXISTS (
    SELECT 1 FROM booking_profiles
    WHERE owner_id = v_uid
      AND is_active = true
  ) THEN
    UPDATE profiles SET is_business = false WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_booking_profile(UUID) TO authenticated;
