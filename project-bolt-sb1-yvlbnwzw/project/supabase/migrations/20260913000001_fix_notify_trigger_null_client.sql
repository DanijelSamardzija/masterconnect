-- Fix: notify_booking_status_changed tries to INSERT NULL user_id for guest bookings
-- (bookings where client_id IS NULL). Guard every INSERT with client_id IS NOT NULL.

CREATE OR REPLACE FUNCTION public.notify_booking_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_meta          JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_meta := jsonb_build_object(
    'booking_id',    NEW.id,
    'business_id',   NEW.business_id,
    'business_name', v_business_name,
    'service_name',  v_service_name,
    'starts_at',     NEW.starts_at,
    'party_size',    NEW.party_size
  );

  -- pending → confirmed: notify client
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_confirmed',
      'Rezervacija potvrđena',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- * → cancelled: notify client (skip guest bookings and self-cancel)
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.client_id IS NOT NULL THEN
    IF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id,
        'booking',
        'booking_cancelled',
        'Rezervacija otkazana',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- confirmed → completed: notify client
  IF OLD.status = 'confirmed' AND NEW.status = 'completed' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_completed',
      'Vaš termin je završen',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- confirmed → no_show: notify client
  IF OLD.status = 'confirmed' AND NEW.status = 'no_show' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_no_show',
      'Termin nije iskorišten',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  RETURN NEW;
END;
$$;
