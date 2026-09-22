-- Add cancellation_reason to in-app (bell) notification bodies:
--   • Client bell when business cancels  → "... · Napomena: <reason>"
--   • Owner bell when client cancels     → "... · Napomena: <reason>"
--   • Staff bell when client cancels     → "... · Napomena: <reason>"
--   • Staff bell when owner cancels      → "... · Napomena: <reason>"
-- Also add reason to trigger for client-cancelled branch (owner/staff bells).

CREATE OR REPLACE FUNCTION notify_booking_status_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_meta          JSONB;
  v_client_name   TEXT;
  v_owner_uid     UUID;
  v_staff_uid     UUID;
  v_staff_name    TEXT;
  v_timezone      TEXT;
  v_reason        TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;
  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');

  IF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM business_locations WHERE id = NEW.location_id LIMIT 1;
  END IF;
  v_timezone := COALESCE(v_timezone, 'UTC');
  v_dt_str   := private_fmt_booking_dt(NEW.starts_at, v_timezone);

  -- Normalise reason: NULL if blank
  v_reason := CASE
    WHEN NEW.cancellation_reason IS NOT NULL AND trim(NEW.cancellation_reason) <> ''
    THEN trim(NEW.cancellation_reason)
    ELSE NULL
  END;

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- Resolve owner uid
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  -- Resolve assigned staff uid + name
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id INTO v_staff_uid
    FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;
    IF v_staff_uid IS NOT NULL THEN
      SELECT name INTO v_staff_name FROM profiles WHERE id = v_staff_uid LIMIT 1;
    END IF;
  END IF;

  -- ── pending → confirmed: notify client ──────────────────────────────────────
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    IF NEW.client_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id, 'booking', 'booking_confirmed',
        'Rezervacija potvrđena',
        COALESCE(v_business_name, 'Biznis') || ' je potvrdio/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- ── * → cancelled ────────────────────────────────────────────────────────────
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

    -- Client cancelled → notify owner + assigned staff
    IF NEW.client_id IS NOT NULL AND NEW.cancelled_by = NEW.client_id THEN
      SELECT name INTO v_client_name FROM profiles WHERE id = NEW.client_id LIMIT 1;

      -- Notify assigned staff (only if different from owner)
      IF v_staff_uid IS NOT NULL AND (v_owner_uid IS NULL OR v_staff_uid <> v_owner_uid) THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_uid, 'booking', 'booking_cancelled',
          COALESCE(v_client_name, 'Klijent') || ' je otkazao/la termin',
          v_service_name || ' · ' || v_dt_str
            || CASE WHEN v_reason IS NOT NULL THEN ' · Napomena: ' || v_reason ELSE '' END,
          v_meta || jsonb_build_object('client_name', v_client_name)
        );
      END IF;

      -- Notify owner (respect notify_cancellation Bell pref)
      IF v_owner_uid IS NOT NULL AND private_owner_pref(v_owner_uid, 'notify_cancellation') THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_owner_uid, 'booking', 'booking_cancelled',
          COALESCE(v_client_name, 'Klijent') || ' je otkazao/la termin',
          v_service_name
            || CASE WHEN v_staff_uid IS NOT NULL AND v_staff_name IS NOT NULL AND v_staff_uid <> v_owner_uid
                 THEN ' · ' || v_staff_name ELSE '' END
            || ' · ' || v_dt_str
            || CASE WHEN v_reason IS NOT NULL THEN ' · Napomena: ' || v_reason ELSE '' END,
          v_meta || jsonb_build_object('client_name', v_client_name)
        );
      END IF;

    -- Business (owner/manager) cancelled
    ELSIF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN

      -- Resolve client name (may be NULL for guest bookings)
      IF NEW.client_id IS NOT NULL THEN
        SELECT name INTO v_client_name FROM profiles WHERE id = NEW.client_id LIMIT 1;
      ELSE
        v_client_name := NEW.guest_name;
      END IF;

      -- Notify client (in-app), include staff name and reason if present.
      -- skip_push_email = true so push/send skips duplicate email (notify API handles it).
      IF NEW.client_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          NEW.client_id, 'booking', 'booking_cancelled',
          'Rezervacija otkazana',
          COALESCE(v_business_name, 'Biznis') || ' je otkazao/la tvoj termin za ' || v_service_name
            || CASE WHEN v_staff_uid IS NOT NULL AND v_staff_name IS NOT NULL
                 THEN ' · radnik: ' || v_staff_name ELSE '' END
            || ' · ' || v_dt_str
            || CASE WHEN v_reason IS NOT NULL THEN '. Napomena: ' || v_reason ELSE '' END,
          v_meta || jsonb_build_object('skip_push_email', true)
        );
      END IF;

      -- Notify assigned staff member that their booking was cancelled by owner.
      IF v_staff_uid IS NOT NULL
        AND (v_owner_uid IS NULL OR v_staff_uid <> v_owner_uid)
        AND (NEW.cancelled_by IS NULL OR v_staff_uid <> NEW.cancelled_by)
      THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_uid, 'booking', 'booking_cancelled',
          'Vlasnik je otkazao/la vaš termin',
          v_service_name || ' · ' || v_dt_str
            || CASE WHEN v_client_name IS NOT NULL THEN ' · Klijent: ' || v_client_name ELSE '' END
            || CASE WHEN v_reason IS NOT NULL THEN '. Napomena: ' || v_reason ELSE '' END,
          v_meta || jsonb_build_object('client_name', v_client_name, 'skip_push_email', true)
        );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END; $$;
