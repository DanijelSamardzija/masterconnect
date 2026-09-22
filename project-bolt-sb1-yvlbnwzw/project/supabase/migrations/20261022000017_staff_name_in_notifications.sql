-- Add staff name to client booking_confirmed in-app notification body.
-- When a booking is assigned to a staff member (not the owner), the client's
-- notification now shows "· radnik: Zoran Samardzija" so they know who to expect.

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
  v_staff_name    TEXT;
  v_pref_key      TEXT;
  v_caller_uid    UUID;
  v_meta          JSONB;
  v_timezone      TEXT;
BEGIN
  v_caller_uid := auth.uid();

  SELECT name INTO v_client_name   FROM profiles        WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

  IF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM business_locations WHERE id = NEW.location_id LIMIT 1;
  END IF;
  v_timezone := COALESCE(v_timezone, 'UTC');

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at, v_timezone);

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

  -- Notify assigned staff (if any, if not the client, if they didn't create this booking)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    -- Fetch staff name for notification bodies
    IF v_staff_uid IS NOT NULL THEN
      SELECT name INTO v_staff_name FROM profiles WHERE id = v_staff_uid LIMIT 1;
    END IF;

    IF v_staff_uid IS NOT NULL
      AND (NEW.client_id IS NULL OR v_staff_uid <> NEW.client_id)
      AND (v_caller_uid IS NULL OR v_staff_uid <> v_caller_uid)
    THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- Notify owner (if they didn't create this booking themselves)
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  IF v_owner_uid IS NOT NULL
    AND (NEW.client_id IS NULL OR v_owner_uid <> NEW.client_id)
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
    AND (v_caller_uid IS NULL OR v_owner_uid <> v_caller_uid)
  THEN
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

  -- Notify client: in-app bell only (email handled by /api/booking/notify).
  -- Include staff name when assigned to a non-owner staff member.
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id, 'booking', 'booking_confirmed',
      'Rezervacija potvrđena',
      COALESCE(v_business_name, 'Biznis') || ' je potvrdio/la tvoj termin za ' || v_service_name
        || CASE
             WHEN v_staff_uid IS NOT NULL AND v_staff_name IS NOT NULL
               AND (v_owner_uid IS NULL OR v_staff_uid <> v_owner_uid)
             THEN ' · radnik: ' || v_staff_name
             ELSE ''
           END
        || ' · ' || v_dt_str,
      v_meta || jsonb_build_object('skip_email', true)
    );
  END IF;

  RETURN NEW;
END;
$$;
