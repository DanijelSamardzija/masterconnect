-- Fix: update_notification_prefs RPC was missing email-specific pref keys
-- (notify_new_booking_email, notify_staff_booking_email, notify_cancellation_email).
-- Each save replaced the JSONB with a hardcoded object that omitted these keys,
-- causing them to be deleted from the DB and reset to true (default) on next load.

CREATE OR REPLACE FUNCTION public.update_notification_prefs(p_prefs JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.profiles
  SET notification_prefs = jsonb_build_object(
    -- channel toggles
    'push_enabled',               COALESCE((p_prefs->>'push_enabled')::BOOLEAN,               true),
    'email_enabled',              COALESCE((p_prefs->>'email_enabled')::BOOLEAN,              true),
    -- quiet hours
    'quiet_enabled',              COALESCE((p_prefs->>'quiet_enabled')::BOOLEAN,              false),
    'quiet_from',                 p_prefs->>'quiet_from',
    'quiet_to',                   p_prefs->>'quiet_to',
    'quiet_tz',                   p_prefs->>'quiet_tz',
    -- booking event types (owner Bell + Email controls)
    'notify_new_booking',         COALESCE((p_prefs->>'notify_new_booking')::BOOLEAN,         true),
    'notify_new_booking_email',   COALESCE((p_prefs->>'notify_new_booking_email')::BOOLEAN,   true),
    'notify_staff_booking',       COALESCE((p_prefs->>'notify_staff_booking')::BOOLEAN,       true),
    'notify_staff_booking_email', COALESCE((p_prefs->>'notify_staff_booking_email')::BOOLEAN, true),
    'notify_cancellation',        COALESCE((p_prefs->>'notify_cancellation')::BOOLEAN,        true),
    'notify_cancellation_email',  COALESCE((p_prefs->>'notify_cancellation_email')::BOOLEAN,  true),
    'notify_reschedule',          COALESCE((p_prefs->>'notify_reschedule')::BOOLEAN,          true)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
