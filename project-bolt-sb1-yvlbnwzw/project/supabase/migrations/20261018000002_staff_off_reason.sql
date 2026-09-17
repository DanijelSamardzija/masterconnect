-- ── off_reason for staff_shifts ─────────────────────────────────────────────
-- Adds off_reason column so the UI can record WHY a day is off:
--   day_off   → Slobodan (generic day off)
--   vacation  → Godišnji odmor
--   sick_leave→ Bolovanje
-- NULL means working (is_off = false), or not recorded.

ALTER TABLE staff_shifts
  ADD COLUMN IF NOT EXISTS off_reason TEXT
    CHECK (off_reason IS NULL OR off_reason IN ('day_off','vacation','sick_leave'));

-- ── Update owner_save_week_schedule to persist off_reason ────────────────────
CREATE OR REPLACE FUNCTION public.owner_save_week_schedule(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_week_start      DATE,
  p_days            JSONB   -- array of {day_of_week,start_time,end_time,is_off,off_reason,break_start,break_end}
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_biz_id       UUID;
  v_day          JSONB;
  v_dow_offset   INTEGER;
  v_fill_date    DATE;
  v_fill_week    DATE;
  v_has_explicit BOOLEAN;
  v_saved        INTEGER := 0;
  v_filled       INTEGER := 0;
  v_is_off       BOOLEAN;
  v_off_reason   TEXT;
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
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Verify staff member belongs to same business
  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  -- Step 1: upsert 7 explicit days for this week (is_template_generated = FALSE)
  FOR v_day IN SELECT * FROM jsonb_array_elements(p_days) LOOP
    v_dow_offset := (v_day->>'day_of_week')::INTEGER;  -- 0=Mon..6=Sun
    v_fill_date  := p_week_start + v_dow_offset;
    v_is_off     := COALESCE((v_day->>'is_off')::BOOLEAN, FALSE);
    v_off_reason := CASE WHEN v_is_off THEN COALESCE(v_day->>'off_reason', 'day_off') ELSE NULL END;

    INSERT INTO staff_shifts (
      business_id, staff_member_id, location_id, shift_date,
      start_time, end_time, is_off, off_reason, break_start, break_end,
      is_template_generated, created_by
    ) VALUES (
      v_biz_id, p_staff_member_id, p_location_id, v_fill_date,
      CASE WHEN v_is_off THEN NULL ELSE (v_day->>'start_time')::TIME END,
      CASE WHEN v_is_off THEN NULL ELSE (v_day->>'end_time')::TIME END,
      v_is_off,
      v_off_reason,
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
      off_reason            = EXCLUDED.off_reason,
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
      v_is_off     := COALESCE((v_day->>'is_off')::BOOLEAN, FALSE);
      v_off_reason := CASE WHEN v_is_off THEN COALESCE(v_day->>'off_reason', 'day_off') ELSE NULL END;

      INSERT INTO staff_shifts (
        business_id, staff_member_id, location_id, shift_date,
        start_time, end_time, is_off, off_reason, break_start, break_end,
        is_template_generated, created_by
      ) VALUES (
        v_biz_id, p_staff_member_id, p_location_id, v_fill_date,
        CASE WHEN v_is_off THEN NULL ELSE (v_day->>'start_time')::TIME END,
        CASE WHEN v_is_off THEN NULL ELSE (v_day->>'end_time')::TIME END,
        v_is_off,
        v_off_reason,
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
        off_reason            = EXCLUDED.off_reason,
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


-- ── Update owner_get_staff_shifts_range to include off_reason ────────────────
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
          'off_reason',            ss.off_reason,
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


-- ── Update staff_get_my_shifts to include off_reason ────────────────────────
CREATE OR REPLACE FUNCTION public.staff_get_my_shifts(
  p_from_date DATE,
  p_to_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
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
          'off_reason',            ss.off_reason,
          'break_start',           ss.break_start::TEXT,
          'break_end',             ss.break_end::TEXT,
          'is_template_generated', ss.is_template_generated
        )
        ORDER BY ss.shift_date
      )
      FROM staff_shifts ss
      WHERE ss.staff_member_id = v_sm_id
        AND ss.shift_date      >= p_from_date
        AND ss.shift_date      <= p_to_date
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_get_my_shifts(DATE, DATE) TO authenticated;
