-- When business (owner/manager) cancels a booking assigned to a staff member:
-- 1. Notify that staff member in-app: "Vlasnik je otkazao/la vaš termin"
-- 2. Include client name in the notification body
-- Also include staff name in the client in-app notification body.
-- Fix: mark client notification with skip_push_email so push/send does not send
-- a duplicate generic email (the /api/booking/notify cancellation call handles it).
-- Fix: owner_cancel_booking no longer inserts a notification directly (trigger does it).

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

  -- Resolve owner uid (used in multiple branches)
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  -- Resolve assigned staff uid + name (used in multiple branches)
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
          v_service_name || ' · ' || v_dt_str,
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
            || ' · ' || v_dt_str,
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

      -- Notify client (in-app), include staff name if assigned.
      -- skip_push_email = true so push/send skips duplicate email (notify API handles it).
      IF NEW.client_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          NEW.client_id, 'booking', 'booking_cancelled',
          'Rezervacija otkazana',
          COALESCE(v_business_name, 'Biznis') || ' je otkazao/la tvoj termin za ' || v_service_name
            || CASE WHEN v_staff_uid IS NOT NULL AND v_staff_name IS NOT NULL
                 THEN ' · radnik: ' || v_staff_name ELSE '' END
            || ' · ' || v_dt_str,
          v_meta || jsonb_build_object('skip_push_email', true)
        );
      END IF;

      -- Notify assigned staff member that their booking was cancelled by owner.
      -- Skip if staff is the owner, or if staff themselves cancelled.
      IF v_staff_uid IS NOT NULL
        AND (v_owner_uid IS NULL OR v_staff_uid <> v_owner_uid)
        AND (NEW.cancelled_by IS NULL OR v_staff_uid <> NEW.cancelled_by)
      THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_uid, 'booking', 'booking_cancelled',
          'Vlasnik je otkazao/la vaš termin',
          v_service_name || ' · ' || v_dt_str
            || CASE WHEN v_client_name IS NOT NULL THEN ' · Klijent: ' || v_client_name ELSE '' END,
          v_meta || jsonb_build_object('client_name', v_client_name, 'skip_push_email', true)
        );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- Fix: owner_cancel_booking must NOT directly insert a notification.
-- The trigger above handles all notification logic.
-- (Removes the duplicate "Termin otkazan" notification that was added in 20260912000001.)
CREATE OR REPLACE FUNCTION public.owner_cancel_booking(
  p_booking_id UUID,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID;
  v_biz_id UUID;
  v_status TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, status
  INTO v_biz_id, v_status
  FROM bookings WHERE id = p_booking_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE business_id = v_biz_id AND user_id = v_uid
      AND is_active = true AND role IN ('owner', 'manager')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_finished');
  END IF;

  -- Trigger notify_booking_status_changed fires on this UPDATE and handles all notifications.
  UPDATE bookings
  SET status              = 'cancelled',
      cancelled_at        = now(),
      cancelled_by        = v_uid,
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cancel_booking(UUID, TEXT) TO authenticated;
