-- RPC: deactivate_booking_profile
-- Deactivates all booking services and turns off is_business on the owner's profile.
-- Blocked if future pending/confirmed bookings exist.
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

  -- Disable booking_enabled on all linked service posts
  UPDATE posts
  SET booking_enabled = false
  WHERE id IN (
    SELECT post_id
    FROM service_catalog
    WHERE business_id = auth.uid() AND post_id IS NOT NULL
  );

  -- Deactivate all services
  UPDATE service_catalog
  SET is_active = false
  WHERE business_id = auth.uid();

  -- Turn off booking profile
  UPDATE profiles
  SET is_business = false
  WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_booking_profile() TO authenticated;
