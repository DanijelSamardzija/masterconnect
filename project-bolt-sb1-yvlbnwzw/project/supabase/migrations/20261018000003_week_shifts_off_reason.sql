-- Add off_reason to owner_get_week_shifts output
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

GRANT EXECUTE ON FUNCTION public.owner_get_week_shifts(DATE) TO authenticated;
