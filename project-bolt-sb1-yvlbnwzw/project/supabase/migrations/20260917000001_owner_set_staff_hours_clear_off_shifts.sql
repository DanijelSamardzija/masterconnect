-- ============================================================
-- Update owner_set_staff_hours:
-- When owner marks a day as WORKING in the template, delete any
-- explicit is_off=true staff_shifts for that staff member on that
-- day of week going forward (future dates only). This ensures
-- "last write wins" — owner setting template clears stale off-overrides.
-- ============================================================

CREATE OR REPLACE FUNCTION public.owner_set_staff_hours(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_day_of_week     INTEGER,
  p_open_time       TIME,
  p_close_time      TIME,
  p_is_closed       BOOLEAN DEFAULT false,
  p_sort_order      INTEGER DEFAULT 0,
  p_month           SMALLINT DEFAULT 0
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

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  -- Upsert the template hour row
  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order, month
  ) VALUES (
    'staff', p_staff_member_id, p_location_id, p_day_of_week,
    COALESCE(p_open_time,  '09:00'::TIME),
    COALESCE(p_close_time, '17:00'::TIME),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0),
    COALESCE(p_month, 0)
  )
  ON CONFLICT (staff_member_id, location_id, day_of_week, sort_order, month)
  WHERE entity_type = 'staff'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'::TIME),
    end_time   = COALESCE(p_close_time, '17:00'::TIME),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  -- If setting the day as WORKING in the template, clear any stale
  -- is_off=true overrides for this worker on this day of week (today onwards).
  -- "Last write wins" — template save overrides old explicit off entries.
  IF NOT COALESCE(p_is_closed, false) AND COALESCE(p_sort_order, 0) = 0 THEN
    DELETE FROM staff_shifts
    WHERE staff_member_id = p_staff_member_id
      AND is_off = true
      AND EXTRACT(dow FROM shift_date)::INTEGER = p_day_of_week
      AND shift_date >= CURRENT_DATE;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_staff_hours(UUID, UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER, SMALLINT) TO authenticated;
