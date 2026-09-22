-- 1. get_my_staff_bookings — add service_id, staff_member_id, location_id,
--    business_id, location_timezone, guest_email so the staff reschedule page
--    has the params it needs to navigate to /booking/business/reschedule.
-- 2. update_notification_prefs — add notify_reschedule_email key.

DROP FUNCTION IF EXISTS public.get_my_staff_bookings(BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_my_staff_bookings(
  p_upcoming_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  booking_id         UUID,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  status             TEXT,
  service_name       TEXT,
  service_id         UUID,
  duration_minutes   INTEGER,
  client_name        TEXT,
  client_phone       TEXT,
  guest_name         TEXT,
  guest_phone        TEXT,
  guest_email        TEXT,
  location_name      TEXT,
  location_id        UUID,
  location_timezone  TEXT,
  staff_member_id    UUID,
  business_id        UUID,
  notes              TEXT,
  party_size         INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id                                          AS booking_id,
    b.starts_at,
    b.ends_at,
    b.status::TEXT,
    COALESCE(b.service_name_snapshot, sc.name, '—') AS service_name,
    b.service_id,
    b.duration_minutes,
    cp.name                                       AS client_name,
    cp.phone                                      AS client_phone,
    b.guest_name,
    b.guest_phone,
    b.guest_email,
    bl.name                                       AS location_name,
    b.location_id,
    COALESCE(bl.timezone, 'UTC')                  AS location_timezone,
    b.staff_member_id,
    sm.business_id,
    b.notes,
    b.party_size
  FROM bookings b
  JOIN staff_members sm ON sm.id = b.staff_member_id
  LEFT JOIN service_catalog sc ON sc.id = b.service_id
  LEFT JOIN profiles cp ON cp.id = b.client_id
  LEFT JOIN business_locations bl ON bl.id = b.location_id
  WHERE sm.user_id = auth.uid()
    AND (NOT p_upcoming_only OR b.starts_at >= now())
    AND b.status NOT IN ('cancelled')
  ORDER BY b.starts_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_staff_bookings(BOOLEAN) TO authenticated;


-- 2. update_notification_prefs — add notify_reschedule_email
CREATE OR REPLACE FUNCTION public.update_notification_prefs(p_prefs JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID;
  v_safe JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_safe := jsonb_build_object(
    'push_enabled',                  COALESCE((p_prefs->>'push_enabled')::BOOLEAN,  true),
    'email_enabled',                 COALESCE((p_prefs->>'email_enabled')::BOOLEAN, true),
    'quiet_enabled',                 COALESCE((p_prefs->>'quiet_enabled')::BOOLEAN, false),
    'quiet_from',                    COALESCE(p_prefs->>'quiet_from',  '22:00'),
    'quiet_to',                      COALESCE(p_prefs->>'quiet_to',    '07:00'),
    'quiet_tz',                      COALESCE(p_prefs->>'quiet_tz',    'UTC'),
    'notify_new_booking',            COALESCE((p_prefs->>'notify_new_booking')::BOOLEAN,           true),
    'notify_new_booking_email',      COALESCE((p_prefs->>'notify_new_booking_email')::BOOLEAN,     true),
    'notify_staff_booking',              COALESCE((p_prefs->>'notify_staff_booking')::BOOLEAN,         true),
    'notify_staff_booking_email',        COALESCE((p_prefs->>'notify_staff_booking_email')::BOOLEAN,   true),
    'notify_staff_added_booking',        COALESCE((p_prefs->>'notify_staff_added_booking')::BOOLEAN,   true),
    'notify_staff_added_booking_email',  COALESCE((p_prefs->>'notify_staff_added_booking_email')::BOOLEAN, true),
    'notify_cancellation',               COALESCE((p_prefs->>'notify_cancellation')::BOOLEAN,           true),
    'notify_cancellation_email',         COALESCE((p_prefs->>'notify_cancellation_email')::BOOLEAN,     true),
    'notify_reschedule',                 COALESCE((p_prefs->>'notify_reschedule')::BOOLEAN,             true),
    'notify_reschedule_email',           COALESCE((p_prefs->>'notify_reschedule_email')::BOOLEAN,       true)
  );

  UPDATE profiles SET notification_prefs = v_safe WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(JSONB) TO authenticated;
