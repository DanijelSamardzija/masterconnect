-- =============================================================================
-- Notification gaps — 5 fixes in one migration
--
-- Gap 1: notify_booking_created — add in-app for client on instant (confirmed) booking
-- Gap 2: notify_booking_status_changed — add in-app for assigned staff on cancellation
-- Gap 3: owner_reschedule_booking — add in-app for client + staff after reschedule
-- Gap 4: staff_reschedule_booking — add in-app for client after reschedule
-- Gap 5: send_booking_reminders — return booking details so cron can send reminder emails
-- =============================================================================

-- ── Gap 1 + Gap 2: rewrite both trigger functions ────────────────────────────

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
  SELECT name INTO v_client_name   FROM profiles WHERE id = NEW.client_id   LIMIT 1;
  SELECT name INTO v_business_name FROM profiles WHERE id = NEW.business_id LIMIT 1;

  v_service_name := COALESCE(NEW.service_name_snapshot, 'Usluga');
  v_dt_str       := private_fmt_booking_dt(NEW.starts_at);

  v_notif_title := COALESCE(v_client_name, 'Klijent') || ' je rezervisao/la termin';
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
    FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

    IF v_staff_user_id IS NOT NULL AND v_staff_user_id <> NEW.client_id THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (v_staff_user_id, 'booking', 'booking_created', v_notif_title, v_notif_body, v_meta);
    END IF;
  END IF;

  -- Notify business owner (skip if owner == client OR owner == already-notified staff)
  SELECT sm.user_id INTO v_owner_user_id
  FROM staff_members sm
  WHERE sm.business_id = NEW.business_id AND sm.role = 'owner' AND sm.is_active = true
  LIMIT 1;

  IF v_owner_user_id IS NOT NULL
    AND v_owner_user_id <> NEW.client_id
    AND (v_staff_user_id IS NULL OR v_owner_user_id <> v_staff_user_id)
  THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (v_owner_user_id, 'booking', 'booking_created', v_notif_title, v_notif_body, v_meta);
  END IF;

  -- Gap 1: if booking is instantly confirmed, notify client too (no status-change trigger fires)
  IF NEW.status = 'confirmed' THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      NEW.client_id,
      'booking',
      'booking_confirmed',
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


CREATE OR REPLACE FUNCTION notify_booking_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name  TEXT;
  v_service_name   TEXT;
  v_dt_str         TEXT;
  v_body           TEXT;
  v_meta           JSONB;
  v_staff_user_id  UUID;
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

  -- * → cancelled: notify client (skip if client cancelled themselves)
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    IF NEW.cancelled_by IS NULL OR NEW.cancelled_by <> NEW.client_id THEN
      v_body := v_business_name || ' je otkazao/la termin za ' || v_service_name || ' · ' || v_dt_str;
      IF NEW.cancellation_reason IS NOT NULL AND trim(NEW.cancellation_reason) <> '' THEN
        v_body := v_body || '. Razlog: ' || trim(NEW.cancellation_reason);
      END IF;
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (NEW.client_id, 'booking', 'booking_cancelled', 'Termin otkazan', v_body, v_meta || jsonb_build_object('reason', NEW.cancellation_reason));
    END IF;

    -- Gap 2: also notify assigned staff (if any, if not the canceller)
    IF NEW.staff_member_id IS NOT NULL THEN
      SELECT sm.user_id INTO v_staff_user_id
      FROM staff_members sm WHERE sm.id = NEW.staff_member_id LIMIT 1;

      IF v_staff_user_id IS NOT NULL
        AND v_staff_user_id <> NEW.client_id
        AND (NEW.cancelled_by IS NULL OR v_staff_user_id <> NEW.cancelled_by)
      THEN
        INSERT INTO notifications (user_id, type, action_type, title, body, meta)
        VALUES (
          v_staff_user_id, 'booking', 'booking_cancelled', 'Termin otkazan',
          'Termin za ' || v_service_name || ' · ' || v_dt_str || ' je otkazan',
          v_meta
        );
      END IF;
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


-- ── Gap 3: owner_reschedule_booking — add in-app for client + staff ───────────

