-- Per-staff week copy: copies one staff member's shifts from one week to another.
-- Unlike owner_copy_week_shifts (which copies all staff at once), this lets the
-- owner copy a single staff member's schedule independently.
-- Also copies off_reason, break_start, break_end and is_template_generated,
-- which owner_copy_week_shifts was missing.

CREATE OR REPLACE FUNCTION public.owner_copy_staff_week_shifts(
  p_staff_member_id UUID,
  p_from_week_start DATE,
  p_to_week_start   DATE
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
  v_count  INTEGER;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  -- Verify staff belongs to this business
  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Clear target week for this staff member only
  DELETE FROM staff_shifts
  WHERE staff_member_id = p_staff_member_id
    AND shift_date >= p_to_week_start
    AND shift_date <  p_to_week_start + 7;

  -- Copy from source week, preserving all fields
  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, off_reason, notes,
    break_start, break_end, is_template_generated, created_by
  )
  SELECT
    business_id, staff_member_id, location_id,
    p_to_week_start + (shift_date - p_from_week_start),
    start_time, end_time, is_off, off_reason, notes,
    break_start, break_end, is_template_generated, v_uid
  FROM staff_shifts
  WHERE staff_member_id = p_staff_member_id
    AND shift_date >= p_from_week_start
    AND shift_date <  p_from_week_start + 7;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'copied', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_copy_staff_week_shifts(UUID, DATE, DATE) TO authenticated;
