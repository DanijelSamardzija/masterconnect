-- ==========================================================================
-- 1. Restore CASE/WHEN fix to public_get_staff_absences
--    Migration 20261021000020 added timezone fix but dropped the
--    CASE/WHEN logic from 20261021000009. This restores both.
--
-- 2. Add p_off_reason to owner_set_shift so the schedule modal can record
--    vacation / sick_leave / day_off reasons on individual shift overrides.
-- ==========================================================================

-- ── 1. public_get_staff_absences ──────────────────────────────────────────────
-- Combines the CASE/WHEN date fix (20261021000009) with the per-staff-location
-- timezone fix (20261021000020).

CREATE OR REPLACE FUNCTION public.public_get_staff_absences(
  p_staff_member_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'reason',    tb.reason,
        'note',      tb.note,
        'date_from', (tb.starts_at AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::DATE,
        'date_to',   CASE
                       WHEN (tb.ends_at AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::TIME = TIME '00:00:00'
                       THEN (tb.ends_at AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::DATE - 1
                       ELSE (tb.ends_at AT TIME ZONE COALESCE(bl_asgn.timezone, bl_prim.timezone))::DATE
                     END
      )
      ORDER BY tb.starts_at ASC
    ),
    '[]'::jsonb
  )
  FROM   time_blocks tb
  JOIN   staff_members sm       ON sm.id = tb.staff_member_id
  LEFT JOIN business_locations bl_asgn ON bl_asgn.id = sm.primary_location_id
                                       AND bl_asgn.is_active = true
  JOIN      business_locations bl_prim ON bl_prim.business_id = sm.business_id
                                       AND bl_prim.is_primary = true
  WHERE  tb.staff_member_id = p_staff_member_id
    AND  tb.entity_type     = 'staff'
    AND  tb.ends_at         > now();
$$;

GRANT EXECUTE ON FUNCTION public.public_get_staff_absences(UUID) TO anon, authenticated;


-- ── 2. owner_set_shift — add p_off_reason ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_set_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE,
  p_start_time      TIME    DEFAULT NULL,
  p_end_time        TIME    DEFAULT NULL,
  p_is_off          BOOLEAN DEFAULT false,
  p_off_reason      TEXT    DEFAULT NULL,
  p_notes           TEXT    DEFAULT NULL,
  p_break_start     TIME    DEFAULT NULL,
  p_break_end       TIME    DEFAULT NULL
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

  SELECT primary_location_id INTO v_loc_id
  FROM staff_members WHERE id = p_staff_member_id;

  -- Validate and store off_reason only when day is off
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

GRANT EXECUTE ON FUNCTION public.owner_set_shift(UUID, DATE, TIME, TIME, BOOLEAN, TEXT, TEXT, TIME, TIME) TO authenticated;
