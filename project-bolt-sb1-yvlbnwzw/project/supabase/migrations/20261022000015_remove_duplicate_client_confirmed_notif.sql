-- Remove duplicate booking_confirmed notification for client on instant-confirm bookings.
--
-- When a booking is created with status='confirmed', notify_booking_created was
-- inserting a booking_confirmed notification for the client, which caused push/send
-- to email them "Rezervacija potvrđena". But /api/booking/notify already sends a
-- better "Rezervacija kreirana" email (Email 1). So Email 2 was a duplicate.
--
-- The pending→confirmed flow is handled separately by notify_booking_status_change,
-- which remains untouched. That trigger still fires when owner manually confirms.

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

  -- NOTE: No booking_confirmed notification for client here.
  -- /api/booking/notify sends a proper confirmation email (Email 1).
  -- For pending→confirmed flow, notify_booking_status_change handles it.

  RETURN NEW;
END;
$$;
