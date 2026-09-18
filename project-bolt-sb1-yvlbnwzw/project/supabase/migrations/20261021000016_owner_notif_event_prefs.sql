-- =============================================================================
-- Owner booking-event notification preferences
--
-- 1. Extend update_notification_prefs to include per-event toggles
-- 2. Fix gap: owner notified on cancellation (by client or staff)
-- 3. Fix gap: owner notified when staff reschedules a booking
-- 4. All owner inserts check notify_new_booking / notify_cancellation /
--    notify_reschedule pref before inserting (defaults to true)
-- =============================================================================

-- Helper: does this owner want to receive this booking event?
-- Returns TRUE if pref is missing (opt-in by default)
CREATE OR REPLACE FUNCTION private_owner_pref(p_user_id UUID, p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((notification_prefs->>p_key)::BOOLEAN, true)
  FROM   public.profiles
  WHERE  id = p_user_id;
$$;

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
    -- booking event types (owner only)
    'notify_new_booking',  COALESCE((p_prefs->>'notify_new_booking')::BOOLEAN,  true),
    'notify_cancellation', COALESCE((p_prefs->>'notify_cancellation')::BOOLEAN, true),
    'notify_reschedule',   COALESCE((p_prefs->>'notify_reschedule')::BOOLEAN,   true)
  )
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_notification_prefs(JSONB) TO authenticated;


-- ── 2. notify_booking_created — respect owner's notify_new_booking pref ──────

CREATE OR REPLACE FUNCTION notify_booking_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client_name   TEXT;
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_owner_uid     UUID;
  v_staff_uid     UUID;
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

  -- Notify assigned staff (if not the client)
  IF NEW.staff_member_id IS NOT NULL THEN
    SELECT sm.user_id INTO v_staff_uid FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;
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

  -- Notify owner (skip if owner == client OR owner == already-notified staff)
  -- Also skip if owner has opted out of new-booking notifications
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  IF v_owner_uid IS NOT NULL
    AND v_owner_uid <> NEW.client_id
    AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
    AND private_owner_pref(v_owner_uid, 'notify_new_booking')
  THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_owner_uid, 'booking', 'booking_created',
      COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin',
      v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- If instant booking: notify client of confirmation
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


-- ── 3. notify_booking_status_changed — add owner on cancellation ──────────────

CREATE OR REPLACE FUNCTION notify_booking_status_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_body          TEXT;
  v_meta          JSONB;
  v_staff_uid     UUID;
  v_owner_uid     UUID;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;
  v_business_name := COALESCE(v_business_name, 'Biznis');
  v_service_name  := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str        := private_fmt_booking_dt(NEW.starts_at);

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
      NEW.client_id, 'booking', 'booking_confirmed', 'Termin potvrđen',
      v_business_name || ' je potvrdio/la tvoj termin za ' || v_service_name || ' · ' || v_dt_str,
      v_meta
    );
  END IF;

  -- * → cancelled: notify client, staff, owner
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

    -- Client (skip if they cancelled themselves)
    IF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN
      v_body := v_business_name || ' je otkazao/la termin za ' || v_service_name || ' · ' || v_dt_str;
      IF NEW.cancellation_reason IS NOT NULL AND trim(NEW.cancellation_reason) <> '' THEN
        v_body := v_body || '. Razlog: ' || trim(NEW.cancellation_reason);
      END IF;
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        NEW.client_id, 'booking', 'booking_cancelled', 'Termin otkazan',
        v_body,
        v_meta || jsonb_build_object('reason', NEW.cancellation_reason)
      );
    END IF;

    -- Assigned staff (skip if they cancelled or they are the client)
    IF NEW.staff_member_id IS NOT NULL THEN
      SELECT sm.user_id INTO v_staff_uid FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;
      IF v_staff_uid IS NOT NULL
        AND v_staff_uid <> NEW.client_id
        AND (NEW.cancelled_by IS NULL OR v_staff_uid <> NEW.cancelled_by)
      THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_uid, 'booking', 'booking_cancelled', 'Termin otkazan',
          'Termin za ' || v_service_name || ' · ' || v_dt_str || ' je otkazan',
          v_meta
        );
      END IF;
    END IF;

    -- Owner: fixed gap — notify when someone else cancels
    -- Respect owner's notify_cancellation preference
    SELECT sm.user_id INTO v_owner_uid
    FROM staff_members sm
    WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
    LIMIT 1;

    IF v_owner_uid IS NOT NULL
      AND (NEW.cancelled_by IS NULL OR v_owner_uid <> NEW.cancelled_by)
      AND (v_staff_uid IS NULL OR v_owner_uid <> v_staff_uid)
      AND private_owner_pref(v_owner_uid, 'notify_cancellation')
    THEN
      v_body := 'Termin za ' || v_service_name || ' · ' || v_dt_str || ' je otkazan';
      IF NEW.cancellation_reason IS NOT NULL AND trim(NEW.cancellation_reason) <> '' THEN
        v_body := v_body || '. Razlog: ' || trim(NEW.cancellation_reason);
      END IF;
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_owner_uid, 'booking', 'booking_cancelled', 'Termin otkazan',
        v_body,
        v_meta || jsonb_build_object('reason', NEW.cancellation_reason)
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