CREATE OR REPLACE FUNCTION public.owner_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
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
  v_old_start    TIMESTAMPTZ;
  v_old_end      TIMESTAMPTZ;
  v_new_end      TIMESTAMPTZ;
  v_staff_id     UUID;
  v_staff_uid    UUID;
  v_client_id    UUID;
  v_svc_name     TEXT;
  v_biz_name     TEXT;
  v_duration_iv  INTERVAL;
  v_meta         JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  SELECT starts_at, ends_at, staff_member_id, client_id, service_name_snapshot
  INTO   v_old_start, v_old_end, v_staff_id, v_client_id, v_svc_name
  FROM   bookings
  WHERE  id = p_booking_id AND business_id = v_biz_id AND status IN ('pending', 'confirmed');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  v_duration_iv := v_old_end - v_old_start;
  v_new_end     := p_new_starts_at + v_duration_iv;

  IF p_new_starts_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'time_in_past');
  END IF;

  IF v_staff_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM bookings b
      WHERE  b.staff_member_id = v_staff_id AND b.status IN ('pending', 'confirmed')
        AND  b.id <> p_booking_id
        AND  p_new_starts_at < b.ends_at AND v_new_end > b.starts_at
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict');
    END IF;
  END IF;

  UPDATE bookings
  SET starts_at = p_new_starts_at, ends_at = v_new_end, updated_at = now()
  WHERE id = p_booking_id;

  -- Gap 3: in-app notifications for client + staff
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

  -- Notify assigned staff (if any, if not the owner performing the action)
  IF v_staff_id IS NOT NULL THEN
    SELECT sm.user_id INTO v_staff_uid FROM staff_members sm WHERE sm.id = v_staff_id LIMIT 1;
    IF v_staff_uid IS NOT NULL AND v_staff_uid <> v_uid THEN
      INSERT INTO notifications (user_id, type, action_type, title, body, meta)
      VALUES (
        v_staff_uid, 'booking', 'booking_rescheduled', 'Termin premješten',
        'Termin za ' || v_svc_name || ' premješten na ' || private_fmt_booking_dt(p_new_starts_at),
        v_meta
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;


-- ── Gap 4: staff_reschedule_booking — add in-app for client ──────────────────

CREATE OR REPLACE FUNCTION public.staff_reschedule_booking(
  p_booking_id    UUID,
  p_new_starts_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF NOT COALESCE((v_perms->>'can_reschedule_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT starts_at, ends_at, client_id, service_name_snapshot
  INTO   v_old_start, v_old_end, v_client_id, v_svc_name
  FROM   bookings
  WHERE  id = p_booking_id AND business_id = v_biz_id AND staff_member_id = v_sm_id AND status IN ('pending', 'confirmed');

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

  -- Gap 4: notify client
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

  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, action_type, title, body, meta)
    VALUES (
      v_client_id, 'booking', 'booking_rescheduled', 'Termin premješten',
      v_biz_name || ' je premjestio/la tvoj termin za ' || v_svc_name || ' · ' || private_fmt_booking_dt(p_new_starts_at),
      v_meta
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_reschedule_booking(UUID, TIMESTAMPTZ) TO authenticated;


-- ── Gap 5: send_booking_reminders — return booking details for email ──────────

CREATE OR REPLACE FUNCTION public.send_booking_reminders()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent    INTEGER := 0;
  v_details JSONB   := '[]'::JSONB;
BEGIN
  WITH
  locked AS (
    SELECT b.id, b.client_id, b.business_id, b.location_id, b.service_name_snapshot, b.starts_at
    FROM   bookings b
    WHERE  b.status           = 'confirmed'
      AND  b.reminder_sent_at IS NULL
      AND  b.starts_at BETWEEN (now() + INTERVAL '23 hours') AND (now() + INTERVAL '25 hours')
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE bookings SET reminder_sent_at = now()
    WHERE  id IN (SELECT id FROM locked)
    RETURNING id
  ),
  notifs AS (
    INSERT INTO notifications(user_id, type, action_type, title, body, meta)
    SELECT
      l.client_id, 'booking', 'booking_reminder', 'Termin sutra ⏰',
      private_fmt_booking_dt(l.starts_at),
      jsonb_build_object(
        'booking_id',    l.id,
        'business_id',   l.business_id,
        'business_name', (SELECT name FROM profiles WHERE id = l.business_id LIMIT 1),
        'service_name',  l.service_name_snapshot,
        'starts_at',     l.starts_at
      )
    FROM locked l
    INNER JOIN updated u ON u.id = l.id
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_sent FROM notifs;

  -- Collect booking details for the cron to send reminder emails
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB) INTO v_details
  FROM (
    SELECT
      b.id                            AS booking_id,
      b.starts_at,
      b.service_name_snapshot         AS service_name,
      p_c.email                       AS client_email,
      p_c.name                        AS client_name,
      p_c.country                     AS client_country,
      p_b.name                        AS business_name,
      COALESCE(bl.timezone, 'UTC')    AS timezone
    FROM bookings b
    JOIN profiles p_c ON p_c.id = b.client_id
    JOIN profiles p_b ON p_b.id = b.business_id
    LEFT JOIN business_locations bl ON bl.id = b.location_id
    WHERE b.reminder_sent_at >= now() - INTERVAL '5 minutes'
      AND b.reminder_sent_at IS NOT NULL
      AND b.status = 'confirmed'
  ) x;

  RETURN jsonb_build_object('ok', true, 'sent', v_sent, 'bookings', v_details);
END;
$$;

REVOKE ALL ON FUNCTION public.send_booking_reminders() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_booking_reminders() TO service_role;
