-- Fix notify_booking_created: when the owner creates a booking for a staff member,
-- show "Vlasnik vam je zakazao termin" instead of "Klijent je rezervisao/la termin".
-- Detect via v_caller_uid = v_owner_uid (auth.uid() at INSERT time = owner's UID).

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
  v_owner_created BOOL;
  v_staff_title   TEXT;
  v_staff_body    TEXT;
  v_meta          JSONB;
BEGIN
  v_caller_uid := auth.uid();

  SELECT name INTO v_client_name   FROM profiles        WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

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

  -- Resolve owner uid first (needed for owner_created check)
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  -- Was this booking created by the owner?
  v_owner_created := (v_caller_uid IS NOT NULL AND v_caller_uid = v_owner_uid);

  -- ── Notify assigned staff ──────────────────────────────────────────────────
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_uid IS NOT NULL
      AND (NEW.client_id IS NULL OR v_staff_uid <> NEW.client_id)
      AND (v_caller_uid IS NULL OR v_staff_uid <> v_caller_uid)
    THEN
      IF v_owner_created THEN
        -- Owner manually added this booking for the staff member
        v_staff_title := 'Vlasnik vam je zakazao termin';
        v_staff_body  := v_service_name || ' · ' || v_dt_str
          || CASE WHEN v_client_name IS NOT NULL
               THEN ' · Klijent: ' || v_client_name
               ELSE '' END;
      ELSE
        -- Client self-booked
        v_staff_title := COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin';
        v_staff_body  := v_service_name || ' · ' || v_dt_str;
      END IF;

      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        v_staff_title,
        v_staff_body,
        v_meta
      );
    END IF;
  END IF;

  -- ── Notify owner (skip if they created this booking) ──────────────────────
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

  -- ── Notify client of instant confirmation (skip for guest and owner-created) ──
  -- When owner created the booking, no need to send "Rezervacija potvrđena" to client
  -- because owner managed this manually; client will be contacted separately if needed.
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL AND NOT v_owner_created THEN
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
