-- ==========================================================================
-- Migration 5 of 6: Fix notification triggers and owner RPCs to look up
-- business name via booking_profiles instead of profiles.
--
-- WHY: After Migration 2, bookings.business_id holds booking_profiles.id.
-- For existing users these UUIDs are identical, so the old
--   SELECT name FROM profiles WHERE id = NEW.business_id
-- still works. For new booking profiles (future multi-profile users) the
-- booking_profiles.id differs from profiles.id, causing the name lookup
-- to return NULL and silencing or mis-labelling notifications.
--
-- CHANGES:
--   notify_booking_created        — line: profiles → booking_profiles
--   notify_booking_status_changed — line: profiles → booking_profiles
--   owner_cancel_booking          — v_biz_name lookup: profiles → booking_profiles
--   owner_confirm_booking         — v_biz_name lookup: profiles → booking_profiles
--
-- SAFE: Only the business-name SELECT is changed. All logic, guards,
-- auth checks, and notification INSERT paths are identical to the
-- current live versions.
-- ==========================================================================

BEGIN;

-- ── 1. notify_booking_created (current live: 20260919000001) ───────────────

CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT name INTO v_client_name   FROM profiles       WHERE id = NEW.client_id   LIMIT 1;
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

  -- Notify assigned staff (if any, and if staff is not the booking client)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id, sm.role
    INTO   v_staff_uid, v_staff_role
    FROM   staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_uid IS NOT NULL AND v_staff_uid IS DISTINCT FROM NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_created',
        COALESCE(v_client_name, 'Gost') || ' je rezervisao/la termin',
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
    AND v_owner_uid IS DISTINCT FROM NEW.client_id
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
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
        COALESCE(v_client_name, 'Gost') || ' je rezervisao/la termin',
        v_service_name || ' · ' || v_dt_str,
        v_meta
      );
    END IF;
  END IF;

  -- Instant booking: notify client of confirmation (skip for guest bookings)
  IF NEW.status = 'confirmed' AND NEW.client_id IS NOT NULL THEN
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

-- ── 2. notify_booking_status_changed (current live: 20261005000000) ────────

CREATE OR REPLACE FUNCTION public.notify_booking_status_changed()
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
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_business_name FROM booking_profiles WHERE id = NEW.business_id LIMIT 1;

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

-- ── 3. owner_cancel_booking (current live: 20260912000001) ─────────────────

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
  v_uid          UUID;
  v_biz_id       UUID;
  v_client_id    UUID;
  v_status       TEXT;
  v_service_name TEXT;
  v_starts_at    TIMESTAMPTZ;
  v_biz_name     TEXT;
  v_notif_body   TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, client_id, status, service_name_snapshot, starts_at
  INTO v_biz_id, v_client_id, v_status, v_service_name, v_starts_at
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

  UPDATE bookings
  SET status              = 'cancelled',
      cancelled_at        = now(),
      cancelled_by        = v_uid,
      cancellation_reason = p_reason,
      updated_at          = now()
  WHERE id = p_booking_id;

  SELECT COALESCE(name, 'Biznis') INTO v_biz_name
  FROM booking_profiles WHERE id = v_biz_id;

  v_notif_body := v_biz_name || ' je otkazao/la termin za ' || v_service_name
    || ' (' || to_char(v_starts_at AT TIME ZONE 'Europe/Sarajevo', 'DD.MM.YYYY HH24:MI') || ')';

  IF p_reason IS NOT NULL AND trim(p_reason) <> '' THEN
    v_notif_body := v_notif_body || '. Razlog: ' || trim(p_reason);
  END IF;

  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_client_id,
      'booking',
      'booking_cancelled',
      'Termin otkazan',
      v_notif_body,
      jsonb_build_object(
        'booking_id',    p_booking_id,
        'business_id',   v_biz_id,
        'business_name', v_biz_name,
        'service_name',  v_service_name,
        'reason',        p_reason
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_cancel_booking(UUID, TEXT) TO authenticated;

-- ── 4. owner_confirm_booking (current live: 20260912000001) ────────────────

CREATE OR REPLACE FUNCTION public.owner_confirm_booking(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID;
  v_biz_id       UUID;
  v_client_id    UUID;
  v_status       TEXT;
  v_service_name TEXT;
  v_starts_at    TIMESTAMPTZ;
  v_biz_name     TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT business_id, client_id, status, service_name_snapshot, starts_at
  INTO v_biz_id, v_client_id, v_status, v_service_name, v_starts_at
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

  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  UPDATE bookings
  SET status     = 'confirmed',
      updated_at = now()
  WHERE id = p_booking_id;

  SELECT COALESCE(name, 'Biznis') INTO v_biz_name
  FROM booking_profiles WHERE id = v_biz_id;

  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_client_id,
      'booking',
      'booking_confirmed',
      'Termin potvrđen',
      v_biz_name || ' je potvrdio/la tvoj termin za ' || v_service_name
        || ' (' || to_char(v_starts_at AT TIME ZONE 'Europe/Sarajevo', 'DD.MM.YYYY HH24:MI') || ')',
      jsonb_build_object(
        'booking_id',    p_booking_id,
        'business_id',   v_biz_id,
        'business_name', v_biz_name,
        'service_name',  v_service_name
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_confirm_booking(UUID) TO authenticated;

COMMIT;