-- ── 4. staff_reschedule_booking — add owner notification ─────────────────────

CREATE OR REPLACE FUNCTION public.staff_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         UUID;
  v_sm_id       UUID;
  v_biz_id      UUID;
  v_perms       JSONB;
  v_old_start   TIMESTAMPTZ;
  v_old_end     TIMESTAMPTZ;
  v_new_end     TIMESTAMPTZ;
  v_client_id   UUID;
  v_svc_name    TEXT;
  v_biz_name    TEXT;
  v_owner_uid   UUID;
  v_duration_iv INTERVAL;
  v_meta        JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.permissions
  INTO   v_sm_id, v_biz_id, v_perms
  FROM   staff_members sm
  WHERE  sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_perms->>'can_reschedule_bookings')::BOOLEAN, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT starts_at, ends_at, client_id, service_name_snapshot
  INTO   v_old_start, v_old_end, v_client_id, v_svc_name
  FROM   bookings
  WHERE  id = p_booking_id AND business_id = v_biz_id
    AND  staff_member_id = v_sm_id AND status IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  IF p_new_starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_in_past');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE  b.staff_member_id = v_sm_id AND b.status IN ('pending', 'confirmed')
      AND  b.id <> p_booking_id
      AND  p_new_starts_at < b.ends_at AND v_new_end > b.starts_at
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'conflict');
  END IF;

  UPDATE bookings
  SET starts_at = p_new_starts_at, ends_at = v_new_end, updated_at = now()
  WHERE id = p_booking_id;

  SELECT name INTO v_biz_name FROM profiles WHERE id = v_biz_id LIMIT 1;
  v_biz_name := COALESCE(v_biz_name, 'Biznis');
  v_svc_name := COALESCE(v_svc_name, 'Usluga');

  v_meta := jsonb_build_object(
    'booking_id',    p_booking_id,
    'business_id',   v_biz_id,
    'business_name', v_biz_name,
    'service_name',  v_svc_name,
    'starts_at',     p_new_starts_at
  );

  -- Notify client
  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_client_id, 'booking', 'booking_rescheduled', 'Termin premješten',
      v_biz_name || ' je premjestio/la tvoj termin za ' || v_svc_name || ' · ' || private_fmt_booking_dt(p_new_starts_at),
      v_meta
    );
  END IF;

  -- Fixed gap: notify owner when staff reschedules
  -- Respect owner's notify_reschedule preference
  SELECT sm.user_id INTO v_owner_uid
  FROM staff_members sm
  WHERE sm.business_id = v_biz_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  IF v_owner_uid IS NOT NULL
    AND v_owner_uid <> v_uid
    AND private_owner_pref(v_owner_uid, 'notify_reschedule')
  THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_owner_uid, 'booking', 'booking_rescheduled', 'Termin premješten',
      'Termin za ' || v_svc_name || ' premješten na ' || private_fmt_booking_dt(p_new_starts_at),
      v_meta
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;
