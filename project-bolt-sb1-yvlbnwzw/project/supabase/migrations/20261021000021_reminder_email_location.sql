-- ==========================================================================
-- Fix: send_booking_reminders should return location name/address so the
-- cron route can include WHERE in the reminder email (same as confirmation
-- and cancellation emails already do).
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.send_booking_reminders()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent    INTEGER := 0;
  v_details JSONB   := '[]'::JSONB;
BEGIN
  WITH
  locked AS (
    SELECT b.id, b.client_id, b.business_id, b.location_id, b.service_name_snapshot, b.starts_at
    FROM   bookings b
    WHERE  b.status           = 'confirmed'
      AND  b.reminder_sent_at IS NULL
      AND  b.starts_at BETWEEN (now() + INTERVAL '23 hours') AND (now() + INTERVAL '25 hours')
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE bookings SET reminder_sent_at = now()
    WHERE  id IN (SELECT id FROM locked)
    RETURNING id
  ),
  notifs AS (
    INSERT INTO notifications(user_id, type, action_type, title, body, meta)
    SELECT
      l.client_id, 'booking', 'booking_reminder', 'Termin sutra ⏰',
      private_fmt_booking_dt(l.starts_at),
      jsonb_build_object(
        'booking_id',    l.id,
        'business_id',   l.business_id,
        'business_name', (SELECT name FROM profiles WHERE id = l.business_id LIMIT 1),
        'service_name',  l.service_name_snapshot,
        'starts_at',     l.starts_at
      )
    FROM locked l
    INNER JOIN updated u ON u.id = l.id
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_sent FROM notifs;

  -- Collect booking details for the cron to send reminder emails (including location)
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB) INTO v_details
  FROM (
    SELECT
      b.id                            AS booking_id,
      b.starts_at,
      b.service_name_snapshot         AS service_name,
      p_c.email                       AS client_email,
      p_c.name                        AS client_name,
      p_c.country                     AS client_country,
      p_b.name                        AS business_name,
      COALESCE(bl.timezone, 'UTC')    AS timezone,
      bl.name                         AS location_name,
      bl.address                      AS location_address,
      bl.city                         AS location_city
    FROM bookings b
    JOIN profiles p_c ON p_c.id = b.client_id
    JOIN profiles p_b ON p_b.id = b.business_id
    LEFT JOIN business_locations bl ON bl.id = b.location_id
    WHERE b.reminder_sent_at >= now() - INTERVAL '5 minutes'
      AND b.reminder_sent_at IS NOT NULL
      AND b.status = 'confirmed'
  ) x;

  RETURN jsonb_build_object('ok', true, 'sent', v_sent, 'bookings', v_details);
END;
$$;

REVOKE ALL ON FUNCTION public.send_booking_reminders() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_booking_reminders() TO service_role;
