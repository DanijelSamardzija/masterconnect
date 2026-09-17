-- Fix staff_get_my_shifts: absences (time_blocks) must take priority over
-- staff_shifts.  Previous migration skipped absence days that already had a
-- staff_shift row, so template-generated or weekend shifts hid the vacation.
--
-- New logic:
--   1. Expand time_blocks into individual absence dates.
--   2. Return staff_shifts only for dates NOT covered by an absence.
--   3. Return absence rows for all absence dates (regardless of staff_shifts).

CREATE OR REPLACE FUNCTION public.staff_get_my_shifts(
  p_from_date DATE,
  p_to_date   DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid      UUID;
  v_sm_id    UUID;
  v_biz_id   UUID;
  v_timezone TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT sm.id, sm.business_id
  INTO   v_sm_id, v_biz_id
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
  LIMIT 1;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(bl.timezone, 'UTC')
  INTO   v_timezone
  FROM   business_locations bl
  WHERE  bl.business_id = v_biz_id
    AND  bl.is_primary  = true
  LIMIT 1;
  IF v_timezone IS NULL THEN v_timezone := 'UTC'; END IF;

  RETURN COALESCE(
    (
      WITH absence_dates AS (
        -- All individual dates covered by time_blocks for this staff member
        SELECT DISTINCT d::DATE AS absence_date
        FROM time_blocks tb
        CROSS JOIN LATERAL generate_series(
          (tb.starts_at AT TIME ZONE v_timezone)::DATE,
          ((tb.ends_at  AT TIME ZONE v_timezone)::DATE - 1),
          '1 day'::INTERVAL
        ) AS d
        WHERE tb.staff_member_id = v_sm_id
          AND tb.entity_type     = 'staff'
          AND d::DATE            >= p_from_date
          AND d::DATE            <= p_to_date
      ),
      shifts AS (
        -- Staff shifts only for dates NOT covered by an absence
        SELECT
          ss.shift_date::TEXT        AS shift_date,
          ss.start_time::TEXT        AS start_time,
          ss.end_time::TEXT          AS end_time,
          ss.is_off,
          ss.off_reason,
          ss.notes,
          ss.break_start::TEXT       AS break_start,
          ss.break_end::TEXT         AS break_end,
          ss.is_template_generated
        FROM staff_shifts ss
        WHERE ss.staff_member_id = v_sm_id
          AND ss.shift_date      >= p_from_date
          AND ss.shift_date      <= p_to_date
          AND ss.shift_date      NOT IN (SELECT absence_date FROM absence_dates)
      ),
      absence_rows AS (
        -- One row per absence date, using the first matching time_block's reason/note
        SELECT DISTINCT ON (d::DATE)
          d::DATE::TEXT AS shift_date,
          NULL::TEXT    AS start_time,
          NULL::TEXT    AS end_time,
          true          AS is_off,
          tb.reason     AS off_reason,
          tb.note       AS notes,
          NULL::TEXT    AS break_start,
          NULL::TEXT    AS break_end,
          false         AS is_template_generated
        FROM time_blocks tb
        CROSS JOIN LATERAL generate_series(
          (tb.starts_at AT TIME ZONE v_timezone)::DATE,
          ((tb.ends_at  AT TIME ZONE v_timezone)::DATE - 1),
          '1 day'::INTERVAL
        ) AS d
        WHERE tb.staff_member_id = v_sm_id
          AND tb.entity_type     = 'staff'
          AND d::DATE            >= p_from_date
          AND d::DATE            <= p_to_date
        ORDER BY d::DATE, tb.starts_at
      ),
      combined AS (
        SELECT * FROM shifts
        UNION ALL
        SELECT * FROM absence_rows
      )
      SELECT jsonb_agg(
        jsonb_build_object(
          'shift_date',            c.shift_date,
          'start_time',            c.start_time,
          'end_time',              c.end_time,
          'is_off',                c.is_off,
          'off_reason',            c.off_reason,
          'notes',                 c.notes,
          'break_start',           c.break_start,
          'break_end',             c.break_end,
          'is_template_generated', c.is_template_generated
        )
        ORDER BY c.shift_date
      )
      FROM combined c
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_get_my_shifts(DATE, DATE) TO authenticated;
