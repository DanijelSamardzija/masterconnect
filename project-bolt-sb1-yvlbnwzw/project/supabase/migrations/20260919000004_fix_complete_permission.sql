-- Fix: can_complete_bookings was missing from the update_staff_permissions whitelist.
-- Every time the owner saved permissions the key was silently dropped, resetting to false.

CREATE OR REPLACE FUNCTION public.update_staff_permissions(
  p_staff_member_id UUID,
  p_permissions     JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_role   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id INTO v_biz_id
  FROM staff_members
  WHERE id = p_staff_member_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  IF v_uid = v_biz_id THEN
    v_role := 'owner';
  ELSE
    SELECT role INTO v_role
    FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid AND is_active = true
    LIMIT 1;
  END IF;

  IF v_role NOT IN ('owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  p_permissions := jsonb_build_object(
    'can_set_hours',            COALESCE((p_permissions->>'can_set_hours')::boolean,            false),
    'can_create_bookings',      COALESCE((p_permissions->>'can_create_bookings')::boolean,      false),
    'can_cancel_bookings',      COALESCE((p_permissions->>'can_cancel_bookings')::boolean,      false),
    'can_block_time',           COALESCE((p_permissions->>'can_block_time')::boolean,           false),
    'can_reschedule_bookings',  COALESCE((p_permissions->>'can_reschedule_bookings')::boolean,  false),
    'can_complete_bookings',    COALESCE((p_permissions->>'can_complete_bookings')::boolean,    false)
  );

  UPDATE staff_members
  SET permissions = p_permissions, updated_at = now()
  WHERE id = p_staff_member_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_permissions(UUID, JSONB) TO authenticated;
