-- When client cancels their own booking, notify owner (in-app) and assigned staff (in-app).
-- Owner title: "Bojan Kiš je otkazao/la termin"
-- Owner body:  "Sisanje · Zoran Samardzija · 24.09.2026 14:00"
-- Staff body:  "Sisanje · 24.09.2026 14:00"
-- Owner can suppress via notify_cancellation pref (Bell toggle in notification settings).
-- Also upgrades v_dt_str to timezone-aware format and uses booking_profiles for business name.

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
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;
  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');

  -- Timezone-aware datetime string (matches notify_booking_created)
  IF NEW.location_id IS NOT NULL THEN
    SELECT COALESCE(timezone, 'UTC') INTO v_timezone
    FROM business_locations WHERE id = NEW.location_id LIMIT 1;
  END IF;
  v_timezone := COALESCE(v_timezone, 'UTC');
  v_dt_str   := private_fmt_booking_dt(NEW.starts_at, v_timezone);

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- pending → confirmed: notify client (in-app only; email handled by push/send)
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

  -- * → cancelled
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

    -- Client cancelled → notify owner + assigned staff
    IF NEW.client_id IS NOT NULL AND NEW.cancelled_by = NEW.client_id THEN
      SELECT name INTO v_client_name FROM profiles WHERE id = NEW.client_id LIMIT 1;

      IF NEW.staff_member_id IS NOT NULL THEN
        SELECT sm.user_id INTO v_staff_uid
        FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;
        IF v_staff_uid IS NOT NULL THEN
          SELECT name INTO v_staff_name FROM profiles WHERE id = v_staff_uid LIMIT 1;
        END IF;
      END IF;

      SELECT sm.user_id INTO v_owner_uid
      FROM staff_members sm
      WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
      LIMIT 1;

      -- Notify assigned staff (only if different from owner)
      IF v_staff_uid IS NOT NULL AND (v_owner_uid IS NULL OR v_staff_uid <> v_owner_uid) THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_uid, 'booking', 'booking_cancelled',
          COALESCE(v_client_name, 'Klijent') || ' je otkazao/la termin',
          v_service_name || ' · ' || v_dt_str,
          v_meta || jsonb_build_object('client_name', v_client_name)
        );
      END IF;

      -- Notify owner (respect notify_cancellation Bell pref; default true)
      IF v_owner_uid IS NOT NULL AND private_owner_pref(v_owner_uid, 'notify_cancellation') THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_owner_uid, 'booking', 'booking_cancelled',
          COALESCE(v_client_name, 'Klijent') || ' je otkazao/la termin',
          v_service_name
            || CASE
                 WHEN v_staff_uid IS NOT NULL AND v_staff_name IS NOT NULL AND v_staff_uid <> v_owner_uid
                 THEN ' · ' || v_staff_name
                 ELSE ''
               END
            || ' · ' || v_dt_str,
          v_meta || jsonb_build_object('client_name', v_client_name)
        );
      END IF;

    -- Business (owner/staff) cancelled → notify client
    ELSIF NEW.client_id IS NOT NULL AND (NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id) THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id, 'booking', 'booking_cancelled',
        'Rezervacija otkazana',
        COALESCE(v_business_name, 'Biznis') || ' je otkazao/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;

  END IF;

  RETURN NEW;
END; $$;
