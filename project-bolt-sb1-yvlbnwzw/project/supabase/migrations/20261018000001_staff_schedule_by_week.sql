-- ============================================================
-- Staff Schedule by Week
--
-- Replaces the month-based opening_hours template system with
-- a direct week-by-week staff_shifts approach.
--
-- 1.  ALTER TABLE staff_shifts    — add is_template_generated
-- 2.  owner_generate_shifts_90_days  — set TRUE
-- 3.  owner_set_shift             — set FALSE explicitly
-- 4.  staff_set_my_shift          — set FALSE explicitly
-- 5.  owner_copy_week_shifts      — set FALSE on copies
-- 6.  owner_get_week_shifts       — include flag in output
-- 7.  staff_get_my_shifts         — include flag in output
-- 8.  NEW owner_save_week_schedule
-- 9.  NEW owner_get_staff_shifts_range
-- ============================================================

-- ── 1. Add column ─────────────────────────────────────────────────────────────
ALTER TABLE public.staff_shifts
  ADD COLUMN IF NOT EXISTS is_template_generated BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows: leave as FALSE (treated as explicit — safe conservative default).


-- ── 2. owner_generate_shifts_90_days — mark as template ──────────────────────
CREATE OR REPLACE FUNCTION public.owner_generate_shifts_90_days(
  p_staff_member_id UUID,
  p_location_id     UUID
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
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

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, break_start, break_end,
    is_template_generated, created_by
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
    CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh0.end_time ELSE NULL END,
    CASE WHEN NOT oh0.is_closed AND oh1.start_time IS NOT NULL THEN oh1.start_time ELSE NULL END,
    TRUE,  -- template-generated
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
    start_time            = EXCLUDED.start_time,
    end_time              = EXCLUDED.end_time,
    is_off                = EXCLUDED.is_off,
    break_start           = EXCLUDED.break_start,
    break_end             = EXCLUDED.break_end,
    is_template_generated = TRUE,
    updated_at            = now()
  WHERE staff_shifts.is_template_generated = TRUE;  -- never overwrite explicit entries

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'generated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_generate_shifts_90_days(UUID, UUID) TO authenticated;


-- ── 3. owner_set_shift — mark as explicit ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_shift(
  p_staff_member_id UUID,
  p_shift_date      DATE,
  p_start_time      TIME    DEFAULT NULL,
  p_end_time        TIME    DEFAULT NULL,
  p_is_off          BOOLEAN DEFAULT false,
  p_notes           TEXT    DEFAULT NULL,
  p_break_start     TIME    DEFAULT NULL,
  p_break_end       TIME    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_loc_id UUID;
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

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end,
    is_template_generated, created_by
  ) VALUES (
    v_biz_id, p_staff_member_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes,
    p_break_start, p_break_end, FALSE, v_uid  -- explicit
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time            = p_start_time,
    end_time              = p_end_time,
    is_off                = COALESCE(p_is_off, false),
    notes                 = p_notes,
    break_start           = p_break_start,
    break_end             = p_break_end,
    is_template_generated = FALSE,  -- explicit
    created_by            = v_uid,
    updated_at            = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_set_shift(UUID, DATE, TIME, TIME, BOOLEAN, TEXT, TIME, TIME) TO authenticated;


-- ── 4. staff_set_my_shift — mark as explicit ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_set_my_shift(
  p_shift_date  DATE,
  p_start_time  TIME    DEFAULT NULL,
  p_end_time    TIME    DEFAULT NULL,
  p_is_off      BOOLEAN DEFAULT false,
  p_notes       TEXT    DEFAULT NULL,
  p_break_start TIME    DEFAULT NULL,
  p_break_end   TIME    DEFAULT NULL
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

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end,
    is_template_generated, created_by
  ) VALUES (
    v_biz_id, v_sm_id, v_loc_id, p_shift_date,
    p_start_time, p_end_time, COALESCE(p_is_off, false), p_notes,
    p_break_start, p_break_end, FALSE, v_uid  -- explicit
  )
  ON CONFLICT (staff_member_id, shift_date)
  DO UPDATE SET
    start_time            = p_start_time,
    end_time              = p_end_time,
    is_off                = COALESCE(p_is_off, false),
    notes                 = p_notes,
    break_start           = p_break_start,
    break_end             = p_break_end,
    is_template_generated = FALSE,  -- explicit
    updated_at            = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_set_my_shift(DATE, TIME, TIME, BOOLEAN, TEXT, TIME, TIME) TO authenticated;


-- ── 5. owner_copy_week_shifts — copied shifts are explicit ───────────────────
CREATE OR REPLACE FUNCTION public.owner_copy_week_shifts(
  p_from_week_start DATE,
  p_to_week_start   DATE
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
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

  DELETE FROM staff_shifts
  WHERE business_id = v_biz_id
    AND shift_date >= p_to_week_start
    AND shift_date <  p_to_week_start + 7;

  INSERT INTO staff_shifts (
    business_id, staff_member_id, location_id, shift_date,
    start_time, end_time, is_off, notes, break_start, break_end,
    is_template_generated, created_by
  )
  SELECT
    business_id, staff_member_id, location_id,
    p_to_week_start + (shift_date - p_from_week_start),
    start_time, end_time, is_off, notes, break_start, break_end,
    FALSE, v_uid  -- copied = explicit
  FROM staff_shifts
  WHERE business_id = v_biz_id
    AND shift_date >= p_from_week_start
    AND shift_date <  p_from_week_start + 7;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'copied', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_copy_week_shifts(DATE, DATE) TO authenticated;


-- ── 6. owner_get_week_shifts — include is_template_generated ─────────────────
CREATE OR REPLACE FUNCTION public.owner_get_week_shifts(
  p_week_start DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

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
                  'shift_date',           ss.shift_date::TEXT,
                  'start_time',           ss.start_time::TEXT,
                  'end_time',             ss.end_time::TEXT,
                  'is_off',               ss.is_off,
                  'notes',                ss.notes,
                  'break_start',          ss.break_start::TEXT,
                  'break_end',            ss.break_end::TEXT,
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

GRANT EXECUTE ON FUNCTION public.owner_get_week_shifts(DATE) TO authenticated;


-- ── 7. staff_get_my_shifts — include is_template_generated ───────────────────
CREATE OR REPLACE FUNCTION public.staff_get_my_shifts(
  p_from_date DATE,
  p_to_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid   UUID;
  v_sm_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT id INTO v_sm_id
  FROM staff_members
  WHERE user_id = v_uid AND is_active = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'shift_date',            ss.shift_date::TEXT,
          'start_time',            ss.start_time::TEXT,
          'end_time',              ss.end_time::TEXT,
          'is_off',                ss.is_off,
          'notes',                 ss.notes,
          'break_start',           ss.break_start::TEXT,
          'break_end',             ss.break_end::TEXT,
          'is_template_generated', ss.is_template_generated
        )
        ORDER BY ss.shift_date
      )
      FROM staff_shifts ss
      WHERE ss.staff_member_id = v_sm_id
        AND ss.shift_date >= p_from_date
        AND ss.shift_date <= p_to_date
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_get_my_shifts(DATE, DATE) TO authenticated;


-- ── 8. owner_save_week_schedule — new RPC ────────────────────────────────────
--
-- Saves an explicit weekly schedule for one staff member, then forward-fills
-- subsequent auto-generated weeks until the next explicitly-set week.
--
-- p_days: JSON array of 7 objects, one per day:
--   { day_of_week: 0–6 (0=Mon, 6=Sun),
--     start_time: "HH:MM" | null,
--     end_time:   "HH:MM" | null,
--     is_off:     true | false,
--     break_start:"HH:MM" | null,
--     break_end:  "HH:MM" | null }

CREATE OR REPLACE FUNCTION public.owner_save_week_schedule(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_week_start      DATE,
  p_days            JSONB
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_day         JSONB;
  v_dow_offset  INTEGER;
  v_fill_date   DATE;
  v_fill_week   DATE;
  v_has_explicit BOOLEAN;
  v_saved       INTEGER := 0;
  v_filled      INTEGER := 0;
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

  IF EXTRACT(isodow FROM p_week_start)::INTEGER != 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'week_start_must_be_monday');
  END IF;

  -- Step 1: upsert 7 explicit days for this week (is_template_generated = FALSE)
  FOR v_day IN SELECT * FROM jsonb_array_elements(p_days) LOOP
    v_dow_offset := (v_day->>'day_of_week')::INTEGER;  -- 0=Mon..6=Sun
    v_fill_date  := p_week_start + v_dow_offset;

    INSERT INTO staff_shifts (
      business_id, staff_member_id, location_id, shift_date,
      start_time, end_time, is_off, break_start, break_end,
      is_template_generated, created_by
    ) VALUES (
      v_biz_id, p_staff_member_id, p_location_id, v_fill_date,
      CASE WHEN COALESCE((v_day->>'is_off')::BOOLEAN, FALSE) THEN NULL
           ELSE (v_day->>'start_time')::TIME END,
      CASE WHEN COALESCE((v_day->>'is_off')::BOOLEAN, FALSE) THEN NULL
           ELSE (v_day->>'end_time')::TIME END,
      COALESCE((v_day->>'is_off')::BOOLEAN, FALSE),
      (v_day->>'break_start')::TIME,
      (v_day->>'break_end')::TIME,
      FALSE,  -- explicit
      v_uid
    )
    ON CONFLICT (staff_member_id, shift_date)
    DO UPDATE SET
      start_time            = EXCLUDED.start_time,
      end_time              = EXCLUDED.end_time,
      is_off                = EXCLUDED.is_off,
      break_start           = EXCLUDED.break_start,
      break_end             = EXCLUDED.break_end,
      is_template_generated = FALSE,
      created_by            = v_uid,
      updated_at            = now();

    v_saved := v_saved + 1;
  END LOOP;

  -- Step 2: forward-fill subsequent weeks until the next explicitly-set week
  v_fill_week := p_week_start + 7;

  WHILE v_fill_week <= (p_week_start + 90) LOOP
    -- Stop at the first future week that has any explicit entry
    SELECT EXISTS (
      SELECT 1 FROM staff_shifts
      WHERE staff_member_id   = p_staff_member_id
        AND shift_date        >= v_fill_week
        AND shift_date        <  v_fill_week + 7
        AND is_template_generated = FALSE
    ) INTO v_has_explicit;

    IF v_has_explicit THEN EXIT; END IF;

    FOR v_day IN SELECT * FROM jsonb_array_elements(p_days) LOOP
      v_dow_offset := (v_day->>'day_of_week')::INTEGER;
      v_fill_date  := v_fill_week + v_dow_offset;

      INSERT INTO staff_shifts (
        business_id, staff_member_id, location_id, shift_date,
        start_time, end_time, is_off, break_start, break_end,
        is_template_generated, created_by
      ) VALUES (
        v_biz_id, p_staff_member_id, p_location_id, v_fill_date,
        CASE WHEN COALESCE((v_day->>'is_off')::BOOLEAN, FALSE) THEN NULL
             ELSE (v_day->>'start_time')::TIME END,
        CASE WHEN COALESCE((v_day->>'is_off')::BOOLEAN, FALSE) THEN NULL
             ELSE (v_day->>'end_time')::TIME END,
        COALESCE((v_day->>'is_off')::BOOLEAN, FALSE),
        (v_day->>'break_start')::TIME,
        (v_day->>'break_end')::TIME,
        TRUE,   -- auto-generated fill
        v_uid
      )
      ON CONFLICT (staff_member_id, shift_date)
      DO UPDATE SET
        start_time            = EXCLUDED.start_time,
        end_time              = EXCLUDED.end_time,
        is_off                = EXCLUDED.is_off,
        break_start           = EXCLUDED.break_start,
        break_end             = EXCLUDED.break_end,
        is_template_generated = TRUE,
        updated_at            = now()
      WHERE staff_shifts.is_template_generated = TRUE;  -- never overwrite explicit

      v_filled := v_filled + 1;
    END LOOP;

    v_fill_week := v_fill_week + 7;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'saved', v_saved, 'filled', v_filled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_save_week_schedule(UUID, UUID, DATE, JSONB) TO authenticated;


-- ── 9. owner_get_staff_shifts_range — for Setup/Osoblje UI ──────────────────
CREATE OR REPLACE FUNCTION public.owner_get_staff_shifts_range(
  p_staff_member_id UUID,
  p_from_date       DATE,
  p_to_date         DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'shift_date',            ss.shift_date::TEXT,
          'start_time',            ss.start_time::TEXT,
          'end_time',              ss.end_time::TEXT,
          'is_off',                ss.is_off,
          'break_start',           ss.break_start::TEXT,
          'break_end',             ss.break_end::TEXT,
          'is_template_generated', ss.is_template_generated
        )
        ORDER BY ss.shift_date
      )
      FROM staff_shifts ss
      WHERE ss.staff_member_id = p_staff_member_id
        AND ss.shift_date      >= p_from_date
        AND ss.shift_date      <= p_to_date
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_staff_shifts_range(UUID, DATE, DATE) TO authenticated;
