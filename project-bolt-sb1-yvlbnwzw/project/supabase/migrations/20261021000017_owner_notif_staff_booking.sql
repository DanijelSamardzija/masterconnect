-- Add notify_staff_booking pref: owner can separately control whether they
-- receive notifications when a booking is assigned to a staff member
-- (as opposed to bookings assigned directly to the owner themselves)

-- ── 1. Extend update_notification_prefs ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_notification_prefs(p_prefs JSONB)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.profiles
  SET notification_prefs = jsonb_build_object(
    -- channel toggles
    'push_enabled',        COALESCE((p_prefs->>'push_enabled')::BOOLEAN,        true),
    'email_enabled',       COALESCE((p_prefs->>'email_enabled')::BOOLEAN,       true),
    -- quiet hours
    'quiet_enabled',       COALESCE((p_prefs->>'quiet_enabled')::BOOLEAN,       false),
    'quiet_from',          p_prefs->>'quiet_from',
    'quiet_to',            p_prefs->>'quiet_to',
    'quiet_tz',            p_prefs->>'quiet_tz',
    -- booking event types (owner)
    'notify_new_booking',  COALESCE((p_prefs->>'notify_new_booking')::BOOLEAN,  true),
    'notify_staff_booking',COALESCE((p_prefs->>'notify_staff_booking')::BOOLEAN,true),
    'notify_cancellation', COALESCE((p_prefs->>'notify_cancellation')::BOOLEAN, true),
    'notify_reschedule',   COALESCE((p_prefs->>'notify_reschedule')::BOOLEAN,   true)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(JSONB) TO authenticated;


-- ── 2. notify_booking_created — split pref by whether staff is assigned ───────
--
-- notify_new_booking  → booking NOT assigned to a staff member (or assigned to owner)
-- notify_staff_booking → booking assigned to a non-owner staff member

CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_name   TEXT;
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_owner_uid     UUID;
  v_staff_uid     UUID;
  v_staff_role    TEXT;
  v_pref_key      TEXT;
  v_meta          JSONB;
BEGIN
  SELECT name INTO v_client_name   FROM profiles WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'client_id',     NEW.client_id,
    'client_name',   v_client_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- Notify assigned staff (if any, if not the client)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_uid IS NOT NULL AND v_staff_uid <> NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- Notify owner
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  IF v_owner_uid IS NOT NULL
    AND v_owner_uid <> NEW.client_id
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
  THEN
    -- Decide which pref key to check:
    -- If booking is assigned to a non-owner staff → check notify_staff_booking
    -- Otherwise (no staff, or staff is the owner) → check notify_new_booking
    IF v_staff_uid IS NOT NULL AND v_staff_uid <> v_owner_uid THEN
      v_pref_key := 'notify_staff_booking';
    ELSE
      v_pref_key := 'notify_new_booking';
    END IF;

    IF private_owner_pref(v_owner_uid, v_pref_key) THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_owner_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- Instant booking: notify client of confirmation
  IF NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id, 'booking', 'booking_confirmed',
      'Rezervacija potvrđena',
      COALESCE(v_business_name, 'Biznis') || ' je potvrdio/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_booking_created ON bookings;
CREATE TRIGGER trigger_notify_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_created();
