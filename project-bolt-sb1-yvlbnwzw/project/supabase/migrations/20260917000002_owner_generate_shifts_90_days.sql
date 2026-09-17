-- ============================================================
-- owner_generate_shifts_90_days
--
-- When an owner saves a staff member's weekly schedule in
-- Setup/Osoblje, convert the opening_hours template into
-- concrete staff_shifts records for the next 90 days.
-- "Last write wins" — owner save overwrites any existing shifts
-- for matching dates (upsert).
--
-- Also includes a one-time backfill that generates shifts for
-- all existing workers from their current templates, using
-- DO NOTHING to preserve any explicit shifts already set.
-- ============================================================

CREATE OR REPLACE FUNCTION public.owner_generate_shifts_90_days(
  p_staff_member_id UUID,
  p_location_id     UUID
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

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Upsert: generate concrete shifts for the next 90 days from the opening_hours
  -- template. Overwrites existing shifts for those dates (last write wins).
  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, break_start, break_end, created_by
  )
  SELECT
    v_biz_id,
    p_staff_member_id,
    p_location_id,
    d::date,
    CASE WHEN oh0.is_closed THEN NULL ELSE oh0.start_time END,
    CASE WHEN oh0.is_closed THEN NULL
         ELSE COALESCE(oh1.end_time, oh0.end_time) END,
    oh0.is_closed,
    -- break_start = end of first period when a break segment exists
    CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh0.end_time ELSE NULL END,
    -- break_end = start of second period
    CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh1.start_time ELSE NULL END,
    v_uid
  FROM opening_hours oh0
  LEFT JOIN opening_hours oh1
         ON oh1.staff_member_id = oh0.staff_member_id
        AND oh1.location_id     = oh0.location_id
        AND oh1.day_of_week     = oh0.day_of_week
        AND oh1.sort_order      = 1
        AND oh1.entity_type     = 'staff'
        AND oh1.month           = 0
  CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 90, '1 day'::interval) AS d
  WHERE oh0.entity_type     = 'staff'
    AND oh0.staff_member_id = p_staff_member_id
    AND oh0.location_id     = p_location_id
    AND oh0.sort_order      = 0
    AND oh0.month           = 0
    AND EXTRACT(dow FROM d)::integer = oh0.day_of_week
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time  = EXCLUDED.start_time,
    end_time    = EXCLUDED.end_time,
    is_off      = EXCLUDED.is_off,
    break_start = EXCLUDED.break_start,
    break_end   = EXCLUDED.break_end,
    updated_at  = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'generated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_generate_shifts_90_days(UUID, UUID) TO authenticated;


-- ── One-time backfill ─────────────────────────────────────────────────────────
-- Generate shifts for all existing workers from their current templates.
-- Uses DO NOTHING to preserve any shifts already set explicitly by owners/workers.

INSERT INTO staff_shifts (
  business_id, staff_member_id, location_id, shift_date,
  start_time, end_time, is_off, break_start, break_end
)
SELECT
  sm.business_id,
  oh0.staff_member_id,
  oh0.location_id,
  d::date,
  CASE WHEN oh0.is_closed THEN NULL ELSE oh0.start_time END,
  CASE WHEN oh0.is_closed THEN NULL
       ELSE COALESCE(oh1.end_time, oh0.end_time) END,
  oh0.is_closed,
  CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh0.end_time ELSE NULL END,
  CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh1.start_time ELSE NULL END
FROM opening_hours oh0
JOIN staff_members sm ON sm.id = oh0.staff_member_id AND sm.is_active = true
LEFT JOIN opening_hours oh1
       ON oh1.staff_member_id = oh0.staff_member_id
      AND oh1.location_id     = oh0.location_id
      AND oh1.day_of_week     = oh0.day_of_week
      AND oh1.sort_order      = 1
      AND oh1.entity_type     = 'staff'
      AND oh1.month           = 0
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 90, '1 day'::interval) AS d
WHERE oh0.entity_type = 'staff'
  AND oh0.sort_order  = 0
  AND oh0.month       = 0
  AND EXTRACT(dow FROM d)::integer = oh0.day_of_week
ON CONFLICT (staff_member_id, shift_date)
DO NOTHING;
