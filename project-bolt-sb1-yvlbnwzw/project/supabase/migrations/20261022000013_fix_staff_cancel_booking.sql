-- Fix staff_cancel_booking:
-- 1. Allow cancelling 'pending' bookings in addition to 'confirmed'
-- 2. Store cancellation_reason, cancelled_at, cancelled_by (matching owner_cancel_booking)

CREATE OR REPLACE FUNCTION public.staff_cancel_booking(
  p_booking_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_sm_id  UUID;
  v_biz_id UUID;
  v_perms  JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_cancel_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  UPDATE bookings
  SET status              = 'cancelled',
      cancelled_at        = now(),
      cancelled_by        = v_uid,
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id          = p_booking_id
    AND business_id = v_biz_id
    AND status      IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_cancel_booking(UUID, TEXT) TO authenticated;
