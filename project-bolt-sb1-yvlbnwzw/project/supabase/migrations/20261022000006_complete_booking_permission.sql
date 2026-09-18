-- ==========================================================================
-- complete_booking() — enforce can_complete_bookings for workers
--
-- Previous version: any active staff member of the business could complete.
-- New version:
--   • owner / manager role → always allowed
--   • worker role         → requires permissions->>'can_complete_bookings' = true
-- Also adds the same "must have already started" guard for 'completed' that
-- already existed for 'no_show'.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.complete_booking(
  p_booking_id UUID,
  p_status     TEXT DEFAULT 'completed'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_bk        RECORD;
  v_sm        RECORD;
BEGIN
  -- 1. Auth
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- 2. Validate status
  IF p_status NOT IN ('completed', 'no_show') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  -- 3. Load booking
  SELECT b.id, b.status, b.business_id, b.starts_at
  INTO   v_bk
  FROM   bookings b
  WHERE  b.id = p_booking_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- 4. Authorization: load caller's staff_member record
  SELECT sm.role, sm.permissions
  INTO   v_sm
  FROM   staff_members sm
  WHERE  sm.business_id = v_bk.business_id
    AND  sm.user_id     = v_caller_id
    AND  sm.is_active   = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Owners/managers always allowed; workers need can_complete_bookings
  IF v_sm.role NOT IN ('owner', 'manager') THEN
    IF NOT COALESCE((v_sm.permissions->>'can_complete_bookings')::boolean, false) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
  END IF;

  -- 5. Must be confirmed
  IF v_bk.status <> 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_confirmed');
  END IF;

  -- 6. Appointment must have already started (applies to both completed and no_show)
  IF v_bk.starts_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_started');
  END IF;

  -- 7. Update (F4 trigger fires → notifies client)
  UPDATE bookings
  SET    status     = p_status,
         updated_at = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_booking(UUID, TEXT) TO authenticated;
