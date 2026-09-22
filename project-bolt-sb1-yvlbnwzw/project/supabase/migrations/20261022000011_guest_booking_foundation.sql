-- ──────────────────────────────────────────────────────────────────────────────
-- Guest Booking Foundation
--
-- Adds guest_email, a secure random access token, and token expiry to bookings.
-- Extends owner_create_booking + staff_create_booking to accept guest_email.
-- Fixes send_booking_reminders to include guest bookings (LEFT JOIN + COALESCE).
-- Adds two new SECURITY DEFINER RPCs:
--   • get_booking_by_token  — public read of a single guest booking via token
--   • cancel_booking_as_guest — guest self-cancellation via token
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. New columns on bookings ────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS guest_email         text,
  ADD COLUMN IF NOT EXISTS guest_access_token  uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS guest_token_expires_at timestamptz;

-- Ensure token is always unique (IDOR protection: token alone is the lookup key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'bookings' AND indexname = 'bookings_guest_access_token_key'
  ) THEN
    CREATE UNIQUE INDEX bookings_guest_access_token_key ON public.bookings (guest_access_token);
  END IF;
END $$;

-- ── 2. UPDATE owner_create_booking ───────────────────────────────────────────
-- Adds p_guest_email parameter.
-- Sets guest_token_expires_at = starts_at + 7 days when guest_email is provided.

