-- ==========================================================================
-- F4: Booking Notifications — DB triggers on bookings table
-- Reuses existing notifications table + push/email webhook pipeline.
-- No new tables — only trigger functions and their bindings.
-- ==========================================================================
--
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────
-- notify_booking_created   — fires AFTER INSERT ON bookings
--   → notifies assigned staff member (if any) + business owner
--   → skips if notifiee == client (owner booked themselves)
--
-- notify_booking_status_changed — fires AFTER UPDATE ON bookings
--   → pending → confirmed: notifies client (booking_confirmed)
--   → *       → cancelled: notifies client (booking_cancelled), only once
--
-- ACTION TYPES (stored in notifications.action_type)
--   booking_created    — recipient is staff/owner; sender is client
--   booking_confirmed  — recipient is client; triggered by status change
--   booking_cancelled  — recipient is client; triggered by cancellation
--
-- META SHAPE (stored in notifications.meta JSONB)
--   booking_id, business_id, business_name, client_id, client_name,
--   service_name, starts_at (ISO string, UTC), party_size
-- ==========================================================================

-- ── Helper: format starts_at as a readable date-time string ───────────────
-- Used in notification body. Example: "15.03.2027 · 14:30"
-- DB stores UTC; we format as-is (client app will localize via TZ).
CREATE OR REPLACE FUNCTION private_fmt_booking_dt(p_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(p_ts AT TIME ZONE 'UTC', 'DD.MM.YYYY · HH24:MI') || ' UTC';
$$;

-- ── notify_booking_created ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name     TEXT;
  v_business_name   TEXT;
  v_service_name    TEXT;
  v_dt_str          TEXT;
  v_owner_user_id   UUID;
  v_staff_user_id   UUID;
  v_notif_title     TEXT;
  v_notif_body      TEXT;
  v_meta            JSONB;
BEGIN
  -- Fetch names (client, business)
  SELECT name INTO v_client_name   FROM profiles WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_notif_title := COALESCE(v_client_name, 'Klijent') || ' je rezervisao termin';
  v_notif_body  := v_service_name || ' · ' || v_dt_str;

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

  -- Notify assigned staff member (if any, and not the client themselves)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id INTO v_staff_user_id
    FROM staff_members sm
    WHERE sm.id = NEW.staff_member_id
    LIMIT 1;

    IF v_staff_user_id IS NOT NULL AND v_staff_user_id <> NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (v_staff_user_id, 'booking', 'booking_created', v_notif_title, v_notif_body, v_meta);
    END IF;
  END IF;

  -- Notify business owner (skip if owner == client OR owner == already-notified staff)
  SELECT sm.user_id INTO v_owner_user_id
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id
    AND sm.role        = 'owner'
    AND sm.is_active   = true
  LIMIT 1;

  IF v_owner_user_id IS NOT NULL
    AND v_owner_user_id <> NEW.client_id
    AND (v_staff_user_id IS NULL OR v_owner_user_id <> v_staff_user_id)
  THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (v_owner_user_id, 'booking', 'booking_created', v_notif_title, v_notif_body, v_meta);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_booking_created ON bookings;
CREATE TRIGGER trigger_notify_booking_created
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_created();

-- ── notify_booking_status_changed ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_booking_status_changed()
RETURNS TRIGGER
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
  -- Only act on genuine status transitions
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
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
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

  -- * → cancelled: notify client (once — guard against double-fire)
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- Skip if client cancelled themselves (they already know)
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_booking_status_changed ON bookings;
CREATE TRIGGER trigger_notify_booking_status_changed
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_status_changed();
