-- Add p_off_reason to staff_set_my_shift so workers can set Slobodan/Godisnji/Bolovanje
CREATE OR REPLACE FUNCTION public.staff_set_my_shift(
  p_shift_date  DATE,
  p_start_time  TIME    DEFAULT NULL,
  p_end_time    TIME    DEFAULT NULL,
  p_is_off      BOOLEAN DEFAULT false,
  p_notes       TEXT    DEFAULT NULL,
  p_break_start TIME    DEFAULT NULL,
  p_break_end   TIME    DEFAULT NULL,
  p_off_reason  TEXT    DEFAULT 'day_off'
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_sm_id  UUID;
  v_biz_id UUID;
  v_loc_id UUID;
  v_perms  JSONB;
  v_off_reason TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.primary_location_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_loc_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_set_hours')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  -- Only store off_reason when day is off; validate value
  v_off_reason := CASE
    WHEN COALESCE(p_is_off, false) THEN
      CASE WHEN p_off_reason IN ('day_off','vacation','sick_leave') THEN p_off_reason ELSE 'day_off' END
    ELSE NULL
  END;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, off_reason, notes, break_start, break_end,
    is_template_generated, created_by
  ) VALUES (
    v_biz_id, v_sm_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), v_off_reason, p_notes,
    p_break_start, p_break_end, FALSE, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time            = p_start_time,
    end_time              = p_end_time,
    is_off                = COALESCE(p_is_off, false),
    off_reason            = v_off_reason,
    notes                 = p_notes,
    break_start           = p_break_start,
    break_end             = p_break_end,
    is_template_generated = FALSE,
    updated_at            = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_my_shift(DATE, TIME, TIME, BOOLEAN, TEXT, TIME, TIME, TEXT) TO authenticated;
