-- Fix absence date range logic in staff_get_my_shifts.
--
-- Problem: generate_series with (ends_at_date - 1) only worked for the
-- owner's convention (ends_at = midnight of date_to + 1).  Staff's own
-- time-off entries use (ends_at = endDate T23:59:59), so ends_at_date = endDate
-- and ends_at_date - 1 = endDate - 1, silently dropping the last day.
--
-- Fix: replace generate_series with a proper per-day timestamp overlap check:
--   day d is covered if starts_at < midnight(d+1) AND ends_at > midnight(d)
-- This is correct regardless of how ends_at is stored.

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
      WITH day_series AS (
        -- One row per calendar day in the requested range
        SELECT d::DATE AS day
        FROM generate_series(p_from_date::TIMESTAMP, p_to_date::TIMESTAMP, '1 day'::INTERVAL) d
      ),
      absence_dates AS (
        -- A day is covered by an absence if the time_block overlaps it.
        -- Overlap condition (in business timezone):
        --   starts_at < midnight(day+1)  AND  ends_at > midnight(day)
        -- This works for both storage conventions:
        --   owner: ends_at = midnight(date_to+1)  →  correctly inclusive
        --   staff: ends_at = date_to T23:59:59    →  correctly inclusive
        SELECT DISTINCT ON (ds.day)
          ds.day            AS absence_date,
          tb.reason,
          tb.note
        FROM day_series ds
        JOIN time_blocks tb ON (
              tb.staff_member_id = v_sm_id
          AND tb.entity_type     = 'staff'
          AND tb.starts_at < (ds.day + 1)::TIMESTAMP AT TIME ZONE v_timezone
          AND tb.ends_at   > ds.day::TIMESTAMP        AT TIME ZONE v_timezone
        )
        ORDER BY ds.day, tb.starts_at
      ),
      shifts AS (
        -- Staff shifts, excluding dates covered by an absence
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
        SELECT
          a.absence_date::TEXT AS shift_date,
          NULL::TEXT           AS start_time,
          NULL::TEXT           AS end_time,
          true                 AS is_off,
          a.reason             AS off_reason,
          a.note               AS notes,
          NULL::TEXT           AS break_start,
          NULL::TEXT           AS break_end,
          false                AS is_template_generated
        FROM absence_dates a
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
