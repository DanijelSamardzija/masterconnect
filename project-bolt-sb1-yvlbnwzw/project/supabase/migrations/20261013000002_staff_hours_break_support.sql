-- ============================================================
-- Staff hours break/pause support
--   set_my_staff_hours   — add p_sort_order so staff can set 2nd period
--   delete_my_staff_hour_period — self-service removal of break period
-- ============================================================

-- Drop old signature (adding parameter creates new overload, so drop first)
DROP FUNCTION IF EXISTS public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN);

CREATE OR REPLACE FUNCTION public.set_my_staff_hours(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_open_time   TIME,
  p_close_time  TIME,
  p_is_closed   BOOLEAN  DEFAULT false,
  p_sort_order  INTEGER  DEFAULT 0
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

  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_day');
  END IF;

  SELECT sm.id, sm.business_id, sm.permissions
  INTO v_sm_id, v_biz_id, v_perms
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_set_hours')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  PERFORM id FROM business_locations
  WHERE id = p_location_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'location_not_found');
  END IF;

  INSERT INTO opening_hours (
    entity_type, staff_member_id, location_id, day_of_week,
    start_time, end_time, is_closed, sort_order
  ) VALUES (
    'staff', v_sm_id, p_location_id, p_day_of_week,
    COALESCE(p_open_time,  '09:00'::TIME),
    COALESCE(p_close_time, '17:00'::TIME),
    COALESCE(p_is_closed, false),
    COALESCE(p_sort_order, 0)
  )
  ON CONFLICT (staff_member_id, location_id, day_of_week, sort_order)
  WHERE entity_type = 'staff'
  DO UPDATE SET
    start_time = COALESCE(p_open_time,  '09:00'::TIME),
    end_time   = COALESCE(p_close_time, '17:00'::TIME),
    is_closed  = COALESCE(p_is_closed, false),
    updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_staff_hours(UUID, INTEGER, TIME, TIME, BOOLEAN, INTEGER) TO authenticated;


-- ── delete_my_staff_hour_period ───────────────────────────────────────────────
-- Allows a staff member to remove their OWN extra period (break).
-- Only sort_order > 0 can be deleted (primary period is protected).

CREATE OR REPLACE FUNCTION public.delete_my_staff_hour_period(
  p_location_id UUID,
  p_day_of_week INTEGER,
  p_sort_order  INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_sm_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF COALESCE(p_sort_order, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_delete_primary_period');
  END IF;

  SELECT id INTO v_sm_id
  FROM staff_members
  WHERE user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  DELETE FROM opening_hours
  WHERE staff_member_id = v_sm_id
    AND location_id     = p_location_id
    AND day_of_week     = p_day_of_week
    AND sort_order      = p_sort_order
    AND entity_type     = 'staff';

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_staff_hour_period(UUID, INTEGER, INTEGER) TO authenticated;
