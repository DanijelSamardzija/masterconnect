-- Fix multi-profile staff schedule RPCs.
--
-- All three functions (owner_get_staff_shifts_range, owner_save_week_schedule,
-- owner_copy_staff_week_shifts) used auth.uid() + LIMIT 1 to resolve v_biz_id,
-- which picks the wrong business when the owner has multiple profiles.
--
-- Fix: add p_business_id UUID DEFAULT NULL. When supplied (always passed from the
-- UI as activeProfileId), it is used directly. When NULL, falls back to the old
-- LIMIT 1 query for backwards compatibility with any existing callers.
--
-- Also drops the conflicting old overloads of owner_copy_staff_week_shifts to
-- eliminate the PGRST203 ambiguous-overload error PostgREST was throwing.

-- ── 1. owner_get_staff_shifts_range ──────────────────────────────────────────

DROP FUNCTION IF EXISTS public.owner_get_staff_shifts_range(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.owner_get_staff_shifts_range(
  p_staff_member_id UUID,
  p_from_date       DATE,
  p_to_date         DATE,
  p_business_id     UUID DEFAULT NULL
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

  IF p_business_id IS NOT NULL THEN
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.business_id = p_business_id
      AND sm.is_active = true AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  ELSE
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  END IF;
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

GRANT EXECUTE ON FUNCTION public.owner_get_staff_shifts_range(UUID, DATE, DATE, UUID) TO authenticated;

-- ── 2. owner_save_week_schedule ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.owner_save_week_schedule(UUID, UUID, DATE, JSONB);

CREATE OR REPLACE FUNCTION public.owner_save_week_schedule(
  p_staff_member_id UUID,
  p_location_id     UUID,
  p_week_start      DATE,
  p_days            JSONB,
  p_business_id     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
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

  IF p_business_id IS NOT NULL THEN
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.business_id = p_business_id
      AND sm.is_active = true AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  ELSE
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  FOR v_day IN SELECT * FROM jsonb_array_elements(p_days) LOOP
    v_dow_offset := (v_day->>'day_of_week')::INTEGER;
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
      FALSE,
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
        TRUE,
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
      WHERE staff_shifts.is_template_generated = TRUE;

      v_filled := v_filled + 1;
    END LOOP;

    v_fill_week := v_fill_week + 7;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'saved', v_saved, 'filled', v_filled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_save_week_schedule(UUID, UUID, DATE, JSONB, UUID) TO authenticated;

-- ── 3. owner_copy_staff_week_shifts ──────────────────────────────────────────
-- Drop both old overloads (4-param with DEFAULT from migration 009, and
-- 3-param from migration 021) before creating the new 4-param version.

DROP FUNCTION IF EXISTS public.owner_copy_staff_week_shifts(UUID, DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.owner_copy_staff_week_shifts(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.owner_copy_staff_week_shifts(
  p_staff_member_id UUID,
  p_from_week_start DATE,
  p_to_week_start   DATE,
  p_business_id     UUID DEFAULT NULL
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

  IF p_business_id IS NOT NULL THEN
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.business_id = p_business_id
      AND sm.is_active = true AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  ELSE
    SELECT sm.business_id INTO v_biz_id
    FROM staff_members sm
    WHERE sm.user_id = v_uid AND sm.is_active = true
      AND sm.role IN ('owner', 'manager')
    LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  PERFORM id FROM staff_members
  WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  DELETE FROM staff_shifts
  WHERE staff_member_id = p_staff_member_id
    AND shift_date >= p_to_week_start
    AND shift_date <  p_to_week_start + 7;

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

NOTIFY pgrst, 'reload schema';
