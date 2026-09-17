-- Fix public_get_staff_absences: date_to was computed as (ends_at_date - 1)
-- which only works for the owner's "midnight of next day" convention.
-- Staff-created blocks may store ends_at as endDate T23:59:59 local time, so
-- ends_at_date = endDate and date_to = endDate - 1, dropping the last day.
--
-- Same fix applied to get_location_staff_absences in 20261021000007:
-- if ends_at local time = 00:00:00 → midnight convention → subtract 1 day
-- otherwise (e.g. 23:59:59)        → inclusive convention → keep date as-is

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
        'date_from', (tb.starts_at AT TIME ZONE bl.timezone)::DATE,
        'date_to',   CASE
                       WHEN (tb.ends_at AT TIME ZONE bl.timezone)::TIME = TIME '00:00:00'
                       THEN (tb.ends_at AT TIME ZONE bl.timezone)::DATE - 1
                       ELSE (tb.ends_at AT TIME ZONE bl.timezone)::DATE
                     END
      )
      ORDER BY tb.starts_at ASC
    ),
    '[]'::jsonb
  )
  FROM   time_blocks tb
  JOIN   staff_members sm ON sm.id = tb.staff_member_id
  JOIN   business_locations bl ON bl.business_id = sm.business_id AND bl.is_primary = true
  WHERE  tb.staff_member_id = p_staff_member_id
    AND  tb.entity_type     = 'staff'
    AND  tb.ends_at         > now();
$$;

GRANT EXECUTE ON FUNCTION public.public_get_staff_absences(UUID) TO anon, authenticated;
