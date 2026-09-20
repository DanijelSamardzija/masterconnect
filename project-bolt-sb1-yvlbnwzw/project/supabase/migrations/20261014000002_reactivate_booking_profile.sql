-- Track which services were deactivated by profile-level deactivation (vs manually by the owner).
-- This allows reactivate_booking_profile to restore only the services it turned off,
-- leaving services the owner had already manually deactivated untouched.
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS deactivated_by_profile BOOL NOT NULL DEFAULT false;

-- Update deactivate_booking_profile to stamp the flag only on currently-active services,
-- and use a CTE so the posts update targets exactly the same rows.
CREATE OR REPLACE FUNCTION deactivate_booking_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_future_count INT;
BEGIN
  SELECT COUNT(*) INTO v_future_count
  FROM bookings
  WHERE business_id = auth.uid()
    AND status IN ('pending', 'confirmed')
    AND starts_at > NOW();

  IF v_future_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'has_active_bookings', 'count', v_future_count);
  END IF;

  -- Deactivate only currently-active services and stamp the flag.
  -- Services already inactive (manually by owner) are not touched.
  WITH stamped AS (
    UPDATE service_catalog
    SET is_active = false, deactivated_by_profile = true
    WHERE business_id = auth.uid() AND is_active = true
    RETURNING post_id
  )
  UPDATE posts
  SET booking_enabled = false
  WHERE id IN (SELECT post_id FROM stamped WHERE post_id IS NOT NULL);

  UPDATE profiles
  SET is_business = false
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Reactivate only services that were deactivated by deactivate_booking_profile.
-- Services the owner manually deactivated (deactivated_by_profile = false) are never touched.
-- If a linked post was deleted in the meantime (post_id → NULL via ON DELETE SET NULL),
-- it is naturally excluded from the posts update.
CREATE OR REPLACE FUNCTION reactivate_booking_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH restored AS (
    UPDATE service_catalog
    SET is_active = true, deactivated_by_profile = false
    WHERE business_id = auth.uid() AND deactivated_by_profile = true
    RETURNING post_id
  )
  UPDATE posts
  SET booking_enabled = true
  WHERE id IN (SELECT post_id FROM restored WHERE post_id IS NOT NULL);

  UPDATE profiles
  SET is_business = true
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION reactivate_booking_profile() TO authenticated;
