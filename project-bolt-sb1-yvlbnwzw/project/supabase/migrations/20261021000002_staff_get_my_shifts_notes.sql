-- Add notes field to staff_get_my_shifts response.
-- owner_get_week_shifts already returns notes (since 20261018000003),
-- but staff_get_my_shifts was missing it, so staff could not see
-- notes that the owner added for their shifts.

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
          'off_reason',            ss.off_reason,
          'notes',                 ss.notes,
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
