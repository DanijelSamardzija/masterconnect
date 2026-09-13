-- Add overlap check to owner_reassign_booking:
-- prevent assigning a staff member who already has a confirmed/pending booking
-- at the same time as the booking being reassigned.

CREATE OR REPLACE FUNCTION public.owner_reassign_booking(
  p_booking_id      UUID,
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_role   TEXT;
  v_biz_id UUID;
  v_conflict INT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM bookings WHERE id = p_booking_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  SELECT role INTO v_role
  FROM staff_members
  WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Check that the target staff member has no overlapping active booking
  SELECT COUNT(*) INTO v_conflict
  FROM bookings b2
  JOIN bookings b1 ON b1.id = p_booking_id
  WHERE b2.staff_member_id = p_staff_member_id
    AND b2.id              != p_booking_id
    AND b2.status          IN ('pending', 'confirmed')
    AND b2.starts_at        < (b1.starts_at + (b1.duration_minutes * interval '1 minute'))
    AND b2.ends_at          > b1.starts_at;

  IF v_conflict > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  UPDATE bookings
  SET staff_member_id = p_staff_member_id,
      updated_at      = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reassign_booking(UUID, UUID) TO authenticated;
