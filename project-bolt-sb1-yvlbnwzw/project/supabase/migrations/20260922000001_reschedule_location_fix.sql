-- Fix owner_reschedule_booking (3-param) to also update location_id when
-- the booking is reassigned to a staff member on a different location.
--
-- Also consolidates notifications (merged from the 2-param notification_gaps
-- version) so both overloads send bell notifications to client and staff.

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
  v_uid           UUID;
  v_biz_id        UUID;
  v_old_start     TIMESTAMPTZ;
  v_old_end       TIMESTAMPTZ;
  v_new_end       TIMESTAMPTZ;
  v_staff_id      UUID;
  v_staff_uid     UUID;
  v_client_id     UUID;
  v_svc_name      TEXT;
  v_biz_name      TEXT;
  v_new_loc_id    UUID;
  v_duration_iv   INTERVAL;
  v_meta          JSONB;
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

  SELECT starts_at, ends_at, staff_member_id, client_id, service_name_snapshot
  INTO   v_old_start, v_old_end, v_staff_id, v_client_id, v_svc_name
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

  -- If a new staff member is requested, validate and switch conflict target + location
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

    -- Resolve new location from the new staff member's primary location
    SELECT sm.primary_location_id INTO v_new_loc_id
    FROM   staff_members sm
    WHERE  sm.id = p_staff_member_id
    LIMIT  1;
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
         staff_member_id = CASE
                             WHEN p_staff_member_id IS NOT NULL THEN p_staff_member_id
                             ELSE staff_member_id
                           END,
         -- Update location only when staff actually changed and has a primary location
         location_id     = CASE
                             WHEN p_staff_member_id IS NOT NULL AND v_new_loc_id IS NOT NULL THEN v_new_loc_id
                             ELSE location_id
                           END,
         updated_at      = now()
  WHERE  id = p_booking_id;

  -- Bell notifications (client + staff)
  SELECT name INTO v_biz_name FROM profiles WHERE id = v_biz_id LIMIT 1;
  v_biz_name := COALESCE(v_biz_name, 'Biznis');
  v_svc_name := COALESCE(v_svc_name, 'Usluga');

  v_meta := jsonb_build_object(
    'booking_id',    p_booking_id,
    'business_id',   v_biz_id,
    'business_name', v_biz_name,
    'service_name',  v_svc_name,
    'starts_at',     p_new_starts_at
  );

  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_client_id, 'booking', 'booking_rescheduled', 'Termin premješten',
      v_biz_name || ' je premjestio/la tvoj termin za ' || v_svc_name || ' · ' || private_fmt_booking_dt(p_new_starts_at),
      v_meta
    );
  END IF;

  IF v_staff_id IS NOT NULL THEN
    SELECT sm.user_id INTO v_staff_uid FROM staff_members sm WHERE sm.id = v_staff_id LIMIT 1;
    IF v_staff_uid IS NOT NULL AND v_staff_uid <> v_uid THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_rescheduled', 'Termin premješten',
        'Termin za ' || v_svc_name || ' premješten na ' || private_fmt_booking_dt(p_new_starts_at),
        v_meta
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reschedule_booking(UUID, TIMESTAMPTZ, UUID) TO authenticated;
