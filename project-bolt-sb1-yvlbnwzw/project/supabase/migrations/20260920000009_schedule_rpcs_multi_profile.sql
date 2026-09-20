-- ==========================================================================
-- Migration 9: Add p_business_id to schedule RPCs
--
-- Problem: owner_get_week_shifts, owner_set_shift and
--          owner_copy_staff_week_shifts all resolve v_biz_id with:
--
--              SELECT business_id FROM staff_members
--              WHERE user_id = auth.uid() ... LIMIT 1
--
--          LIMIT 1 without a business filter returns whichever profile
--          happens to be stored first. For a user who owns multiple booking
--          profiles this silently shows / mutates the wrong profile.
--
-- Fix: add p_business_id UUID DEFAULT NULL to all three.
--   • NULL  → original LIMIT 1 lookup (backward-compat, primary profiles)
--   • non-NULL → verify caller is owner/manager of that profile, use it
--
-- Strategy: CREATE OR REPLACE with a new (extra) parameter creates a new
-- PostgreSQL overload alongside the existing 1-param / 3-param / 9-param
-- versions; old callers keep working unchanged. Only new multi-profile
-- callers that pass p_business_id hit the new overloads.
-- ==========================================================================


-- ── 1. owner_get_week_shifts ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_get_week_shifts(
  p_week_start  DATE,
  p_business_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  IF p_business_id IS NULL THEN
    -- Backward-compat: pick first business where caller is owner/manager
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
  ELSE
    -- Multi-profile: verify caller is owner/manager of the specific profile
    PERFORM 1 FROM staff_members
    WHERE business_id = p_business_id AND user_id = v_uid
      AND is_active   = true AND role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;
    v_biz_id := p_business_id;
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'staff_member_id', sm.id,
          'staff_name',      p.name,
          'shifts', COALESCE(
            (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'shift_date',            ss.shift_date::TEXT,
                  'start_time',            ss.start_time::TEXT,
                  'end_time',              ss.end_time::TEXT,
                  'is_off',                ss.is_off,
                  'off_reason',            ss.off_reason,
                  'notes',                 ss.notes,
                  'break_start',           ss.break_start::TEXT,
                  'break_end',             ss.break_end::TEXT,
                  'is_template_generated', ss.is_template_generated
                )
                ORDER BY ss.shift_date
              )
              FROM staff_shifts ss
              WHERE ss.staff_member_id = sm.id
                AND ss.shift_date >= p_week_start
                AND ss.shift_date <  p_week_start + 7
            ),
            '[]'::jsonb
          )
        )
        ORDER BY p.name
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id = v_biz_id
        AND sm.is_active   = true
        AND sm.role IN ('worker', 'manager', 'owner')
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_week_shifts(DATE, UUID) TO authenticated;


-- ── 2. owner_set_shift ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_set_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE,
  p_start_time      TIME    DEFAULT NULL,
  p_end_time        TIME    DEFAULT NULL,
  p_is_off          BOOLEAN DEFAULT false,
  p_off_reason      TEXT    DEFAULT NULL,
  p_notes           TEXT    DEFAULT NULL,
  p_break_start     TIME    DEFAULT NULL,
  p_break_end       TIME    DEFAULT NULL,
  p_business_id     UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_biz_id     UUID;
  v_loc_id     UUID;
  v_off_reason TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_business_id IS NULL THEN
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
    END IF;
  ELSE
    PERFORM 1 FROM staff_members
    WHERE business_id = p_business_id AND user_id = v_uid
      AND is_active   = true AND role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_biz_id := p_business_id;
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  SELECT primary_location_id INTO v_loc_id
  FROM staff_members WHERE id = p_staff_member_id;

  v_off_reason := CASE
    WHEN COALESCE(p_is_off, false) THEN
      CASE WHEN p_off_reason IN ('day_off', 'vacation', 'sick_leave')
           THEN p_off_reason
           ELSE 'day_off'
      END
    ELSE NULL
  END;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, off_reason, notes, break_start, break_end, created_by
  ) VALUES (
    v_biz_id, p_staff_member_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), v_off_reason,
    p_notes, p_break_start, p_break_end, v_uid
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time  = p_start_time,
    end_time    = p_end_time,
    is_off      = COALESCE(p_is_off, false),
    off_reason  = v_off_reason,
    notes       = p_notes,
    break_start = p_break_start,
    break_end   = p_break_end,
    created_by  = v_uid,
    updated_at  = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_shift(UUID, DATE, TIME, TIME, BOOLEAN, TEXT, TEXT, TIME, TIME, UUID) TO authenticated;


-- ── 3. owner_copy_staff_week_shifts ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_copy_staff_week_shifts(
  p_staff_member_id UUID,
  p_from_week_start DATE,
  p_to_week_start   DATE,
  p_business_id     UUID DEFAULT NULL
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

  IF p_business_id IS NULL THEN
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
    END IF;
  ELSE
    PERFORM 1 FROM staff_members
    WHERE business_id = p_business_id AND user_id = v_uid
      AND is_active   = true AND role IN ('owner', 'manager')
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
    END IF;
    v_biz_id := p_business_id;
  END IF;

  -- Verify the staff member belongs to this business
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

GRANT EXECUTE ON FUNCTION public.owner_copy_staff_week_shifts(UUID, DATE, DATE, UUID) TO authenticated;
