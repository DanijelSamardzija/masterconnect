-- ============================================================
-- owner_get_week_shifts — show effective schedule for all 7 days
--
-- Previously only returned explicit staff_shifts overrides.
-- Now generates all 7 days and fills in opening_hours (regular
-- schedule) for days without an override, so the table always
-- shows what a worker is actually doing each day.
--
-- New field: is_override (bool) — true = explicit override this
-- week, false = following regular schedule
-- ============================================================

CREATE OR REPLACE FUNCTION public.owner_get_week_shifts(
  p_week_start DATE
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
          'shifts', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'shift_date',  d.shift_date::TEXT,
                'is_override', (ss.id IS NOT NULL),
                'start_time',  COALESCE(ss.start_time, oh_eff.start_time)::TEXT,
                'end_time',    COALESCE(ss.end_time,   oh_eff.end_time)::TEXT,
                'is_off',      CASE
                                 WHEN ss.id IS NOT NULL THEN ss.is_off
                                 WHEN oh_eff.id IS NOT NULL THEN oh_eff.is_closed
                                 ELSE true
                               END,
                'notes',       ss.notes,
                'break_start', ss.break_start::TEXT,
                'break_end',   ss.break_end::TEXT
              )
              ORDER BY d.shift_date
            )
            FROM (
              SELECT generate_series(
                p_week_start::TIMESTAMP,
                (p_week_start + 6)::TIMESTAMP,
                '1 day'::INTERVAL
              )::DATE AS shift_date
            ) d
            LEFT JOIN staff_shifts ss
              ON ss.staff_member_id = sm.id
             AND ss.shift_date = d.shift_date
            LEFT JOIN LATERAL (
              SELECT oh.id, oh.start_time, oh.end_time, oh.is_closed
              FROM opening_hours oh
              WHERE oh.entity_type     = 'staff'
                AND oh.staff_member_id = sm.id
                AND oh.day_of_week     = EXTRACT(DOW FROM d.shift_date)::INTEGER
                AND oh.month IN (0, EXTRACT(MONTH FROM d.shift_date)::INTEGER)
              ORDER BY oh.month DESC
              LIMIT 1
            ) oh_eff ON true
          )
        )
        ORDER BY p.name
      )
      FROM staff_members sm
      JOIN profiles p ON p.id = sm.user_id
      WHERE sm.business_id = v_biz_id
        AND sm.is_active   = true
        AND sm.role IN ('worker', 'manager')
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_get_week_shifts(DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
