-- Fix get_location_staff_absences: date_to was computed as (ends_at_date - 1)
-- which only works for the owner's "midnight of next day" convention.
-- Staff-created blocks store ends_at as endDate T23:59:59 local, so
-- ends_at_date = endDate and date_to = endDate - 1, dropping the last day.
--
-- Fix: use CASE on the time component in business timezone:
--   if ends_at local time = 00:00:00 → midnight convention → subtract 1 day
--   otherwise (e.g. 23:59:59)        → inclusive convention → keep as-is

CREATE OR REPLACE FUNCTION public.get_location_staff_absences(
  p_location_id UUID
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
        'id',              tb.id,
        'staff_member_id', tb.staff_member_id,
        'staff_name',      p.name,
        'reason',          tb.reason,
        'note',            tb.note,
        'date_from',       (tb.starts_at AT TIME ZONE bl.timezone)::DATE,
        'date_to',         CASE
                             WHEN (tb.ends_at AT TIME ZONE bl.timezone)::TIME = TIME '00:00:00'
                             THEN (tb.ends_at AT TIME ZONE bl.timezone)::DATE - 1
                             ELSE (tb.ends_at AT TIME ZONE bl.timezone)::DATE
                           END,
        'is_past',         tb.ends_at < now()
      )
      ORDER BY sm.id, tb.starts_at DESC
    ),
    '[]'::jsonb
  )
  FROM   time_blocks tb
  JOIN   staff_members sm ON sm.id = tb.staff_member_id
  JOIN   profiles p        ON p.id  = sm.user_id
  JOIN   business_locations bl ON bl.id = p_location_id
  WHERE  sm.business_id = (SELECT business_id FROM business_locations WHERE id = p_location_id LIMIT 1)
    AND  sm.is_active   = true
    AND  tb.entity_type = 'staff';
$$;

GRANT EXECUTE ON FUNCTION public.get_location_staff_absences(UUID) TO authenticated;
