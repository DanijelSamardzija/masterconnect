-- Extend owner_reschedule_booking to optionally change the assigned staff member.
--
-- When p_staff_member_id is supplied and differs from the booking's current staff:
--   1. Validates the new staff belongs to the owner's business and is active.
--   2. Runs the conflict check against the NEW staff member's schedule.
--   3. Updates both starts_at/ends_at AND staff_member_id in one atomic step.
--
-- When p_staff_member_id is NULL the function behaves exactly as before.

-- Drop old 2-param overload so PostgreSQL does not complain about ambiguity.
DROP FUNCTION IF EXISTS public.owner_reschedule_booking(UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.owner_reschedule_booking(
  p_booking_id      UUID,
  p_new_starts_at   TIMESTAMPTZ,
  p_staff_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID;
  v_biz_id      UUID;
  v_old_start   TIMESTAMPTZ;
  v_old_end     TIMESTAMPTZ;
  v_new_end     TIMESTAMPTZ;
  v_staff_id    UUID;   -- the staff to use for conflict check (old or new)
  v_duration_iv INTERVAL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM   staff_members sm
  WHERE  sm.user_id   = v_uid
    AND  sm.is_active = true
    AND  sm.role      IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  SELECT starts_at, ends_at, staff_member_id
  INTO   v_old_start, v_old_end, v_staff_id
  FROM   bookings
  WHERE  id          = p_booking_id
    AND  business_id = v_biz_id
    AND  status      IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF p_new_starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_in_past');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  -- If a new staff member is requested, validate and switch the conflict target
  IF p_staff_member_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE  sm.id          = p_staff_member_id
        AND  sm.business_id = v_biz_id
        AND  sm.is_active   = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
    END IF;
    v_staff_id := p_staff_member_id;
  END IF;

  -- Conflict check against the (possibly new) staff member
  IF v_staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings b
      WHERE  b.staff_member_id = v_staff_id
        AND  b.status          IN ('pending', 'confirmed')
        AND  b.id              <> p_booking_id
        AND  p_new_starts_at   <  b.ends_at
        AND  v_new_end         >  b.starts_at
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict');
    END IF;
  END IF;

  UPDATE bookings
  SET    starts_at       = p_new_starts_at,
         ends_at         = v_new_end,
         -- Only overwrite staff when a new one was explicitly provided
         staff_member_id = CASE
                             WHEN p_staff_member_id IS NOT NULL THEN p_staff_member_id
                             ELSE staff_member_id
                           END,
         updated_at      = now()
  WHERE  id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reschedule_booking(UUID, TIMESTAMPTZ, UUID) TO authenticated;