CREATE OR REPLACE FUNCTION public.owner_create_booking(
  p_service_id      uuid,
  p_staff_member_id uuid,
  p_starts_at       timestamptz,
  p_guest_name      text    DEFAULT NULL,
  p_guest_phone     text    DEFAULT NULL,
  p_guest_email     text    DEFAULT NULL,
  p_client_id       uuid    DEFAULT NULL,
  p_notes           text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_biz_id       UUID;
  v_svc_name     TEXT;
  v_svc_duration INTEGER;
  v_booking_type TEXT;
  v_ends_at      TIMESTAMPTZ;
  v_booking_id   UUID;
  v_token_exp    TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_guest_name IS NULL AND p_client_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'client_required');
  END IF;

  -- Verify caller is owner or manager of any active business
  SELECT sm.business_id INTO v_biz_id
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
    AND sm.role IN ('owner', 'manager')
  LIMIT 1;

  IF v_biz_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Verify staff member belongs to same business
  IF NOT EXISTS (
    SELECT 1 FROM staff_members
    WHERE id = p_staff_member_id AND business_id = v_biz_id AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_not_found');
  END IF;

  SELECT name, duration_minutes, booking_type
  INTO v_svc_name, v_svc_duration, v_booking_type
  FROM service_catalog
  WHERE id = p_service_id AND business_id = v_biz_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + (v_svc_duration || ' minutes')::INTERVAL;

  -- Token expiry: 7 days after the appointment ends (guest has time to view/cancel)
  -- Only set when guest_email is provided — registered clients don't use token access
  IF p_guest_email IS NOT NULL THEN
    v_token_exp := v_ends_at + INTERVAL '7 days';
  END IF;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    guest_name, guest_phone, guest_email,
    guest_token_expires_at,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, starts_at, ends_at,
    status, confirmation_mode, notes
  ) VALUES (
    v_booking_type, v_biz_id, p_client_id,
    p_guest_name, p_guest_phone, p_guest_email,
    v_token_exp,
    p_service_id, v_svc_name, v_svc_duration,
    p_staff_member_id, p_starts_at, v_ends_at,
    'confirmed', 'instant', p_notes
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;

-- ── 3. UPDATE staff_create_booking ───────────────────────────────────────────
-- Adds p_guest_email parameter. Same token expiry logic as owner_create_booking.

CREATE OR REPLACE FUNCTION public.staff_create_booking(
  p_service_id  uuid,
  p_starts_at   timestamptz,
  p_notes       text    DEFAULT NULL,
  p_guest_name  text    DEFAULT NULL,
  p_guest_phone text    DEFAULT NULL,
  p_guest_email text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID;
  v_sm        RECORD;
  v_svc       RECORD;
  v_ends_at   TIMESTAMPTZ;
  v_token_exp TIMESTAMPTZ;
  v_new_id    UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT sm.id, sm.business_id, sm.primary_location_id, sm.permissions
  INTO v_sm
  FROM staff_members sm
  WHERE sm.user_id = v_uid AND sm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_staff');
  END IF;

  IF NOT COALESCE((v_sm.permissions->>'can_create_bookings')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'permission_denied');
  END IF;

  SELECT sc.name, sc.duration_minutes, sc.buffer_minutes, sc.booking_type
  INTO v_svc
  FROM service_catalog sc
  WHERE sc.id = p_service_id
    AND sc.business_id = v_sm.business_id
    AND sc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_not_found');
  END IF;

  v_ends_at := p_starts_at + make_interval(mins => v_svc.duration_minutes);

  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN service_catalog sc2 ON sc2.id = b.service_id
    WHERE b.staff_member_id = v_sm.id
      AND b.status IN ('pending', 'confirmed')
      AND p_starts_at < (b.ends_at  + make_interval(mins => COALESCE(sc2.buffer_minutes, 0)))
      AND b.starts_at < (v_ends_at  + make_interval(mins => COALESCE(v_svc.buffer_minutes, 0)))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'staff_conflict');
  END IF;

  IF p_guest_email IS NOT NULL THEN
    v_token_exp := v_ends_at + INTERVAL '7 days';
  END IF;

  INSERT INTO bookings (
    booking_type, business_id, client_id,
    service_id, service_name_snapshot, duration_minutes,
    staff_member_id, location_id,
    starts_at, ends_at, notes,
    guest_name, guest_phone, guest_email,
    guest_token_expires_at,
    status, confirmation_mode, payment_status
  ) VALUES (
    v_svc.booking_type, v_sm.business_id, NULL,
    p_service_id, v_svc.name, v_svc.duration_minutes,
    v_sm.id, v_sm.primary_location_id,
    p_starts_at, v_ends_at, p_notes,
    NULLIF(TRIM(COALESCE(p_guest_name,  '')), ''),
    NULLIF(TRIM(COALESCE(p_guest_phone, '')), ''),
    NULLIF(TRIM(COALESCE(p_guest_email, '')), ''),
    v_token_exp,
    'confirmed', 'instant', 'not_required'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_new_id);
END;
$$;

-- ── 4. UPDATE send_booking_reminders ─────────────────────────────────────────
-- Changes INNER JOIN profiles → LEFT JOIN so guest bookings are included.
-- In-app notifications are only inserted for registered users (client_id IS NOT NULL).
-- Email details use COALESCE(profiles.email, bookings.guest_email) etc.
-- Returns guest_access_token so the cron can build the correct guest CTA URL.

CREATE OR REPLACE FUNCTION public.send_booking_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent    INTEGER := 0;
  v_details JSONB   := '[]'::JSONB;
BEGIN
  WITH
  locked AS (
    SELECT b.id, b.client_id, b.business_id, b.location_id,
           b.service_name_snapshot, b.starts_at,
           b.guest_email, b.guest_access_token
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
    -- In-app notifications only for registered users (guests have no user_id)
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
    WHERE l.client_id IS NOT NULL   -- skip guest bookings for in-app notification
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_sent FROM notifs;

  -- Email details for both registered users and guests
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB) INTO v_details
  FROM (
    SELECT
      b.id                                          AS booking_id,
      b.starts_at,
      b.service_name_snapshot                       AS service_name,
      COALESCE(p_c.email,  b.guest_email)           AS client_email,
      COALESCE(p_c.name,   b.guest_name)            AS client_name,
      p_c.country                                   AS client_country,
      p_b.name                                      AS business_name,
      bl.country                                    AS location_country,
      COALESCE(bl.timezone, 'UTC')                  AS timezone,
      bl.name                                       AS location_name,
      bl.address                                    AS location_address,
      bl.city                                       AS location_city,
      b.guest_access_token                          AS guest_access_token,
      CASE WHEN b.client_id IS NULL THEN true ELSE false END AS is_guest
    FROM bookings b
    LEFT JOIN profiles p_c ON p_c.id = b.client_id
    JOIN  profiles p_b ON p_b.id = b.business_id
    LEFT JOIN business_locations bl ON bl.id = b.location_id
    WHERE b.reminder_sent_at >= now() - INTERVAL '5 minutes'
      AND b.reminder_sent_at IS NOT NULL
      AND b.status = 'confirmed'
      AND (p_c.email IS NOT NULL OR b.guest_email IS NOT NULL)  -- must have email to notify
  ) x;

  RETURN jsonb_build_object('ok', true, 'sent', v_sent, 'bookings', v_details);
END;
$$;

-- ── 5. NEW: get_booking_by_token ─────────────────────────────────────────────
-- Public read-only access to a single guest booking via secure token.
-- Only returns bookings that have guest_email set (enforces this is a guest booking).
-- Token expiry is checked server-side.
-- Intentionally returns minimal fields — no internal_notes, no staff details.

CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  SELECT jsonb_build_object(
    'booking_id',       b.id,
    'starts_at',        b.starts_at,
    'ends_at',          b.ends_at,
    'service_name',     b.service_name_snapshot,
    'status',           b.status,
    'guest_name',       b.guest_name,
    'notes',            b.notes,
    'business_name',    bp.name,
    'location_name',    bl.name,
    'location_address', bl.address,
    'location_city',    bl.city,
    'timezone',         COALESCE(bl.timezone, 'UTC')
  ) INTO v_row
  FROM   bookings b
  JOIN   booking_profiles bp ON bp.id = b.business_id
  LEFT JOIN business_locations bl ON bl.id = b.location_id
  WHERE  b.guest_access_token = p_token
    AND  b.guest_email IS NOT NULL
    AND  (b.guest_token_expires_at IS NULL OR b.guest_token_expires_at > now())
  LIMIT  1;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking', v_row);
END;
$$;

-- ── 6. NEW: cancel_booking_as_guest ─────────────────────────────────────────
-- Guest self-cancellation via secure token.
-- Enforces: token valid, booking in cancellable status, not too close to start.
-- Sets cancelled_by = NULL (guest has no user UUID).
-- cancelled_by being NULL is the signal that a guest performed the cancellation.

CREATE OR REPLACE FUNCTION public.cancel_booking_as_guest(
  p_token  uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_status    text;
  v_starts_at timestamptz;
BEGIN
  SELECT b.id, b.status, b.starts_at
  INTO   v_id, v_status, v_starts_at
  FROM   bookings b
  WHERE  b.guest_access_token = p_token
    AND  b.guest_email IS NOT NULL
    AND  (b.guest_token_expires_at IS NULL OR b.guest_token_expires_at > now())
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_cancel');
  END IF;

  -- Business rule: guests cannot cancel within 2 hours of the appointment
  IF v_starts_at < now() + INTERVAL '2 hours' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_late_to_cancel');
  END IF;

  UPDATE bookings
  SET
    status              = 'cancelled',
    cancelled_at        = now(),
    cancelled_by        = NULL,       -- NULL signals guest cancellation (no user UUID)
    cancellation_reason = COALESCE(p_reason, 'Otkazano od strane gosta')
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute rights to authenticated and anon roles
-- get_booking_by_token and cancel_booking_as_guest are called from public guest pages
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(uuid)              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_as_guest(uuid, text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_create_booking(uuid,uuid,timestamptz,text,text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_create_booking(uuid,timestamptz,text,text,text,text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_booking_reminders()                TO service_role;

-- ── 7. Fix notify_booking_status_changed trigger for guest bookings ────────────
-- Guest bookings have client_id = NULL; skip in-app notifications for them.
CREATE OR REPLACE FUNCTION public.notify_booking_status_changed()
RETURNS trigger AS $$
DECLARE
  v_business_name TEXT;
  v_service_name  TEXT;
  v_dt_str        TEXT;
  v_meta          JSONB;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Guest bookings have no client_id → no in-app notifications
  IF NEW.client_id IS NULL THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
