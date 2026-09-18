-- staff_reschedule_booking: lets a staff member move a booking assigned to them,
-- provided they have the can_reschedule_bookings permission.

CREATE OR REPLACE FUNCTION public.staff_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_sm_id       UUID;
  v_biz_id      UUID;
  v_perms       JSONB;
  v_old_start   TIMESTAMPTZ;
  v_old_end     TIMESTAMPTZ;
  v_new_end     TIMESTAMPTZ;
  v_duration_iv INTERVAL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.permissions
  INTO   v_sm_id, v_biz_id, v_perms
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_reschedule_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT starts_at, ends_at
  INTO   v_old_start, v_old_end
  FROM   bookings
  WHERE  id              = p_booking_id
    AND  business_id     = v_biz_id
    AND  staff_member_id = v_sm_id
    AND  status          IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF p_new_starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_in_past');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  -- Staff conflict check (excluding the booking being moved)
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE  b.staff_member_id = v_sm_id
      AND  b.status          IN ('pending', 'confirmed')
      AND  b.id              <> p_booking_id
      AND  p_new_starts_at   < b.ends_at
      AND  v_new_end         > b.starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  UPDATE bookings
  SET    starts_at  = p_new_starts_at,
         ends_at    = v_new_end,
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;
